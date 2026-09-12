/**
 * Sprint E5: search-routes 팩토리 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn((req: Request, defaultLimit = 12) => {
    const u = new URL(req.url);
    return {
      page: Number(u.searchParams.get('page') ?? 1),
      limit: Number(u.searchParams.get('limit') ?? defaultLimit),
    };
  }),
  getSearchParam: vi.fn((req: Request, key: string) => {
    const u = new URL(req.url);
    return u.searchParams.get(key);
  }),
}));

import { createSearchRoutes } from '@withwiz/blog-system/routes';
import type { SearchService } from '@withwiz/blog-core/services';

function createMockSearchService(): SearchService {
  return {
    search: vi.fn().mockResolvedValue({
      items: [{ id: 'p-1', slug: 'hello', title: 'Hello', rank: 0.9 }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1, hasMore: false },
    }),
    buildQuery: vi.fn((input: string) => input),
  } as unknown as SearchService;
}

function makeContext(url: string): any {
  return {
    request: new Request(url),
    user: undefined,
    locale: 'ko',
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: {},
  };
}

describe('search-routes 팩토리', () => {
  let svc: SearchService;
  let routes: ReturnType<typeof createSearchRoutes>;

  beforeEach(() => {
    svc = createMockSearchService();
    routes = createSearchRoutes(svc);
  });

  it('BS-SR-01: GET → q 쿼리 전달 + search 호출', async () => {
    const res = await routes.search.GET(
      makeContext('http://localhost/api/search?q=hello'),
    );
    const body = await res.json();
    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'hello', highlight: false }),
    );
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it('BS-SR-02: GET → q 누락 시 빈 문자열 query로 search 호출 (서비스가 빈 결과 처리)', async () => {
    await routes.search.GET(makeContext('http://localhost/api/search'));
    expect(svc.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: '' }),
    );
  });

  it('BS-SR-03: GET → page/limit/category/highlight 파라미터 전달', async () => {
    await routes.search.GET(
      makeContext(
        'http://localhost/api/search?q=hello&page=2&limit=5&category=news&highlight=1',
      ),
    );
    expect(svc.search).toHaveBeenCalledWith({
      query: 'hello',
      page: 2,
      limit: 5,
      category: 'news',
      highlight: true,
    });
  });

  it('BS-SR-04: GET → Cache-Control 헤더 설정', async () => {
    const res = await routes.search.GET(
      makeContext('http://localhost/api/search?q=hello'),
    );
    expect(res.headers.get('cache-control')).toMatch(/s-maxage=60/);
  });
});
