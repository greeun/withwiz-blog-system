/**
 * 테넌트 라우트 핸들러 통합 테스트 (10건)
 *
 * createTenantRoutes()로 생성된 핸들러를 실제 Request 객체로 호출하여
 * Response 상태 코드와 JSON 응답을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 미들웨어 모킹 ──

vi.mock('@withwiz/toolkit/middleware/wrappers', () => ({
  withAdminApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = {
        request: req,
        user: { id: 'admin-1', role: 'SUPER_ADMIN', email: 'admin@test.com' },
        metadata: {},
      };
      return handler(context, props);
    };
  }),
}));

vi.mock('@withwiz/toolkit/utils/api-helpers', () => ({
  parsePagination: vi.fn((req: Request) => {
    const url = new URL(req.url);
    return {
      page: parseInt(url.searchParams.get('page') ?? '1', 10),
      limit: parseInt(url.searchParams.get('limit') ?? '10', 10),
    };
  }),
  getSearchParam: vi.fn((req: Request, key: string) => {
    const url = new URL(req.url);
    return url.searchParams.get(key) ?? null;
  }),
}));

import { createTenantRoutes } from '@withwiz/blog-system/routes';
import { TenantRole } from '@withwiz/blog-system/types';

// ── Mock 서비스 팩토리 ──

function createMockTenantService() {
  return {
    listAll: vi.fn().mockResolvedValue({
      items: [{ id: 't-1', name: '테스트 테넌트', slug: 'test-tenant' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasMore: false },
    }),
    create: vi.fn().mockImplementation(async (data: any) => {
      if (data.slug === 'duplicate') {
        throw new Error('이미 사용 중인 슬러그입니다.');
      }
      return { id: 't-new', name: data.name, slug: data.slug, isActive: true };
    }),
    getById: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'not-found') return null;
      return { id, name: '테스트 테넌트', slug: 'test', isActive: true };
    }),
    update: vi.fn().mockResolvedValue({
      id: 't-1',
      name: '수정된 테넌트',
    }),
    deactivate: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({
      blogConfig: { categories: { general: { label: '일반' } } },
    }),
    updateSettings: vi.fn().mockResolvedValue({
      blogConfig: { categories: { general: { label: '일반' }, tech: { label: '기술' } } },
    }),
    getBySlug: vi.fn(),
    getByCustomDomain: vi.fn(),
  } as any;
}

function createMockTenantUserService() {
  return {
    listUsers: vi.fn().mockResolvedValue({
      items: [{ id: 'tu-1', userId: 'u-1', tenantId: 't-1', role: TenantRole.OWNER }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasMore: false },
    }),
    addUser: vi.fn().mockResolvedValue({
      id: 'tu-new',
      userId: 'u-2',
      tenantId: 't-1',
      role: TenantRole.EDITOR,
    }),
    updateRole: vi.fn().mockResolvedValue({
      id: 'tu-1',
      userId: 'u-2',
      tenantId: 't-1',
      role: TenantRole.ADMIN,
    }),
    removeUser: vi.fn().mockResolvedValue(undefined),
    getUserRole: vi.fn(),
    getUserTenants: vi.fn(),
    hasPermission: vi.fn(),
  } as any;
}

describe('테넌트 라우트 핸들러', () => {
  let tenantService: ReturnType<typeof createMockTenantService>;
  let tenantUserService: ReturnType<typeof createMockTenantUserService>;
  let routes: ReturnType<typeof createTenantRoutes>;

  beforeEach(() => {
    tenantService = createMockTenantService();
    tenantUserService = createMockTenantUserService();
    routes = createTenantRoutes(tenantService, tenantUserService);
  });

  // ── 테넌트 목록 ──

  it('BS-TR-01: 테넌트 목록 — GET → 페이지네이션 목록 반환', async () => {
    const req = new Request('http://localhost/api/admin/tenants?page=1');
    const res = await routes.list.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  // ── 테넌트 생성 ──

  it('BS-TR-02: 테넌트 생성 — POST 유효 → 201', async () => {
    const req = new Request('http://localhost/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '새 테넌트', slug: 'new-tenant' }),
    });
    const res = await routes.create.POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('new-tenant');
  });

  it('BS-TR-03: 테넌트 생성 — POST 중복 slug → 400', async () => {
    const req = new Request('http://localhost/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '중복', slug: 'duplicate' }),
    });
    const res = await routes.create.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── 테넌트 상세 ──

  it('BS-TR-04: 테넌트 상세 — GET with id → 테넌트 정보', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1');
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.detail.GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('t-1');
  });

  // ── 테넌트 비활성화 ──

  it('BS-TR-05: 테넌트 비활성화 — PATCH → 비활성화 메시지', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/deactivate', {
      method: 'PATCH',
    });
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.deactivate.PATCH(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('비활성화');
    expect(tenantService.deactivate).toHaveBeenCalledWith('t-1');
  });

  // ── 설정 조회/수정 ──

  it('BS-TR-06: 설정 조회 — GET → 테넌트 설정 반환', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/settings');
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.settings.GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.blogConfig).toBeDefined();
  });

  it('BS-TR-07: 설정 수정 — PUT → 수정된 설정 반환', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blogConfig: {
          categories: { general: { label: '일반' }, tech: { label: '기술' } },
        },
      }),
    });
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.settings.PUT(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ── 사용자 관리 ──

  it('BS-TR-08: 사용자 추가 — POST → 201', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u-2', role: TenantRole.EDITOR }),
    });
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.users.add.POST(req, props);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe(TenantRole.EDITOR);
  });

  it('BS-TR-09: 사용자 역할 변경 — PATCH → 역할 업데이트', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/users/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u-2', role: TenantRole.ADMIN }),
    });
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.users.updateRole.PATCH(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.role).toBe(TenantRole.ADMIN);
  });

  it('BS-TR-10: 사용자 제거 — DELETE → 제거 메시지', async () => {
    const req = new Request('http://localhost/api/admin/tenants/t-1/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u-2' }),
    });
    const props = { params: Promise.resolve({ id: 't-1' }) };

    const res = await routes.users.remove.DELETE(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('제거');
  });
});
