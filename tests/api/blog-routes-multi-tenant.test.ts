/**
 * 멀티 테넌트 블로그 라우트 테넌트 해석·인가 계약 테스트 (15개 시나리오)
 *
 * createBlogRoutes 에 세 번째 인자(multiTenantConfig)를 전달하면, 모든 핸들러가
 * 요청 호스트명으로 테넌트를 해석한 뒤 해당 테넌트의 스코프 서비스를 사용해야 한다.
 * 관리 라우트는 JWT 역할이 아니라 그 테넌트의 멤버십 역할로 인가한다.
 * 조회는 VIEWER 이상, 쓰기는 EDITOR 이상이 필요하다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({
  user: { id: 'u-1', role: 'USER', email: 'u1@test.com' } as undefined | { id: string; role: string; email: string },
}));

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => {
  const wrap = (withUser: boolean) => (handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: withUser ? auth.user : undefined, metadata: {} }, props);
  return {
    withPublicApi: vi.fn(wrap(false)),
    withAdminApi: vi.fn(wrap(true)),
    withAuthApi: vi.fn(wrap(true)),
  };
});

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn(() => ({ page: 1, limit: 12 })),
  getSearchParam: vi.fn((req: Request, key: string) => new URL(req.url).searchParams.get(key)),
}));

vi.mock('@withwiz/blog-core/validators', () => ({
  CreateBlogPostSchema: { safeParse: vi.fn((data: any) => ({ success: true, data })) },
  UpdateBlogPostSchema: { safeParse: vi.fn((data: any) => ({ success: true, data })) },
  BulkUpdateSchema: { safeParse: vi.fn((data: any) => ({ success: true, data })) },
}));

import { createBlogRoutes } from '@withwiz/blog-system/routes';
import { TenantRole } from '@withwiz/blog-system/types';
import { withAdminApi, withAuthApi } from '@withwiz/toolkit/next/middleware/wrappers';

const TENANT = { id: 't-1', slug: 'my-blog', isActive: true };
const HOST = 'http://my-blog.blog.example.com';

const EMPTY_PAGE = { items: [], page: 1, limit: 12, total: 0, totalPages: 0 };

function setup(
  resolvedTenant: typeof TENANT | null,
  options: { role?: TenantRole | null; withMembership?: boolean } = {},
) {
  const { role = TenantRole.EDITOR, withMembership = true } = options;
  const scoped = {
    listPublished: vi.fn().mockResolvedValue(EMPTY_PAGE),
    listAll: vi.fn().mockResolvedValue(EMPTY_PAGE),
    getById: vi.fn().mockResolvedValue({ id: 'post-1' }),
    create: vi.fn(async (data: any) => ({ id: 'post-1', ...data })),
    update: vi.fn(async (id: string, data: any) => ({ id, ...data })),
    remove: vi.fn().mockResolvedValue(undefined),
    removeMany: vi.fn().mockResolvedValue(1),
    togglePublish: vi.fn().mockResolvedValue({ id: 'post-1', published: true }),
    bulkUpdatePublished: vi.fn().mockResolvedValue(1),
    bulkUpdateFeatured: vi.fn().mockResolvedValue(1),
    checkSlugAvailable: vi.fn().mockResolvedValue(true),
    getDashboardStats: vi.fn().mockResolvedValue({
      total: 0, published: 0, unpublished: 0, byCategory: {}, recentPosts: [],
    }),
  };
  const tenantUserService = {
    getUserRole: vi.fn().mockResolvedValue(role),
  };
  const createScopedService = vi.fn(() => scoped as any);
  const tenantResolver = {
    resolveFromSubdomain: vi.fn(),
    resolveFromCustomDomain: vi.fn(),
    resolveFromSlug: vi.fn(),
    resolve: vi.fn().mockResolvedValue(resolvedTenant),
  };
  const routes = createBlogRoutes(null as any, { pageSize: 12 }, {
    createScopedService,
    tenantResolver: tenantResolver as any,
    baseDomain: 'blog.example.com',
    ...(withMembership && { tenantUserService: tenantUserService as any }),
  });
  return { routes, scoped, createScopedService, tenantResolver, tenantUserService };
}

describe('멀티 테넌트 블로그 라우트 테넌트 해석', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: 'u-1', role: 'USER', email: 'u1@test.com' };
  });

  it('BS-MT-01: 테넌트를 해석하지 못하면 public.list.GET 은 404 이고 스코프 서비스를 만들지 않는다', async () => {
    const { routes, createScopedService } = setup(null);

    const res = await routes.public.list.GET(new Request(`${HOST}/api/blog`));

    expect(res.status).toBe(404);
    expect((await res.json()).error.message).toBe('테넌트를 찾을 수 없습니다.');
    expect(createScopedService).not.toHaveBeenCalled();
  });

  it('BS-MT-02: 테넌트를 해석하면 그 테넌트의 스코프 서비스로 게시글을 조회한다', async () => {
    const { routes, scoped, createScopedService, tenantResolver } = setup(TENANT);

    const res = await routes.public.list.GET(new Request(`${HOST}/api/blog`));

    expect(res.status).toBe(200);
    expect(tenantResolver.resolve).toHaveBeenCalledWith('my-blog.blog.example.com', 'blog.example.com');
    expect(createScopedService).toHaveBeenCalledTimes(1);
    expect(createScopedService).toHaveBeenCalledWith('t-1');
    expect(scoped.listPublished).toHaveBeenCalledTimes(1);
  });

  it('BS-MT-03: admin.list.POST 는 스코프 서비스 create 에 요청자 ID 를 전달하고 201 이다', async () => {
    const { routes, scoped } = setup(TENANT);
    const body = { title: '제목', slug: 'slug', category: 'notice', content: '<p>x</p>' };

    const res = await routes.admin.list.POST(
      new Request(`${HOST}/api/admin/blog`, { method: 'POST', body: JSON.stringify(body) }),
    );

    expect(res.status).toBe(201);
    expect(scoped.create).toHaveBeenCalledWith(body, 'u-1');
  });

  it('BS-MT-04: 테넌트를 해석한 뒤 admin.slugCheck.GET 의 slug 누락을 400 으로 거부한다', async () => {
    const { routes, scoped, createScopedService } = setup(TENANT);

    const res = await routes.admin.slugCheck.GET(new Request(`${HOST}/api/admin/blog/slug-check`));

    expect(res.status).toBe(400);
    expect(createScopedService).toHaveBeenCalledWith('t-1');
    expect(scoped.checkSlugAvailable).not.toHaveBeenCalled();
  });

  it('BS-MT-05: 테넌트를 해석하지 못하면 admin.detail.DELETE 는 404 이고 삭제하지 않는다', async () => {
    const { routes, scoped } = setup(null);

    const res = await routes.admin.detail.DELETE(
      new Request(`${HOST}/api/admin/blog/post-1`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'post-1' }) },
    );

    expect(res.status).toBe(404);
    expect(scoped.remove).not.toHaveBeenCalled();
  });

  it('BS-MT-06: 스코프 서비스의 BlogError 409 는 상태 코드와 오류 코드를 보존한다', async () => {
    const { routes, scoped } = setup(TENANT);
    scoped.create.mockRejectedValueOnce(
      Object.assign(new Error('이미 사용 중인 슬러그입니다.'), { code: 'DUPLICATE_SLUG', statusCode: 409 }),
    );

    const res = await routes.admin.list.POST(
      new Request(`${HOST}/api/admin/blog`, { method: 'POST', body: JSON.stringify({ title: 't', slug: 's' }) }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DUPLICATE_SLUG');
  });
});

// ── 관리 라우트 인가 ──

type Call = (routes: ReturnType<typeof createBlogRoutes>) => Promise<Response>;

const idProps = () => ({ params: Promise.resolve({ id: 'post-1' }) });
const jsonRequest = (path: string, method: string, body: unknown) =>
  new Request(`${HOST}${path}`, { method, body: JSON.stringify(body) });

/** VIEWER 이상이면 호출할 수 있는 조회 라우트 */
const READ_ROUTES: Array<[string, Call]> = [
  ['list.GET', (r) => r.admin.list.GET(new Request(`${HOST}/api/admin/blog`))],
  ['detail.GET', (r) => r.admin.detail.GET(new Request(`${HOST}/api/admin/blog/post-1`), idProps())],
  ['slugCheck.GET', (r) => r.admin.slugCheck.GET(new Request(`${HOST}/api/admin/blog/slug-check?slug=a`))],
  ['dashboard.GET', (r) => r.admin.dashboard.GET(new Request(`${HOST}/api/admin/blog/dashboard`))],
];

/** EDITOR 이상이어야 호출할 수 있는 쓰기 라우트 */
const WRITE_ROUTES: Array<[string, Call]> = [
  ['list.POST', (r) => r.admin.list.POST(jsonRequest('/api/admin/blog', 'POST', { title: 't', slug: 's' }))],
  ['list.DELETE', (r) => r.admin.list.DELETE(jsonRequest('/api/admin/blog', 'DELETE', { ids: ['post-1'] }))],
  ['detail.PUT', (r) => r.admin.detail.PUT(jsonRequest('/api/admin/blog/post-1', 'PUT', { title: 't' }), idProps())],
  ['detail.DELETE', (r) => r.admin.detail.DELETE(new Request(`${HOST}/api/admin/blog/post-1`, { method: 'DELETE' }), idProps())],
  ['publish.PATCH', (r) => r.admin.publish.PATCH(new Request(`${HOST}/api/admin/blog/post-1/publish`, { method: 'PATCH' }), idProps())],
  ['bulk.PATCH', (r) => r.admin.bulk.PATCH(jsonRequest('/api/admin/blog/bulk', 'PATCH', { ids: ['post-1'], published: true }))],
  ['bulk.DELETE', (r) => r.admin.bulk.DELETE(jsonRequest('/api/admin/blog/bulk', 'DELETE', { ids: ['post-1'] }))],
];

describe('멀티 테넌트 블로그 관리 라우트 인가', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { id: 'u-1', role: 'USER', email: 'u1@test.com' };
  });

  it('BS-MT-07: 관리 라우트는 요청 호스트명의 테넌트와 요청자 ID 로 멤버십을 확인한다', async () => {
    const { routes, tenantUserService } = setup(TENANT);

    const res = await routes.admin.list.GET(new Request(`${HOST}/api/admin/blog`));

    expect(res.status).toBe(200);
    expect(tenantUserService.getUserRole).toHaveBeenCalledWith('t-1', 'u-1');
  });

  it('BS-MT-08: 테넌트에 소속되지 않은 사용자는 JWT 역할이 ADMIN 이어도 403 이고 스코프 서비스를 만들지 않는다', async () => {
    auth.user = { id: 'u-1', role: 'ADMIN', email: 'u1@test.com' };
    const { routes, createScopedService } = setup(TENANT, { role: null });

    const res = await routes.admin.list.GET(new Request(`${HOST}/api/admin/blog`));

    expect(res.status).toBe(403);
    expect(createScopedService).not.toHaveBeenCalled();
  });

  it('BS-MT-09: SUPER_ADMIN 도 테넌트 멤버십이 없으면 403 이다', async () => {
    auth.user = { id: 'super-1', role: 'SUPER_ADMIN', email: 'super@test.com' };
    const { routes, scoped } = setup(TENANT, { role: null });

    const res = await routes.admin.list.POST(jsonRequest('/api/admin/blog', 'POST', { title: 't', slug: 's' }));

    expect(res.status).toBe(403);
    expect(scoped.create).not.toHaveBeenCalled();
  });

  it.each(READ_ROUTES)('BS-MT-10: VIEWER 는 조회 라우트 %s 를 호출할 수 있다', async (_name, call) => {
    const { routes, createScopedService } = setup(TENANT, { role: TenantRole.VIEWER });

    const res = await call(routes);

    expect(res.status).toBe(200);
    expect(createScopedService).toHaveBeenCalledWith('t-1');
  });

  it.each(WRITE_ROUTES)('BS-MT-11: VIEWER 는 쓰기 라우트 %s 에서 403 이고 스코프 서비스를 만들지 않는다', async (_name, call) => {
    const { routes, createScopedService } = setup(TENANT, { role: TenantRole.VIEWER });

    const res = await call(routes);

    expect(res.status).toBe(403);
    expect(createScopedService).not.toHaveBeenCalled();
  });

  it.each(WRITE_ROUTES)('BS-MT-12: EDITOR 는 쓰기 라우트 %s 를 호출할 수 있다', async (_name, call) => {
    const { routes, createScopedService } = setup(TENANT, { role: TenantRole.EDITOR });

    const res = await call(routes);

    expect(res.status).toBeLessThan(300);
    expect(createScopedService).toHaveBeenCalledWith('t-1');
  });

  it('BS-MT-13: 멤버십 서비스를 전달하지 않으면 관리 라우트는 403 이다 (fail-closed)', async () => {
    const { routes, createScopedService } = setup(TENANT, { withMembership: false });

    const res = await routes.admin.list.GET(new Request(`${HOST}/api/admin/blog`));

    expect(res.status).toBe(403);
    expect(createScopedService).not.toHaveBeenCalled();
  });

  it('BS-MT-14: 인증 정보가 없으면 관리 라우트는 401 이다', async () => {
    auth.user = undefined;
    const { routes, tenantUserService } = setup(TENANT);

    const res = await routes.admin.list.GET(new Request(`${HOST}/api/admin/blog`));

    expect(res.status).toBe(401);
    expect(tenantUserService.getUserRole).not.toHaveBeenCalled();
  });

  it('BS-MT-15: multi 모드 관리 라우트는 withAuthApi 로, single 모드 관리 라우트는 withAdminApi 로 감싼다', () => {
    setup(TENANT);
    expect(withAuthApi).toHaveBeenCalledTimes(11);
    expect(withAdminApi).not.toHaveBeenCalled();

    vi.clearAllMocks();
    createBlogRoutes({} as any, { pageSize: 12 });
    expect(withAdminApi).toHaveBeenCalledTimes(11);
    expect(withAuthApi).not.toHaveBeenCalled();
  });
});
