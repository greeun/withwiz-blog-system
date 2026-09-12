/**
 * 블로그 라우트 핸들러 통합 테스트 (13건)
 *
 * createBlogRoutes()로 생성된 핸들러를 실제 Request 객체로 호출하여
 * Response 상태 코드와 JSON 응답을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 미들웨어 모킹 ──

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = { request: req, user: undefined, metadata: {} };
      return handler(context, props);
    };
  }),
  withAdminApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = {
        request: req,
        user: { id: 'test-admin', role: 'ADMIN', email: 'admin@test.com' },
        metadata: {},
      };
      return handler(context, props);
    };
  }),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn((req: Request, defaultSize?: number) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const limit = parseInt(
      url.searchParams.get('limit') ?? String(defaultSize ?? 10),
      10,
    );
    return { page, limit };
  }),
  getSearchParam: vi.fn((req: Request, key: string) => {
    const url = new URL(req.url);
    return url.searchParams.get(key) ?? null;
  }),
}));

vi.mock('@withwiz/blog-core/validators', () => ({
  CreateBlogPostSchema: {
    safeParse: vi.fn((data: any) => {
      if (!data.title || !data.slug) {
        return {
          success: false,
          error: {
            flatten: () => ({
              fieldErrors: { title: ['필수'], slug: ['필수'] },
            }),
          },
        };
      }
      return { success: true, data };
    }),
  },
  UpdateBlogPostSchema: {
    safeParse: vi.fn((data: any) => ({ success: true, data })),
  },
  BulkUpdateSchema: {
    safeParse: vi.fn((data: any) => {
      if (!data.ids || !Array.isArray(data.ids)) {
        return {
          success: false,
          error: {
            flatten: () => ({ fieldErrors: { ids: ['ids 배열이 필요합니다'] } }),
          },
        };
      }
      return { success: true, data };
    }),
  },
}));

import { createBlogRoutes } from '@withwiz/blog-system/routes';

// ── Mock BlogService 팩토리 ──

function createMockBlogService() {
  return {
    listPublished: vi.fn().mockResolvedValue({
      items: [{ id: '1', title: '테스트 포스트', slug: 'test' }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1, hasMore: false },
    }),
    getPublishedBySlug: vi.fn().mockImplementation(async (slug: string) => {
      if (slug === 'not-found') return null;
      return { id: '1', title: '테스트', slug, published: true };
    }),
    getFeatured: vi.fn().mockResolvedValue([
      { id: '1', title: '추천 글', slug: 'featured-1', featured: true },
    ]),
    listAll: vi.fn().mockResolvedValue({
      items: [{ id: '1', title: '전체 글', slug: 'all-1' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasMore: false },
    }),
    create: vi.fn().mockResolvedValue({
      id: 'new-1',
      title: '새 글',
      slug: 'new-post',
    }),
    getById: vi.fn().mockImplementation(async (id: string) => {
      if (id === 'not-found') return null;
      return { id, title: '기존 글', slug: 'existing' };
    }),
    update: vi.fn().mockResolvedValue({ id: '1', title: '수정됨' }),
    remove: vi.fn().mockResolvedValue(undefined),
    removeMany: vi.fn().mockResolvedValue(2),
    togglePublish: vi.fn().mockResolvedValue({
      id: '1',
      published: true,
    }),
    bulkUpdatePublished: vi.fn().mockResolvedValue(3),
    bulkUpdateFeatured: vi.fn().mockResolvedValue(2),
    checkSlugAvailable: vi.fn().mockImplementation(async (slug: string) => {
      return slug !== 'duplicate';
    }),
    getDashboardStats: vi.fn().mockResolvedValue({
      total: 10,
      published: 7,
      unpublished: 3,
      byCategory: { news: 5, tech: 3, etc: 2 },
      recentPosts: [{ id: '1', title: '최근 글' }],
    }),
  } as any;
}

describe('블로그 라우트 핸들러', () => {
  let blogService: ReturnType<typeof createMockBlogService>;
  let routes: ReturnType<typeof createBlogRoutes>;

  beforeEach(() => {
    blogService = createMockBlogService();
    routes = createBlogRoutes(blogService, { pageSize: 12 });
  });

  // ── 공개: 글 목록 ──

  it('BS-BR-01: 공개 글 목록 — GET → 페이지네이션 JSON 반환', async () => {
    const req = new Request('http://localhost/api/blog?page=1&limit=12');
    const res = await routes.public.list.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(blogService.listPublished).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 12 }),
    );
  });

  it('BS-BR-02: 공개 글 목록 — category 필터 적용', async () => {
    const req = new Request('http://localhost/api/blog?category=press');
    const res = await routes.public.list.GET(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(blogService.listPublished).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'press' }),
    );
  });

  it('BS-BR-03: 공개 글 목록 — search 필터 적용', async () => {
    const req = new Request('http://localhost/api/blog?search=ballet');
    const res = await routes.public.list.GET(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(blogService.listPublished).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'ballet' }),
    );
  });

  // ── 공개: 글 상세 ──

  it('BS-BR-04: 공개 글 상세 — slug로 조회 → 포스트 반환', async () => {
    const req = new Request('http://localhost/api/blog/test-post');
    const props = { params: Promise.resolve({ slug: 'test-post' }) };

    const res = await routes.public.detail.GET(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('test-post');
  });

  it('BS-BR-05: 공개 글 상세 — 존재하지 않는 slug → 404', async () => {
    const req = new Request('http://localhost/api/blog/not-found');
    const props = { params: Promise.resolve({ slug: 'not-found' }) };

    const res = await routes.public.detail.GET(req, props);

    expect(res.status).toBe(404);
  });

  // ── 공개: 추천 글 ──

  it('BS-BR-06: 추천 글 목록 — GET → featured 포스트 반환', async () => {
    const req = new Request('http://localhost/api/blog/featured');
    const res = await routes.public.featured.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  // ── 관리자: 글 목록 ──

  it('BS-BR-07: 관리자 글 목록 — GET → 전체 글 반환 (published/sort 필터)', async () => {
    const req = new Request(
      'http://localhost/api/admin/blog?published=true&sortBy=createdAt',
    );
    const res = await routes.admin.list.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(blogService.listAll).toHaveBeenCalled();
  });

  // ── 관리자: 글 생성 ──

  it('BS-BR-08: 관리자 글 생성 — POST 유효 body → 201 + 생성된 포스트', async () => {
    const req = new Request('http://localhost/api/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '새 글', slug: 'new-post', content: '내용' }),
    });
    const res = await routes.admin.list.POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('new-1');
  });

  it('BS-BR-09: 관리자 글 생성 — POST 유효하지 않은 body → 400 + 검증 에러', async () => {
    const req = new Request('http://localhost/api/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await routes.admin.list.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── 관리자: 공개 상태 토글 ──

  it('BS-BR-10: 관리자 공개 토글 — PATCH → 토글 결과 반환', async () => {
    const req = new Request('http://localhost/api/admin/blog/1/publish', {
      method: 'PATCH',
    });
    const props = { params: Promise.resolve({ id: '1' }) };

    const res = await routes.admin.publish.PATCH(req, props);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.published).toBe(true);
  });

  // ── 관리자: 일괄 수정 ──

  it('BS-BR-11: 관리자 일괄 수정 — PATCH ids → bulk 처리', async () => {
    const req = new Request('http://localhost/api/admin/blog/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['1', '2', '3'], published: true }),
    });
    const res = await routes.admin.bulk.PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(3);
  });

  // ── 관리자: 슬러그 중복 확인 ──

  it('BS-BR-12: 관리자 슬러그 확인 — GET ?slug=xxx → available/duplicate', async () => {
    const reqAvail = new Request('http://localhost/api/admin/blog/slug-check?slug=new-slug');
    const resAvail = await routes.admin.slugCheck.GET(reqAvail);
    const bodyAvail = await resAvail.json();

    expect(bodyAvail.data.available).toBe(true);

    const reqDup = new Request('http://localhost/api/admin/blog/slug-check?slug=duplicate');
    const resDup = await routes.admin.slugCheck.GET(reqDup);
    const bodyDup = await resDup.json();

    expect(bodyDup.data.available).toBe(false);
  });

  // ── 관리자: 대시보드 통계 ──

  it('BS-BR-13: 관리자 대시보드 — GET → 통계 반환', async () => {
    const req = new Request('http://localhost/api/admin/blog/dashboard');
    const res = await routes.admin.dashboard.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.total).toBe(10);
    expect(body.data.published).toBe(7);
    expect(body.data.draft).toBe(3);
    expect(body.data.categories).toBeDefined();
  });
});
