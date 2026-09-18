/**
 * 멀티 테넌트 블로그 라우트 테넌트 해석 계약 테스트 (6건)
 *
 * createBlogRoutes 에 세 번째 인자(multiTenantConfig)를 전달하면, 모든 핸들러가
 * 요청 호스트명으로 테넌트를 해석한 뒤 해당 테넌트의 스코프 서비스를 사용해야 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: undefined, metadata: {} }, props),
  ),
  withAdminApi: vi.fn((handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: { id: 'u-1', role: 'ADMIN', email: 'u1@test.com' }, metadata: {} }, props),
  ),
}));

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

const TENANT = { id: 't-1', slug: 'my-blog', isActive: true };
const HOST = 'http://my-blog.blog.example.com';

function setup(resolvedTenant: typeof TENANT | null) {
  const scoped = {
    listPublished: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 12, total: 0, totalPages: 0 }),
    create: vi.fn(async (data: any) => ({ id: 'post-1', ...data })),
    remove: vi.fn().mockResolvedValue(undefined),
    checkSlugAvailable: vi.fn().mockResolvedValue(true),
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
  });
  return { routes, scoped, createScopedService, tenantResolver };
}

describe('멀티 테넌트 블로그 라우트 테넌트 해석', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
