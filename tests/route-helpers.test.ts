/**
 * Task 16: blog-routes 내부 헬퍼 테스트 (9건)
 *
 * parseSortKey, validateIds, validateAndParse는 비공개 함수이므로
 * createBlogRoutes 반환 핸들러를 통해 간접 테스트한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 10 }),
  getSearchParam: vi.fn().mockReturnValue(null),
}));

vi.mock('@withwiz/blog-core/validators', () => ({
  CreateBlogPostSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: { title: 'test', slug: 'test', content: '<p>test</p>' } }),
  },
  UpdateBlogPostSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: {} }),
  },
  BulkUpdateSchema: {
    safeParse: vi.fn().mockReturnValue({ success: true, data: { ids: ['1'], published: true } }),
  },
}));

import { createBlogRoutes } from '@withwiz/blog-system/routes';
import { CreateBlogPostSchema } from '@withwiz/blog-core/validators';

function createMockBlogService() {
  return {
    create: vi.fn().mockResolvedValue({ id: '1', title: 'test', slug: 'test' }),
    getById: vi.fn().mockResolvedValue({ id: '1', title: 'test' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    remove: vi.fn().mockResolvedValue(undefined),
    listAll: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
    listPublished: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
    getPublishedBySlug: vi.fn().mockResolvedValue(null),
    getFeatured: vi.fn().mockResolvedValue([]),
    togglePublish: vi.fn().mockResolvedValue({ id: '1', published: true }),
    bulkUpdatePublished: vi.fn().mockResolvedValue(2),
    bulkUpdateFeatured: vi.fn().mockResolvedValue(2),
    removeMany: vi.fn().mockResolvedValue(2),
    checkSlugAvailable: vi.fn().mockResolvedValue(true),
    getDashboardStats: vi.fn().mockResolvedValue({
      total: 10,
      published: 5,
      unpublished: 5,
      byCategory: {},
      recentPosts: [],
    }),
  } as any;
}

describe('route-helpers (간접 테스트)', () => {
  let blogService: ReturnType<typeof createMockBlogService>;
  let routes: ReturnType<typeof createBlogRoutes>;

  beforeEach(() => {
    blogService = createMockBlogService();
    routes = createBlogRoutes(blogService, { pageSize: 12 });
  });

  // ── parseSortKey 간접 테스트 ──
  it('BS-RH-01: parseSortKey — 유효 키 → 그대로 반환', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog?sortBy=createdAt'),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    await routes.admin.list.GET(context as any);
    expect(blogService.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'createdAt' }),
    );
  });

  it('BS-RH-02: parseSortKey — 무효 키 → defaultKey 반환', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog?sortBy=invalid'),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    await routes.admin.list.GET(context as any);
    expect(blogService.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'updatedAt' }),
    );
  });

  it('BS-RH-03: parseSortKey — searchParams에 sort 없음 → defaultKey', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog'),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    await routes.admin.list.GET(context as any);
    expect(blogService.listAll).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'updatedAt' }),
    );
  });

  // ── validateIds 간접 테스트 ──
  it('BS-RH-04: validateIds — 유효 배열 → 정상 삭제', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'DELETE',
        body: JSON.stringify({ ids: ['id-1', 'id-2'] }),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.DELETE(context as any);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('BS-RH-05: validateIds — 빈 배열 → 400 에러', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [] }),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.DELETE(context as any);
    expect(response.status).toBe(400);
  });

  it('BS-RH-06: validateIds — null → 400 에러', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'DELETE',
        body: JSON.stringify({ ids: null }),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.DELETE(context as any);
    expect(response.status).toBe(400);
  });

  it('BS-RH-07: validateIds — 비배열 → 400 에러', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'DELETE',
        body: JSON.stringify({ ids: 'not-array' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.DELETE(context as any);
    expect(response.status).toBe(400);
  });

  // ── validateAndParse 간접 테스트 ──
  it('BS-RH-08: validateAndParse — Zod 통과 → 성공 응답', async () => {
    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'POST',
        body: JSON.stringify({ title: 'test', slug: 'test', content: '<p>test</p>' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.POST(context as any);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(response.status).toBe(201);
  });

  it('BS-RH-09: validateAndParse — Zod 실패 → 400 응답', async () => {
    // Mock safeParse to return failure
    (CreateBlogPostSchema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      success: false,
      error: {
        flatten: () => ({ fieldErrors: { title: ['필수 항목입니다'] } }),
      },
    });

    const context = {
      request: new Request('http://localhost/api/admin/blog', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      user: { id: 'u-1', role: 'ADMIN' },
      metadata: {},
    };

    const response = await routes.admin.list.POST(context as any);
    expect(response.status).toBe(400);
  });
});
