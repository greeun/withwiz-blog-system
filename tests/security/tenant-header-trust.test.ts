/**
 * X-Tenant-Id 헤더 신뢰 범위 보안 테스트
 *
 * 외부 요청이 헤더만으로 테넌트를 지정할 수 없어야 한다.
 * - 테넌트 해석은 resolveTenantFromRequest 한 곳에서 호스트명(커스텀 도메인·서브도메인)으로만 한다.
 * - 테넌트 역할 미들웨어는 요청 헤더가 아니라 앞선 미들웨어가 확정한 context.metadata.tenantId 만 신뢰한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'u-1', role: 'ADMIN', email: 'u1@test.com' } as undefined | { id: string; role: string; email: string },
}));

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => {
  const wrap = (withUser: boolean) => (handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: withUser ? auth.user : undefined, metadata: {} }, props);
  return { withPublicApi: vi.fn(wrap(false)), withAdminApi: vi.fn(wrap(true)), withAuthApi: vi.fn(wrap(true)) };
});

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn(() => ({ page: 1, limit: 10 })),
  getSearchParam: vi.fn((req: Request, key: string) => new URL(req.url).searchParams.get(key)),
}));

import { createBlogRoutes } from '@withwiz/blog-system/routes';
import {
  createTenantResolver,
  createTenantResolutionMiddleware,
  resolveTenantFromRequest,
  TENANT_ID_HEADER,
  TENANT_SLUG_HEADER,
} from '@withwiz/blog-system/tenant';
import { createTenantRoleMiddleware } from '@withwiz/blog-system/auth';
import { createBlogSystem } from '@withwiz/blog-system/core';
import { TenantRole } from '@withwiz/blog-system/types';

const BASE_DOMAIN = 'blog.example.com';
const TENANT_A = { id: 'id-a', slug: 'tenant-a', customDomain: null, isActive: true };
const TENANT_B = { id: 'id-b', slug: 'tenant-b', customDomain: null, isActive: true };

function createPrisma() {
  const tenants = [TENANT_A, TENANT_B];
  const find = vi.fn(async ({ where }: any) =>
    tenants.find((t) =>
      (where.slug === undefined || t.slug === where.slug) &&
      (where.customDomain === undefined || t.customDomain === where.customDomain),
    ) ?? null,
  );
  return {
    tenant: { findFirst: find, findMany: vi.fn(), findUnique: vi.fn() },
    tenantUser: { findUnique: vi.fn().mockResolvedValue({ role: TenantRole.OWNER }), findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  } as any;
}

function createScopedServiceFactory() {
  const scoped = {
    listPublished: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
    listAll: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
  };
  return { scoped, createScopedService: vi.fn(() => scoped as any) };
}

function hostRequest(host: string, headers: Record<string, string> = {}) {
  return new Request(`http://${host}/api/blog`, { headers });
}

function createContext(overrides: { headers?: Record<string, string>; metadata?: Record<string, unknown>; url?: string }) {
  return {
    request: new Request(overrides.url ?? `http://tenant-a.${BASE_DOMAIN}/api/test`, { headers: overrides.headers ?? {} }),
    user: auth.user,
    metadata: overrides.metadata ?? {},
  } as any;
}

beforeEach(() => {
  auth.user = { id: 'u-1', role: 'ADMIN', email: 'u1@test.com' };
});

describe('블로그 라우트 테넌트 해석', () => {
  it('BS-TH-01: admin 라우트는 X-Tenant-Id 헤더를 무시하고 호스트명의 테넌트로 스코프를 만든다', async () => {
    const prisma = createPrisma();
    const { scoped, createScopedService } = createScopedServiceFactory();
    const routes = createBlogRoutes(null as any, {}, {
      createScopedService,
      tenantResolver: createTenantResolver(prisma),
      baseDomain: BASE_DOMAIN,
    });

    const res = await routes.admin.list.GET(hostRequest(`tenant-a.${BASE_DOMAIN}`, { [TENANT_ID_HEADER]: 'tenant-b' }));

    expect(res.status).toBe(200);
    expect(createScopedService).toHaveBeenCalledTimes(1);
    expect(createScopedService).toHaveBeenCalledWith('id-a');
    expect(scoped.listAll).toHaveBeenCalled();
    expect(prisma.tenant.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slug: 'tenant-b' }) }),
    );
  });

  it('BS-TH-02: public 라우트도 헤더가 아닌 호스트명의 테넌트 게시글을 조회한다', async () => {
    const prisma = createPrisma();
    const { scoped, createScopedService } = createScopedServiceFactory();
    const routes = createBlogRoutes(null as any, {}, {
      createScopedService,
      tenantResolver: createTenantResolver(prisma),
      baseDomain: BASE_DOMAIN,
    });

    await routes.public.list.GET(
      hostRequest(`tenant-a.${BASE_DOMAIN}`, { [TENANT_ID_HEADER]: 'tenant-b', [TENANT_SLUG_HEADER]: 'tenant-b' }),
    );

    expect(createScopedService).toHaveBeenCalledWith('id-a');
    expect(scoped.listPublished).toHaveBeenCalledTimes(1);
  });

  it('BS-TH-03: 호스트명으로 테넌트를 찾지 못하면 헤더가 있어도 404 이다', async () => {
    const prisma = createPrisma();
    const { createScopedService } = createScopedServiceFactory();
    const routes = createBlogRoutes(null as any, {}, {
      createScopedService,
      tenantResolver: createTenantResolver(prisma),
      baseDomain: BASE_DOMAIN,
    });

    const res = await routes.admin.list.GET(hostRequest('unknown.example.com', { [TENANT_ID_HEADER]: 'tenant-b' }));

    expect(res.status).toBe(404);
    expect(createScopedService).not.toHaveBeenCalled();
  });

  it('BS-TH-04: resolveTenantFromRequest 는 헤더로 슬러그 조회를 하지 않고 호스트명으로만 해석한다', async () => {
    const resolver = {
      resolveFromSubdomain: vi.fn(),
      resolveFromCustomDomain: vi.fn(),
      resolveFromSlug: vi.fn().mockResolvedValue(TENANT_B),
      resolve: vi.fn().mockResolvedValue(TENANT_A),
    };

    const result = await resolveTenantFromRequest(
      hostRequest(`tenant-a.${BASE_DOMAIN}`, { [TENANT_ID_HEADER]: 'tenant-b' }),
      resolver as any,
      BASE_DOMAIN,
    );

    expect(result).toEqual({ tenantId: 'id-a', tenant: TENANT_A });
    expect(resolver.resolveFromSlug).not.toHaveBeenCalled();
    expect(resolver.resolve).toHaveBeenCalledWith(`tenant-a.${BASE_DOMAIN}`, BASE_DOMAIN);
  });
});

describe('테넌트 역할 미들웨어의 테넌트 출처', () => {
  function createTenantUserService(role: TenantRole | null = TenantRole.OWNER) {
    return { getUserRole: vi.fn().mockResolvedValue(role), hasPermission: vi.fn() } as any;
  }

  it('BS-TH-05: 헤더만 있고 확정된 metadata.tenantId 가 없으면 400 이며 역할을 조회하지 않는다', async () => {
    const service = createTenantUserService();
    const next = vi.fn();

    const res = await createTenantRoleMiddleware(service, TenantRole.EDITOR)(
      createContext({ headers: { [TENANT_ID_HEADER]: 'id-b' } }),
      next,
    );

    expect(res.status).toBe(400);
    expect(service.getUserRole).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('BS-TH-06: 헤더와 metadata.tenantId 가 다르면 metadata 값으로 역할을 확인한다', async () => {
    const service = createTenantUserService();
    const next = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const context = createContext({ headers: { [TENANT_ID_HEADER]: 'id-b' }, metadata: { tenantId: 'id-a' } });

    await createTenantRoleMiddleware(service, TenantRole.EDITOR)(context, next);

    expect(service.getUserRole).toHaveBeenCalledWith('id-a', 'u-1');
    expect(context.metadata.tenantId).toBe('id-a');
    expect(next).toHaveBeenCalled();
  });

  it('BS-TH-07: createTenantResolutionMiddleware 는 호스트명으로 테넌트를 확정해 metadata 에 기록한다', async () => {
    const resolver = createTenantResolver(createPrisma());
    const middleware = createTenantResolutionMiddleware(resolver, BASE_DOMAIN);

    const context = createContext({ headers: { [TENANT_ID_HEADER]: 'id-b' } });
    const next = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await middleware(context, next);
    expect(context.metadata.tenantId).toBe('id-a');
    expect(context.metadata.tenant).toEqual(TENANT_A);
    expect(next).toHaveBeenCalledTimes(1);

    const unknown = createContext({ url: 'http://unknown.example.com/api/test', headers: { [TENANT_ID_HEADER]: 'id-b' } });
    const nextUnknown = vi.fn();
    const res = await middleware(unknown, nextUnknown);
    expect(res.status).toBe(404);
    expect(unknown.metadata.tenantId).toBeUndefined();
    expect(nextUnknown).not.toHaveBeenCalled();
  });

  it('BS-TH-08: multi 모드 requireTenantRole 은 호스트명으로 테넌트를 확정한 뒤 역할을 확인한다', async () => {
    const prisma = createPrisma();
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
      domain: { baseDomain: BASE_DOMAIN },
    });
    const middleware = system.middleware.requireTenantRole!(TenantRole.ADMIN);

    const context = createContext({ headers: { [TENANT_ID_HEADER]: 'id-b' } });
    const next = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const res = await middleware(context, next);

    expect(res.status).toBe(200);
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId_userId: { tenantId: 'id-a', userId: 'u-1' } } }),
    );
    expect(context.metadata.tenantId).toBe('id-a');

    const unknown = createContext({ url: 'http://unknown.example.com/api/test', headers: { [TENANT_ID_HEADER]: 'id-b' } });
    const unknownRes = await middleware(unknown, vi.fn());
    expect(unknownRes.status).toBe(404);
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledTimes(1);
  });
});
