/**
 * Task 17: admin-routes 헬퍼 테스트 (11건)
 *
 * verifySuperAdmin, safeCount는 비공개 함수이므로
 * createSuperAdminRoutes 반환 핸들러를 통해 간접 테스트한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withAuthApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 10 }),
  getSearchParam: vi.fn().mockReturnValue(null),
}));

import { createSuperAdminRoutes } from '@withwiz/blog-system/routes';
import { SystemRole } from '@withwiz/blog-system/types';

function createMockTenantService() {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    getByCustomDomain: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    listAll: vi.fn().mockResolvedValue({
      items: [],
      page: 1, limit: 10, total: 0, totalPages: 0,
    }),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  } as any;
}

function createMockTenantUserService() {
  return {
    addUser: vi.fn(),
    removeUser: vi.fn(),
    updateRole: vi.fn(),
    listUsers: vi.fn().mockResolvedValue({
      items: [],
      page: 1, limit: 20, total: 0, totalPages: 0,
    }),
    getUserRole: vi.fn(),
    getUserTenants: vi.fn().mockResolvedValue([]),
    hasPermission: vi.fn(),
  } as any;
}

function createMockDelegate() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

function createMockPrisma() {
  return {
    tenant: createMockDelegate(),
    user: createMockDelegate(),
    news: createMockDelegate(),
    $transaction: vi.fn(),
  } as any;
}

describe('admin-routes 헬퍼', () => {
  let tenantService: ReturnType<typeof createMockTenantService>;
  let tenantUserService: ReturnType<typeof createMockTenantUserService>;
  let prisma: ReturnType<typeof createMockPrisma>;
  let routes: ReturnType<typeof createSuperAdminRoutes>;

  beforeEach(() => {
    tenantService = createMockTenantService();
    tenantUserService = createMockTenantUserService();
    prisma = createMockPrisma();
    routes = createSuperAdminRoutes(tenantService, tenantUserService, prisma);
  });

  // ── verifySuperAdmin 간접 테스트 ──
  it('BS-AR-01: verifySuperAdmin — SUPER_ADMIN 역할 → 정상 응답', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/dashboard'),
      user: { id: 'u-1', role: SystemRole.SUPER_ADMIN },
      metadata: {},
    };

    const response = await routes.dashboard.GET(context as any);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('BS-AR-02: verifySuperAdmin — USER 역할 → 403 응답', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/dashboard'),
      user: { id: 'u-1', role: 'USER' },
      metadata: {},
    };

    const response = await routes.dashboard.GET(context as any);
    expect(response.status).toBe(403);
  });

  it('BS-AR-03: verifySuperAdmin — role 없음 → 403 응답', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/dashboard'),
      user: undefined,
      metadata: {},
    };

    const response = await routes.dashboard.GET(context as any);
    expect(response.status).toBe(403);
  });

  // ── safeCount 간접 테스트 ──
  it('BS-AR-04: safeCount — 존재하는 모델 → count 반환', async () => {
    prisma.news.count.mockResolvedValue(42);
    prisma.tenant.count.mockResolvedValue(5);
    prisma.user.count.mockResolvedValue(10);

    const context = {
      request: new Request('http://localhost/api/admin/dashboard'),
      user: { id: 'u-1', role: SystemRole.SUPER_ADMIN },
      metadata: {},
    };

    const response = await routes.dashboard.GET(context as any);
    const body = await response.json();
    expect(body.data.stats.totalPosts).toBe(42);
  });

  it('BS-AR-05: safeCount — 존재하지 않는 모델 → 0 반환', async () => {
    // news 모델의 count를 삭제하여 "존재하지 않는 모델" 시뮬레이션
    const prismaNoModel = {
      ...prisma,
      news: undefined, // news 모델이 없는 상태
    };

    const routesNoModel = createSuperAdminRoutes(tenantService, tenantUserService, prismaNoModel);

    const context = {
      request: new Request('http://localhost/api/admin/dashboard'),
      user: { id: 'u-1', role: SystemRole.SUPER_ADMIN },
      metadata: {},
    };

    const response = await routesNoModel.dashboard.GET(context as any);
    const body = await response.json();
    // safeCount가 0을 반환해야 함
    expect(body.data.stats.totalPosts).toBe(0);
  });
  // ── users.list 응답 구조 ──
  it('BS-AR-06: users.list — 평면 PaginatedResult 구조 반환', async () => {
    prisma.user.count.mockResolvedValue(25);
    prisma.user.findMany.mockResolvedValue([{ id: 'u-1', email: 'a@example.com' }]);

    const context = {
      request: new Request('http://localhost/api/admin/users'),
      user: { id: 'u-1', role: SystemRole.SUPER_ADMIN },
      metadata: {},
    };

    const response = await routes.users.list.GET(context as any);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data).toMatchObject({ page: 1, limit: 10, total: 25, totalPages: 3 });
    expect(body.data.pagination).toBeUndefined();
  });

  // ── tenants.update 입력 검증 ──
  const superAdminPut = (body: unknown) => ({
    request: new Request('http://localhost/api/admin/tenants/t-1', { method: 'PUT', body: JSON.stringify(body) }),
    user: { id: 'super-1', role: SystemRole.SUPER_ADMIN },
    metadata: {},
  });
  const idProps = { params: Promise.resolve({ id: 't-1' }) };

  it('BS-AR-07: tenants.update — 스키마에 없는 필드는 버리고 검증된 값만 서비스에 넘긴다', async () => {
    tenantService.getById.mockResolvedValue({ id: 't-1' });
    tenantService.update.mockResolvedValue({ id: 't-1', name: '새 이름' });

    const response = await routes.tenants.update.PUT(
      superAdminPut({ name: '새 이름', customDomain: 'blog.custom.com', settings: { domainVerification: { status: 'verified' } }, id: 't-9' }) as any,
      idProps,
    );

    expect(response.status).toBe(200);
    expect(tenantService.update).toHaveBeenCalledWith('t-1', { name: '새 이름', customDomain: 'blog.custom.com' });
  });

  it('BS-AR-08: tenants.update — 형식이 틀린 값은 400 이고 서비스를 호출하지 않는다', async () => {
    const response = await routes.tenants.update.PUT(superAdminPut({ customDomain: 'invalid domain!!!' }) as any, idProps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details.customDomain).toBeDefined();
    expect(tenantService.getById).not.toHaveBeenCalled();
    expect(tenantService.update).not.toHaveBeenCalled();
  });

  it('BS-AR-09: tenants.update — 서비스의 도메인 중복 오류는 400 으로 응답한다', async () => {
    tenantService.getById.mockResolvedValue({ id: 't-1' });
    tenantService.update.mockRejectedValue(new Error('이미 다른 테넌트에서 사용 중인 도메인입니다: blog.custom.com'));

    const response = await routes.tenants.update.PUT(superAdminPut({ customDomain: 'blog.custom.com' }) as any, idProps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.message).toContain('이미 다른 테넌트에서 사용 중인 도메인');
  });

  // ── onboarding.create 입력 검증 ──
  const superAdminPost = (body: unknown) => ({
    request: new Request('http://localhost/api/admin/onboarding', { method: 'POST', body: JSON.stringify(body) }),
    user: { id: 'super-1', role: SystemRole.SUPER_ADMIN },
    metadata: {},
  });

  it('BS-AR-10: onboarding.create — 슬러그 규칙에 맞지 않으면 400 이고 온보딩하지 않는다', async () => {
    const onboardingService = { onboardTenant: vi.fn() };
    const withOnboarding = createSuperAdminRoutes(tenantService, tenantUserService, prisma, onboardingService as any);

    const response = await withOnboarding.onboarding.create.POST(
      superAdminPost({ tenantName: '나의 블로그', tenantSlug: '나의-블로그', ownerUserId: 'u-1' }) as any,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details.tenantSlug).toBeDefined();
    expect(onboardingService.onboardTenant).not.toHaveBeenCalled();
  });

  it('BS-AR-11: onboarding.create — 유효한 입력은 검증된 값으로 온보딩하고 createSamplePost 기본값은 false 이다', async () => {
    const onboardingService = { onboardTenant: vi.fn().mockResolvedValue({ tenant: { id: 't-new' } }) };
    const withOnboarding = createSuperAdminRoutes(tenantService, tenantUserService, prisma, onboardingService as any);

    const response = await withOnboarding.onboarding.create.POST(
      superAdminPost({ tenantName: '나의 블로그', tenantSlug: 'my-blog', ownerUserId: 'u-1', extra: 'x' }) as any,
    );

    expect(response.status).toBe(201);
    expect(onboardingService.onboardTenant).toHaveBeenCalledWith({
      tenantName: '나의 블로그',
      tenantSlug: 'my-blog',
      ownerUserId: 'u-1',
      createSamplePost: false,
    });
  });
});
