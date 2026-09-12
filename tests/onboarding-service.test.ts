/**
 * Task 13: onboarding-service (createOnboardingService) 테스트 (7건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOnboardingService } from '@withwiz/blog-system/onboarding';
import { TenantRole } from '@withwiz/blog-system/types';

function createMockTenantService() {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getByCustomDomain: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    listAll: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  };
}

function createMockTenantUserService() {
  return {
    addUser: vi.fn(),
    removeUser: vi.fn(),
    updateRole: vi.fn(),
    listUsers: vi.fn(),
    getUserRole: vi.fn(),
    getUserTenants: vi.fn(),
    hasPermission: vi.fn(),
  };
}

function createMockBlogService() {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listAll: vi.fn(),
    listPublished: vi.fn(),
    getPublishedBySlug: vi.fn(),
    getFeatured: vi.fn(),
    togglePublish: vi.fn(),
    bulkUpdatePublished: vi.fn(),
    bulkUpdateFeatured: vi.fn(),
    removeMany: vi.fn(),
    checkSlugAvailable: vi.fn(),
    getDashboardStats: vi.fn(),
  };
}

const mockTenant = {
  id: 't-1',
  name: '테스트 블로그',
  slug: 'test-blog',
  customDomain: null,
  logo: null,
  settings: {},
  planId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTenantUser = {
  id: 'tu-1',
  userId: 'u-1',
  tenantId: 't-1',
  role: TenantRole.OWNER,
  createdAt: new Date(),
};

describe('createOnboardingService', () => {
  let tenantService: ReturnType<typeof createMockTenantService>;
  let tenantUserService: ReturnType<typeof createMockTenantUserService>;
  let mockBlogService: ReturnType<typeof createMockBlogService>;
  let createScopedBlogService: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createOnboardingService>;

  beforeEach(() => {
    tenantService = createMockTenantService();
    tenantUserService = createMockTenantUserService();
    mockBlogService = createMockBlogService();
    createScopedBlogService = vi.fn().mockReturnValue(mockBlogService);

    tenantService.create.mockResolvedValue(mockTenant);
    tenantUserService.addUser.mockResolvedValue(mockTenantUser);

    service = createOnboardingService(tenantService, tenantUserService, createScopedBlogService);
  });

  it('BS-OB-01: 기본 카테고리 적용 (categories 미제공 시)', async () => {
    const result = await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
    });

    const createCall = tenantService.create.mock.calls[0][0];
    const blogConfig = createCall.settings.blogConfig;
    expect(blogConfig.categories).toHaveProperty('general');
    expect(blogConfig.categories).toHaveProperty('notice');
    expect(blogConfig.categories).toHaveProperty('tech');
    expect(result.tenant).toEqual(mockTenant);
  });

  it('BS-OB-02: 커스텀 카테고리 적용', async () => {
    await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
      categories: [{ key: 'custom', label: '커스텀' }],
    });

    const createCall = tenantService.create.mock.calls[0][0];
    const blogConfig = createCall.settings.blogConfig;
    expect(blogConfig.categories).toHaveProperty('custom');
    expect(blogConfig.categories.custom).toEqual({ label: '커스텀' });
  });

  it('BS-OB-03: 샘플 게시글 생성 (createSamplePost=true)', async () => {
    mockBlogService.create.mockResolvedValue({ id: 'post-1' });
    const result = await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
      createSamplePost: true,
    });

    expect(createScopedBlogService).toHaveBeenCalledWith('t-1');
    expect(mockBlogService.create).toHaveBeenCalled();
    expect(result.samplePostId).toBe('post-1');
  });

  it('BS-OB-04: 샘플 게시글 생성 실패 → 온보딩 성공 유지', async () => {
    mockBlogService.create.mockRejectedValue(new Error('DB error'));
    const result = await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
      createSamplePost: true,
    });

    expect(result.tenant).toEqual(mockTenant);
    expect(result.samplePostId).toBeUndefined();
  });

  it('BS-OB-05: createSamplePost=false → samplePostId 없음', async () => {
    const result = await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
      createSamplePost: false,
    });

    expect(mockBlogService.create).not.toHaveBeenCalled();
    expect(result.samplePostId).toBeUndefined();
  });

  it('BS-OB-06: ownerUserId → OWNER 역할로 추가', async () => {
    await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
    });

    expect(tenantUserService.addUser).toHaveBeenCalledWith('t-1', 'u-1', TenantRole.OWNER);
  });

  it('BS-OB-07: planId 전달 시 테넌트에 반영', async () => {
    await service.onboardTenant({
      tenantName: '테스트 블로그',
      tenantSlug: 'test-blog',
      ownerUserId: 'u-1',
      planId: 'plan-1',
    });

    const createCall = tenantService.create.mock.calls[0][0];
    expect(createCall.planId).toBe('plan-1');
  });
});
