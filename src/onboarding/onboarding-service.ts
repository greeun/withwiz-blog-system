import type { TenantService } from '../tenant/tenant-service';
import type { TenantUserService } from '../tenant/tenant-user-service';
import type { BlogService } from '@withwiz/blog-core/services';
import type { Tenant, TenantUser } from '../types/tenant';
import { TenantRole } from '../types/tenant';

export interface OnboardingInput {
  tenantName: string;
  tenantSlug: string;
  ownerUserId: string;
  categories?: Array<{ key: string; label: string }>;
  createSamplePost?: boolean;
  planId?: string;
}

export interface OnboardingResult {
  tenant: Tenant;
  tenantUser: TenantUser;
  samplePostId?: string;
}

const DEFAULT_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'general', label: '일반' },
  { key: 'notice', label: '공지사항' },
  { key: 'tech', label: '기술' },
];

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** HTML 본문에 삽입하는 값이 태그·속성으로 해석되지 않도록 이스케이프한다. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

export interface OnboardingService {
  onboardTenant(data: OnboardingInput): Promise<OnboardingResult>;
}

export function createOnboardingService(
  tenantService: TenantService,
  tenantUserService: TenantUserService,
  createScopedBlogService: (tenantId: string) => BlogService,
): OnboardingService {
  return {
    async onboardTenant(data: OnboardingInput): Promise<OnboardingResult> {
      const categories = data.categories ?? DEFAULT_CATEGORIES;

      const categoryMap: Record<string, { label: string }> = {};
      for (const cat of categories) {
        categoryMap[cat.key] = { label: cat.label };
      }

      const tenant = await tenantService.create({
        name: data.tenantName,
        slug: data.tenantSlug,
        planId: data.planId,
        settings: {
          blogConfig: {
            categories: categoryMap as any,
          },
        },
      });

      const tenantUser = await tenantUserService.addUser(
        tenant.id,
        data.ownerUserId,
        TenantRole.OWNER,
      );

      let samplePostId: string | undefined;

      if (data.createSamplePost) {
        try {
          const blogService = createScopedBlogService(tenant.id);
          // content 는 HTML 이므로 삽입하는 입력값을 이스케이프한다.
          // title·excerpt 는 텍스트 필드이며 출력 계층이 이스케이프하므로 원문을 유지한다.
          const safeTenantName = escapeHtml(data.tenantName);
          const samplePost = await blogService.create(
            {
              title: `${data.tenantName} 블로그에 오신 것을 환영합니다!`,
              slug: 'welcome',
              content: `<h2>안녕하세요!</h2><p><strong>${safeTenantName}</strong> 블로그가 개설되었습니다.</p><p>이 게시글은 자동으로 생성된 샘플입니다. 자유롭게 수정하거나 삭제해 주세요.</p>`,
              category: categories[0]?.key ?? 'general',
              excerpt: `${data.tenantName} 블로그의 첫 번째 게시글입니다.`,
              published: true,
            },
            data.ownerUserId,
          );
          samplePostId = samplePost.id;
        } catch {
          // 샘플 게시글 생성 실패는 온보딩 자체를 실패시키지 않는다
        }
      }

      return {
        tenant,
        tenantUser,
        samplePostId,
      };
    },
  };
}
