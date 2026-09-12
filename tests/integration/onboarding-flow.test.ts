/**
 * 온보딩 플로우 통합 테스트 (4건)
 *
 * createOnboardingService → tenantService → tenantUserService → blogService
 * 체인을 mock 서비스로 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createOnboardingService } from '@withwiz/blog-system/onboarding';
import { TenantRole } from '@withwiz/blog-system/types';

// ── Mock 서비스 팩토리 ──

function createMockTenantService() {
  return {
    create: vi.fn().mockImplementation(async (data: any) => ({
      id: 't-new',
      name: data.name,
      slug: data.slug,
      isActive: true,
      settings: data.settings ?? {},
      planId: data.planId ?? null,
      customDomain: null,
      logo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getByCustomDomain: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    listAll: vi.fn(),
    getSettings: vi.fn().mockImplementation(async (id: string) => {
      // 테넌트 생성 시 전달된 설정을 반환
      const lastCall = createMockTenantService._lastSettings;
      return lastCall ?? {};
    }),
    updateSettings: vi.fn(),
  } as any;
}
// 정적 속성 추가를 위한 네임스페이스
createMockTenantService._lastSettings = null as any;

function createMockTenantUserService() {
  return {
    addUser: vi.fn().mockImplementation(
      async (tenantId: string, userId: string, role: TenantRole) => ({
        id: 'tu-new',
        tenantId,
        userId,
        role,
        createdAt: new Date(),
      }),
    ),
    removeUser: vi.fn(),
    updateRole: vi.fn(),
    listUsers: vi.fn(),
    getUserRole: vi.fn(),
    getUserTenants: vi.fn(),
    hasPermission: vi.fn(),
  } as any;
}

function createMockBlogService() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'post-sample',
      title: '환영 게시글',
      slug: 'welcome',
      published: true,
    }),
    listPublished: vi.fn(),
    getPublishedBySlug: vi.fn(),
    getFeatured: vi.fn(),
    listAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
    togglePublish: vi.fn(),
    bulkUpdatePublished: vi.fn(),
    bulkUpdateFeatured: vi.fn(),
    checkSlugAvailable: vi.fn(),
    getDashboardStats: vi.fn(),
  } as any;
}

describe('온보딩 플로우', () => {
  let tenantService: ReturnType<typeof createMockTenantService>;
  let tenantUserService: ReturnType<typeof createMockTenantUserService>;
  let blogService: ReturnType<typeof createMockBlogService>;
  let createScopedBlogService: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenantService = createMockTenantService();
    tenantUserService = createMockTenantUserService();
    blogService = createMockBlogService();
    createScopedBlogService = vi.fn().mockReturnValue(blogService);
  });

  it('BS-OB-01: 전체 온보딩 — 테넌트 + 소유자 + 카테고리 + 샘플 포스트', async () => {
    const onboarding = createOnboardingService(
      tenantService,
      tenantUserService,
      createScopedBlogService,
    );

    const result = await onboarding.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-owner',
      createSamplePost: true,
    });

    // 테넌트 생성 확인
    expect(tenantService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '테스트 블로그',
        slug: 'test-blog',
      }),
    );
    expect(result.tenant.id).toBe('t-new');

    // 소유자 추가 확인
    expect(tenantUserService.addUser).toHaveBeenCalledWith(
      't-new',
      'u-owner',
      TenantRole.OWNER,
    );
    expect(result.tenantUser.role).toBe(TenantRole.OWNER);

    // 샘플 포스트 생성 확인
    expect(createScopedBlogService).toHaveBeenCalledWith('t-new');
    expect(blogService.create).toHaveBeenCalled();
    expect(result.samplePostId).toBe('post-sample');
  });

  it('BS-OB-02: 온보딩 — 샘플 포스트 없이', async () => {
    const onboarding = createOnboardingService(
      tenantService,
      tenantUserService,
      createScopedBlogService,
    );

    const result = await onboarding.onboardTenant({
      tenantName: '블로그 2',
      tenantSlug: 'blog-2',
      ownerUserId: 'u-owner',
      createSamplePost: false,
    });

    expect(result.tenant.id).toBe('t-new');
    expect(result.tenantUser.role).toBe(TenantRole.OWNER);
    expect(result.samplePostId).toBeUndefined();
    expect(blogService.create).not.toHaveBeenCalled();
  });

  it('BS-OB-03: 온보딩 — 커스텀 카테고리 적용', async () => {
    const onboarding = createOnboardingService(
      tenantService,
      tenantUserService,
      createScopedBlogService,
    );

    const customCategories = [
      { key: 'recipe', label: '레시피' },
      { key: 'review', label: '리뷰' },
    ];

    await onboarding.onboardTenant({
      tenantName: '요리 블로그',
      tenantSlug: 'cook-blog',
      ownerUserId: 'u-owner',
      categories: customCategories,
      createSamplePost: true,
    });

    // 테넌트 생성 시 커스텀 카테고리가 blogConfig에 포함되는지 확인
    const createCall = tenantService.create.mock.calls[0][0];
    expect(createCall.settings.blogConfig.categories).toBeDefined();
    expect(createCall.settings.blogConfig.categories.recipe).toEqual({
      label: '레시피',
    });
    expect(createCall.settings.blogConfig.categories.review).toEqual({
      label: '리뷰',
    });
  });

  it('BS-OB-04: 온보딩 — 테넌트 설정에 카테고리 포함 확인', async () => {
    const onboarding = createOnboardingService(
      tenantService,
      tenantUserService,
      createScopedBlogService,
    );

    await onboarding.onboardTenant({
      tenantName: '기본 블로그',
      tenantSlug: 'default-blog',
      ownerUserId: 'u-owner',
    });

    // 기본 카테고리로 테넌트가 생성되었는지 확인
    const createCall = tenantService.create.mock.calls[0][0];
    const categories = createCall.settings.blogConfig.categories;

    // 기본 카테고리(general, notice, tech)가 포함되어야 함
    expect(categories.general).toBeDefined();
    expect(categories.notice).toBeDefined();
    expect(categories.tech).toBeDefined();
  });
});
