/**
 * 라우트 오류 상태 코드 보존 테스트
 *
 * @withwiz/blog-core 서비스가 BlogError 에 담아 던지는 HTTP 상태 코드와
 * 오류 코드가 blog-system 라우트 응답까지 유실 없이 전달되는지 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 20 }),
  getSearchParam: vi.fn((req: Request, key: string) =>
    new URL(req.url).searchParams.get(key),
  ),
}));

import {
  createTagRoutes,
  createCommentRoutes,
  createSearchRoutes,
  isBlogErrorLike,
  toErrorResponse,
} from '@withwiz/blog-system/routes';
import { BlogError, BLOG_ERROR_CODES } from '@withwiz/blog-core/errors';
import type {
  TagService,
  CommentService,
  SearchService,
} from '@withwiz/blog-core/services';

/**
 * blog-core 가 중복 설치되거나 번들링으로 클래스가 복제된 상황을 모사한다.
 * 구조는 BlogError 와 같지만 클래스 아이덴티티가 다르므로 instanceof 는 실패한다.
 */
class DuplicatedBlogError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'BlogError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** 내부 정보가 응답에 새어나가는지 확인하기 위한 마커 */
const INTERNAL_MARKER = 'connect ECONNREFUSED 10.0.0.7:5432 (db-password=hunter2)';

function makeContext(url: string, init?: RequestInit): any {
  return {
    request: new Request(url, init),
    user: { id: 'admin-1', role: 'ADMIN' },
    locale: 'ko',
    requestId: 'req-1',
    startTime: Date.now(),
    metadata: {},
  };
}

function jsonContext(url: string, body: unknown): any {
  return makeContext(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

function tagServiceThrowing(error: unknown): TagService {
  return {
    create: vi.fn().mockRejectedValue(error),
    getById: vi.fn(),
    getBySlug: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listAll: vi.fn().mockRejectedValue(error),
    getTagCloud: vi.fn(),
    getPostsByTag: vi.fn(),
    getTagsByPost: vi.fn(),
    getRelatedPosts: vi.fn(),
  } as unknown as TagService;
}

function commentServiceThrowing(error: unknown): CommentService {
  return {
    create: vi.fn().mockRejectedValue(error),
    listByPost: vi.fn(),
    listAll: vi.fn(),
    updateStatus: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    remove: vi.fn(),
    removeMany: vi.fn(),
    getPendingCount: vi.fn(),
  } as unknown as CommentService;
}

function searchServiceThrowing(error: unknown): SearchService {
  return {
    search: vi.fn().mockRejectedValue(error),
    buildQuery: vi.fn((q: string) => q),
  } as unknown as SearchService;
}

const NEW_TAG = { slug: 'news', name: '뉴스' };
const NEW_COMMENT = { postId: 'p-1', content: '좋은 글입니다.' };

describe('라우트 오류 상태 코드 보존', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('BS-ERR-01: BlogError(409) → 응답 409 + 오류 코드 보존', async () => {
    const routes = createTagRoutes(
      tagServiceThrowing(
        new BlogError(
          BLOG_ERROR_CODES.TAG_DUPLICATE_SLUG,
          'Tag slug already exists',
          409,
        ),
      ),
    );

    const res = await routes.admin.list.POST(
      jsonContext('http://localhost/api/admin/tags', NEW_TAG),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(BLOG_ERROR_CODES.TAG_DUPLICATE_SLUG);
  });

  it('BS-ERR-02: BlogError(429) → 응답 429 + 오류 코드 보존', async () => {
    const routes = createCommentRoutes(
      commentServiceThrowing(
        new BlogError(
          BLOG_ERROR_CODES.COMMENT_RATE_LIMIT_EXCEEDED,
          'Too many comments from this IP',
          429,
        ),
      ),
      { hmacSecret: 'test-secret' },
    );

    const res = await routes.public.create.POST(
      jsonContext('http://localhost/api/comments', NEW_COMMENT),
    );
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error.code).toBe(BLOG_ERROR_CODES.COMMENT_RATE_LIMIT_EXCEEDED);
  });

  it('BS-ERR-03: BlogError 기본 상태 코드(400)도 오류 코드와 함께 보존', async () => {
    const routes = createCommentRoutes(
      commentServiceThrowing(
        new BlogError(
          BLOG_ERROR_CODES.COMMENT_HONEYPOT_TRIGGERED,
          'Honeypot triggered',
        ),
      ),
    );

    const res = await routes.public.create.POST(
      jsonContext('http://localhost/api/comments', NEW_COMMENT),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe(BLOG_ERROR_CODES.COMMENT_HONEYPOT_TRIGGERED);
  });

  it('BS-ERR-04: 클래스 아이덴티티가 다른 BlogError 복제본도 상태 코드 보존', async () => {
    const duplicated = new DuplicatedBlogError(
      BLOG_ERROR_CODES.TAG_DUPLICATE_SLUG,
      'Tag slug already exists',
      409,
    );
    // 패키지 경계를 넘으면 instanceof 가 실패하는 상황임을 명시한다.
    expect(duplicated instanceof BlogError).toBe(false);

    const routes = createTagRoutes(tagServiceThrowing(duplicated));
    const res = await routes.admin.list.POST(
      jsonContext('http://localhost/api/admin/tags', NEW_TAG),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error.code).toBe(BLOG_ERROR_CODES.TAG_DUPLICATE_SLUG);
  });

  it('BS-ERR-05: statusCode 없이 status 만 가진 예외도 상태 코드 보존', async () => {
    const error = Object.assign(new Error('Access denied'), {
      code: BLOG_ERROR_CODES.FORBIDDEN,
      status: 403,
    });

    const routes = createTagRoutes(tagServiceThrowing(error));
    const res = await routes.admin.list.POST(
      jsonContext('http://localhost/api/admin/tags', NEW_TAG),
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe(BLOG_ERROR_CODES.FORBIDDEN);
  });

  // ── 상태 코드가 없는 예외는 라우트가 응답으로 바꾸지 않고 그대로 다시 던진다 ──
  //
  // 이 래퍼는 toolkit 의 withPublicApi/withAdminApi 안쪽에 있다. toolkit 의
  // errorHandlerMiddleware 는 Prisma 오류를 code·클래스 이름으로 분류하고
  // (P2002 → 409, P2025 → 404, PrismaClientValidationError → 400), 분류되지 않는
  // 예외는 일반 메시지의 500 으로 응답해 내부 정보를 숨긴다.
  // 0.2.1 은 여기서 모든 예외를 직접 500 으로 바꿔 그 분류를 가로막았다.
  // (호스트에서 `GET /api/news?category=foo` 가 400 이 아닌 500 을 반환)
  // 내부 정보 은닉은 toolkit 의 책임이며 toolkit 테스트가 검증한다.

  it('BS-ERR-06: status 없는 일반 Error 는 응답으로 바꾸지 않고 그대로 다시 던진다', async () => {
    const error = new Error(INTERNAL_MARKER);
    const routes = createTagRoutes(tagServiceThrowing(error));

    await expect(
      routes.admin.list.POST(
        jsonContext('http://localhost/api/admin/tags', NEW_TAG),
      ),
    ).rejects.toBe(error);
    // 로그는 분류를 맡는 toolkit 이 남긴다. 여기서 남기면 같은 예외가 두 번 기록된다.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('BS-ERR-07: 댓글 라우트의 일반 Error 도 400 으로 정규화하지 않고 다시 던진다', async () => {
    const error = new Error(INTERNAL_MARKER);
    const routes = createCommentRoutes(commentServiceThrowing(error));

    await expect(
      routes.public.create.POST(
        jsonContext('http://localhost/api/comments', NEW_COMMENT),
      ),
    ).rejects.toBe(error);
  });

  it('BS-ERR-08: 검색 라우트의 일반 Error 도 그대로 다시 던진다', async () => {
    const error = new Error(INTERNAL_MARKER);
    const routes = createSearchRoutes(searchServiceThrowing(error));

    await expect(
      routes.search.GET(makeContext('http://localhost/api/search?q=hello')),
    ).rejects.toBe(error);
  });

  it('BS-ERR-09: code 만 있고 status 없는 시스템 오류도 그대로 다시 던진다', async () => {
    const nodeError = Object.assign(new Error(INTERNAL_MARKER), {
      code: 'ECONNREFUSED',
    });
    const routes = createTagRoutes(tagServiceThrowing(nodeError));

    await expect(
      routes.admin.list.POST(
        jsonContext('http://localhost/api/admin/tags', NEW_TAG),
      ),
    ).rejects.toBe(nodeError);
  });

  it('BS-ERR-14: Prisma 오류는 toolkit 이 분류하도록 원본 그대로 다시 던진다', async () => {
    // Prisma 7 의 두 오류 형태를 모사한다. 클래스 이름과 code 속성이 분류 근거이므로
    // 다시 던질 때 감싸거나 복제하면 toolkit 이 400/409 대신 500 으로 응답한다.
    const validation = Object.assign(
      new Error('Invalid value for argument `category`. Expected NewsCategory.'),
      { name: 'PrismaClientValidationError' },
    );
    const duplicate = Object.assign(
      new Error('Unique constraint failed on the fields: (`slug`)'),
      { name: 'PrismaClientKnownRequestError', code: 'P2002' },
    );

    for (const error of [validation, duplicate]) {
      const routes = createSearchRoutes(searchServiceThrowing(error));
      await expect(
        routes.search.GET(makeContext('http://localhost/api/search?q=hello')),
      ).rejects.toBe(error);
    }
  });

  it('BS-ERR-10: 정상 응답은 그대로 통과', async () => {
    const tagService = {
      ...tagServiceThrowing(new Error('unused')),
      create: vi.fn().mockResolvedValue({ id: 't-1', ...NEW_TAG }),
    } as unknown as TagService;

    const routes = createTagRoutes(tagService);
    const res = await routes.admin.list.POST(
      jsonContext('http://localhost/api/admin/tags', NEW_TAG),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('isBlogErrorLike / toErrorResponse 구조 판별', () => {
  it('BS-ERR-11: code(string) + statusCode 조합을 BlogError 로 판별', () => {
    expect(
      isBlogErrorLike(
        new BlogError(BLOG_ERROR_CODES.TAG_NOT_FOUND, 'not found', 404),
      ),
    ).toBe(true);
    expect(isBlogErrorLike({ code: 'X', status: 409 })).toBe(true);
  });

  it('BS-ERR-12: code 또는 status 가 없으면 BlogError 로 보지 않음', () => {
    expect(isBlogErrorLike(new Error('boom'))).toBe(false);
    expect(isBlogErrorLike({ code: 'ENOENT' })).toBe(false);
    expect(isBlogErrorLike({ status: 409 })).toBe(false);
    expect(isBlogErrorLike(null)).toBe(false);
    expect(isBlogErrorLike('409')).toBe(false);
  });

  it('BS-ERR-13: HTTP 오류 범위를 벗어난 status 는 무시하고 500 처리', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      for (const status of [200, 302, 999, 409.5, NaN]) {
        const error = Object.assign(new Error('boom'), { code: 'X', status });
        expect(isBlogErrorLike(error)).toBe(false);
        const res = toErrorResponse(error);
        expect(res.status).toBe(500);
      }
    } finally {
      spy.mockRestore();
    }
  });
});
