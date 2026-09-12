/**
 * Sprint E5: tag-routes 팩토리 테스트
 *
 * withPublicApi / withAdminApi를 pass-through로 모킹하여
 * handler(context) 직접 호출로 서비스 위임 여부를 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
  getSearchParam: vi.fn((_req: Request, _key: string) => null),
}));

import { createTagRoutes } from '@withwiz/blog-system/routes';
import type { TagService } from '@withwiz/blog-core/services';

function createMockTagService(): TagService {
  return {
    create: vi.fn().mockResolvedValue({ id: 't-1', slug: 'news', name: '뉴스' }),
    getById: vi.fn().mockResolvedValue({ id: 't-1', slug: 'news', name: '뉴스' }),
    getBySlug: vi.fn(),
    update: vi
      .fn()
      .mockResolvedValue({ id: 't-1', slug: 'news-v2', name: '뉴스' }),
    remove: vi.fn().mockResolvedValue(undefined),
    listAll: vi.fn().mockResolvedValue({
      items: [],
      page: 1, limit: 20, total: 0, totalPages: 0,
    }),
    getTagCloud: vi.fn().mockResolvedValue([
      { id: 't-1', slug: 'news', name: '뉴스', postCount: 5, createdAt: new Date(), updatedAt: new Date() },
    ]),
    getPostsByTag: vi.fn().mockResolvedValue({
      items: [],
      page: 1, limit: 12, total: 0, totalPages: 0,
    }),
    getTagsByPost: vi.fn().mockResolvedValue([]),
    getRelatedPosts: vi.fn().mockResolvedValue([]),
  } as unknown as TagService;
}

function makeContext(url = 'http://localhost/api/tags'): any {
  return {
    request: new Request(url),
    user: { id: 'admin-1', role: 'ADMIN' },
    locale: 'ko',
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: {},
  };
}

describe('tag-routes 팩토리', () => {
  let tagService: TagService;
  let routes: ReturnType<typeof createTagRoutes>;

  beforeEach(() => {
    tagService = createMockTagService();
    routes = createTagRoutes(tagService);
  });

  it('BS-TR-01: public.list.GET → listAll 호출 + 성공 응답', async () => {
    const res = await routes.public.list.GET(makeContext());
    const body = await res.json();
    expect(tagService.listAll).toHaveBeenCalled();
    expect(body.success).toBe(true);
  });

  it('BS-TR-02: public.cloud.GET → getTagCloud 호출', async () => {
    const res = await routes.public.cloud.GET(makeContext());
    const body = await res.json();
    expect(tagService.getTagCloud).toHaveBeenCalled();
    expect(body.data).toHaveLength(1);
  });

  it('BS-TR-03: public.posts.GET → getPostsByTag(slug) 호출', async () => {
    const props = { params: Promise.resolve({ slug: 'news' }) };
    const res = await routes.public.posts.GET(makeContext(), props);
    expect(res.status).toBe(200);
    expect(tagService.getPostsByTag).toHaveBeenCalledWith(
      'news',
      expect.any(Object),
    );
  });

  it('BS-TR-04: admin.list.POST → create 호출 + 201 반환', async () => {
    const ctx = {
      ...makeContext(),
      request: new Request('http://localhost/api/admin/tags', {
        method: 'POST',
        body: JSON.stringify({ slug: 'news', name: '뉴스' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    };
    const res = await routes.admin.list.POST(ctx);
    expect(res.status).toBe(201);
    expect(tagService.create).toHaveBeenCalledWith({
      slug: 'news',
      name: '뉴스',
      description: undefined,
    });
  });

  it('BS-TR-05: admin.list.POST → slug 누락 시 400', async () => {
    const ctx = {
      ...makeContext(),
      request: new Request('http://localhost/api/admin/tags', {
        method: 'POST',
        body: JSON.stringify({ name: '뉴스' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    };
    const res = await routes.admin.list.POST(ctx);
    expect(res.status).toBe(400);
    expect(tagService.create).not.toHaveBeenCalled();
  });

  it('BS-TR-06: admin.detail.DELETE → remove 호출 + 204', async () => {
    const props = { params: Promise.resolve({ id: 't-1' }) };
    const res = await routes.admin.detail.DELETE(makeContext(), props);
    expect(res.status).toBe(204);
    expect(tagService.remove).toHaveBeenCalledWith('t-1');
  });

  it('BS-TR-07: admin.byPost.GET → getTagsByPost 호출', async () => {
    const props = { params: Promise.resolve({ postId: 'p-1' }) };
    const res = await routes.admin.byPost.GET(makeContext(), props);
    const body = await res.json();
    expect(tagService.getTagsByPost).toHaveBeenCalledWith('p-1');
    expect(body.success).toBe(true);
  });
});
