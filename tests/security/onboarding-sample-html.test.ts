/**
 * 온보딩 샘플 게시글 HTML 입력값 이스케이프 보안 테스트
 *
 * createSamplePost 로 만드는 환영 게시글의 본문(HTML)에 테넌트 이름이 태그로 해석되지 않도록
 * HTML 이스케이프해 삽입하는지 검증한다. 제목·요약은 HTML 이 아닌 텍스트 필드이므로
 * 원문을 유지하고, 출력 시 이스케이프는 렌더링 계층(blog-core 컴포넌트는 React 텍스트로 출력)이 맡는다.
 */
import { describe, it, expect, vi } from 'vitest';
import { createOnboardingService } from '@withwiz/blog-system/onboarding';
import { TenantRole } from '@withwiz/blog-system/types';

function setup() {
  const tenantService = {
    create: vi.fn(async (data: any) => ({ id: 't-1', name: data.name, slug: data.slug })),
  } as any;
  const tenantUserService = {
    addUser: vi.fn(async (tenantId: string, userId: string, role: TenantRole) => ({ id: 'tu-1', tenantId, userId, role })),
  } as any;
  const blogService = { create: vi.fn().mockResolvedValue({ id: 'post-1' }) } as any;
  const service = createOnboardingService(tenantService, tenantUserService, () => blogService);
  return { service, blogService };
}

async function samplePostFor(tenantName: string) {
  const { service, blogService } = setup();
  await service.onboardTenant({
    tenantName,
    tenantSlug: 'my-blog',
    ownerUserId: 'owner-1',
    createSamplePost: true,
  });
  expect(blogService.create).toHaveBeenCalledTimes(1);
  return blogService.create.mock.calls[0][0];
}

describe('온보딩 샘플 게시글 HTML 이스케이프', () => {
  it('BS-OH-01: 테넌트 이름의 태그는 본문에 요소가 아닌 텍스트로 삽입된다', async () => {
    const post = await samplePostFor('<img src=x onerror=alert(1)>');

    expect(post.content).toContain('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>');
    expect(post.content).not.toContain('<img');
  });

  it('BS-OH-02: 본문에 삽입하는 & " \' 문자도 이스케이프한다', async () => {
    const post = await samplePostFor(`Tom & "Jerry" 's`);

    expect(post.content).toContain('<strong>Tom &amp; &quot;Jerry&quot; &#39;s</strong>');
  });

  it('BS-OH-03: 텍스트 필드인 제목·요약은 원문을 유지하고, 템플릿 태그는 그대로 둔다', async () => {
    const name = 'Tom & Jerry';
    const post = await samplePostFor(name);

    expect(post.title).toBe(`${name} 블로그에 오신 것을 환영합니다!`);
    expect(post.excerpt).toBe(`${name} 블로그의 첫 번째 게시글입니다.`);
    expect(post.content.startsWith('<h2>안녕하세요!</h2><p><strong>')).toBe(true);
  });
});
