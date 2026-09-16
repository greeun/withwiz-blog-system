/**
 * Task 17: admin-routes 헬퍼 테스트 (6건)
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
});
