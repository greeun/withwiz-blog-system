/**
 * Sprint E5: comment-routes 팩토리 테스트
 *
 * IP 추출 / HMAC 해싱 / 관리자 모더레이션 위임을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => {
  const store = new Map<string, Map<string, string | null>>();
  return {
    parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
    getSearchParam: vi.fn((req: Request, key: string) => {
      const url = new URL(req.url);
      return url.searchParams.get(key);
    }),
    __store: store,
  };
});

import {
  createCommentRoutes,
  extractClientIp,
  hashIp,
} from '@withwiz/blog-system/routes';
import type { CommentService } from '@withwiz/blog-core/services';

function createMockCommentService(): CommentService {
  return {
    create: vi.fn().mockResolvedValue({
      id: 'c-1',
      postId: 'p-1',
      content: '안녕',
      status: 'PENDING',
    }),
    listByPost: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasMore: false },
    }),
    updateStatus: vi
      .fn()
      .mockResolvedValue({ id: 'c-1', status: 'APPROVED' }),
    bulkUpdateStatus: vi.fn().mockResolvedValue(3),
    remove: vi.fn().mockResolvedValue(undefined),
    removeMany: vi.fn().mockResolvedValue(2),
    getPendingCount: vi.fn().mockResolvedValue(7),
  } as unknown as CommentService;
}

function makeContext(request: Request, user?: { id: string; role: string }): any {
  return {
    request,
    user,
    locale: 'ko',
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: {},
  };
}

describe('comment-routes 팩토리', () => {
  let svc: CommentService;
  let routes: ReturnType<typeof createCommentRoutes>;

  beforeEach(() => {
    svc = createMockCommentService();
    routes = createCommentRoutes(svc, { hmacSecret: 'test-secret' });
  });

  it('BS-CR-01: extractClientIp — CF-Connecting-IP 우선', () => {
    const req = new Request('http://localhost/', {
      headers: {
        'cf-connecting-ip': '1.2.3.4',
        'x-real-ip': '5.6.7.8',
        'x-forwarded-for': '9.9.9.9, 10.10.10.10',
      },
    });
    expect(extractClientIp(req)).toBe('1.2.3.4');
  });

  it('BS-CR-02: extractClientIp — X-Forwarded-For 첫 번째 값 추출', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '9.9.9.9, 10.10.10.10' },
    });
    expect(extractClientIp(req)).toBe('9.9.9.9');
  });

  it('BS-CR-03: hashIp — HMAC SHA-256 결정적 해시', () => {
    const h1 = hashIp('1.2.3.4', 'secret');
    const h2 = hashIp('1.2.3.4', 'secret');
    const h3 = hashIp('1.2.3.4', 'other-secret');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('BS-CR-04: public.list.GET → postId 누락 시 400', async () => {
    const req = new Request('http://localhost/api/comments');
    const res = await routes.public.list.GET(makeContext(req));
    expect(res.status).toBe(400);
  });

  it('BS-CR-05: public.list.GET → listByPost 호출', async () => {
    const req = new Request('http://localhost/api/comments?postId=p-1');
    const res = await routes.public.list.GET(makeContext(req));
    expect(svc.listByPost).toHaveBeenCalledWith('p-1', {
      includeReplies: true,
    });
    expect(res.status).toBe(200);
  });

  it('BS-CR-06: public.create.POST → IP 해시 포함하여 create 호출', async () => {
    const req = new Request('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ postId: 'p-1', content: '좋은 글이네요' }),
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': '203.0.113.1',
      },
    });
    const res = await routes.public.create.POST(makeContext(req));
    expect(res.status).toBe(201);
    const call = (svc.create as any).mock.calls[0];
    expect(call[0]).toMatchObject({ postId: 'p-1', content: '좋은 글이네요' });
    expect(call[1].ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(call[1].userId).toBeUndefined();
  });

  it('BS-CR-07: public.create.POST → content 누락 시 400', async () => {
    const req = new Request('http://localhost/api/comments', {
      method: 'POST',
      body: JSON.stringify({ postId: 'p-1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await routes.public.create.POST(makeContext(req));
    expect(res.status).toBe(400);
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('BS-CR-08: admin.updateStatus.PATCH → updateStatus 호출', async () => {
    const req = new Request('http://localhost/api/admin/comments/c-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const props = { params: Promise.resolve({ id: 'c-1' }) };
    const res = await routes.admin.updateStatus.PATCH(
      makeContext(req, { id: 'a-1', role: 'ADMIN' }),
      props,
    );
    expect(svc.updateStatus).toHaveBeenCalledWith('c-1', 'APPROVED');
    expect(res.status).toBe(200);
  });

  it('BS-CR-09: admin.bulkUpdateStatus.PATCH → 잘못된 status → 400', async () => {
    const req = new Request('http://localhost/api/admin/comments/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids: ['c-1'], status: 'INVALID' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await routes.admin.bulkUpdateStatus.PATCH(makeContext(req));
    expect(res.status).toBe(400);
    expect(svc.bulkUpdateStatus).not.toHaveBeenCalled();
  });

  it('BS-CR-10: admin.pendingCount.GET → getPendingCount 호출', async () => {
    const req = new Request('http://localhost/api/admin/comments/pending');
    const res = await routes.admin.pendingCount.GET(makeContext(req));
    const body = await res.json();
    expect(svc.getPendingCount).toHaveBeenCalled();
    expect(body.data.count).toBe(7);
  });
});
