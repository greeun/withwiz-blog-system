/**
 * createBlogSystem 본문 새니타이저 전달 테스트
 *
 * 호스트가 BlogSystemConfig.sanitizeContent 로 지정한 함수가 single·multi 두 모드에서
 * blog-core createBlogService 의 sanitizeContent 로 전달되어, 실제 create·update 저장값에
 * 적용되는지 검증한다. 지정하지 않으면 blog-core 기본 새니타이저가 그대로 쓰여야 한다.
 *
 * createBlogService 는 실제 구현을 감싼 spy 로 두어 전달 인자와 저장값을 함께 확인한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── blog-core 모킹 — createBlogService 만 실제 구현을 감싼다 ──

vi.mock('@withwiz/blog-core/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@withwiz/blog-core/services')>();
  return {
    ...actual,
    createBlogService: vi.fn(actual.createBlogService),
    createTagService: vi.fn().mockReturnValue({}),
    createCommentService: vi.fn().mockReturnValue({}),
    createSearchService: vi.fn().mockReturnValue({}),
    createSchedulerService: vi.fn().mockReturnValue({}),
  };
});

// ── toolkit auth 모킹 ──

vi.mock('@withwiz/toolkit/core/auth', () => {
  class MockJWTService {
    sign = vi.fn();
    verify = vi.fn();
    signAccessToken = vi.fn().mockResolvedValue('access-token');
    signRefreshToken = vi.fn().mockResolvedValue('refresh-token');
    verifyAccessToken = vi.fn();
    verifyRefreshToken = vi.fn();
  }
  class MockPasswordHasher {
    hash = vi.fn().mockResolvedValue('hashed');
    compare = vi.fn().mockResolvedValue(true);
  }
  class MockOAuthManager {
    getAuthUrl = vi.fn();
    handleCallback = vi.fn();
  }
  return {
    JWTService: MockJWTService,
    PasswordHasher: MockPasswordHasher,
    OAuthManager: MockOAuthManager,
    TokenGenerator: { generate: vi.fn().mockReturnValue('token') },
    OAuthProvider: { GOOGLE: 'GOOGLE', GITHUB: 'GITHUB' },
  };
});

vi.mock('@withwiz/toolkit/prisma/auth-adapter', () => {
  class MockPrismaUserRepository {
    findByEmail = vi.fn();
    findById = vi.fn();
    create = vi.fn();
    update = vi.fn();
  }
  class MockPrismaOAuthAccountRepository {
    findByProvider = vi.fn();
    create = vi.fn();
    update = vi.fn();
  }
  class MockPrismaEmailTokenRepository {
    create = vi.fn();
    findByToken = vi.fn();
    delete = vi.fn();
  }
  return {
    PrismaUserRepository: MockPrismaUserRepository,
    PrismaOAuthAccountRepository: MockPrismaOAuthAccountRepository,
    PrismaEmailTokenRepository: MockPrismaEmailTokenRepository,
  };
});

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
  withAuthApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 10 }),
  getSearchParam: vi.fn().mockReturnValue(null),
}));

vi.mock('@withwiz/blog-core/validators', () => ({
  CreateBlogPostSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  UpdateBlogPostSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
  BulkUpdateSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { ids: ['1'], published: true } }) },
}));

vi.mock('stripe', () => {
  class MockStripe {
    customers = { create: vi.fn() };
    subscriptions = { create: vi.fn(), cancel: vi.fn(), update: vi.fn(), retrieve: vi.fn() };
    checkout = { sessions: { create: vi.fn() } };
    billingPortal = { sessions: { create: vi.fn() } };
    webhooks = { constructEvent: vi.fn() };
  }
  return { default: MockStripe };
});

import { createBlogService } from '@withwiz/blog-core/services';
import { sanitizeHtmlContent } from '@withwiz/blog-core/utils';
import { createBlogSystem } from '@withwiz/blog-system/core';

// ── Mock Prisma 팩토리 ──
// create/update 는 전달받은 data 를 그대로 되돌려 저장값을 확인할 수 있게 한다.

function createDelegate() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    create: vi.fn(async (args: any) => ({ id: 'post-1', ...args.data })),
    update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    delete: vi.fn().mockResolvedValue({ id: 'post-1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

function createMockPrisma() {
  const prisma: any = {
    tenant: createDelegate(),
    tenantUser: createDelegate(),
    user: createDelegate(),
    news: createDelegate(),
    subscription: createDelegate(),
    plan: createDelegate(),
    usageRecord: createDelegate(),
  };
  // 트랜잭션 콜백에는 같은 클라이언트를 넘겨 저장 호출을 한 곳에서 관찰한다.
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  prisma.$queryRawUnsafe = vi.fn().mockResolvedValue([]);
  return prisma;
}

const JWT_SECRET = 'test-jwt-secret-key-for-unit-testing-minimum-32-chars';
const RAW_CONTENT = '<p>hello</p><script>alert(1)</script><img src="x" onerror="alert(2)">';
const HOST_SANITIZED = '<p>host-sanitized</p>';

const postInput = {
  title: '제목',
  slug: 'post-slug',
  category: 'notice',
  content: RAW_CONTENT,
  published: false,
} as any;

function lastBlogServiceConfig() {
  const calls = vi.mocked(createBlogService).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][1];
}

describe('createBlogSystem — 본문 새니타이저 전달', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.mocked(createBlogService).mockClear();
    // 테스트 환경에는 isomorphic-dompurify 가 없어 blog-core 가 폴백 경고를 남긴다.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ── single 모드 ──

  describe('single 모드', () => {
    function createSingle(sanitizeContent?: (html: string | null | undefined) => string | null) {
      return createBlogSystem({
        mode: 'single',
        prisma,
        auth: { jwtSecret: JWT_SECRET },
        blog: { modelName: 'news' },
        ...(sanitizeContent && { sanitizeContent }),
      });
    }

    it('BS-SC-01: 지정한 sanitizeContent 를 createBlogService 설정으로 전달한다', () => {
      const sanitizeContent = vi.fn(() => HOST_SANITIZED);

      createSingle(sanitizeContent);

      const serviceConfig = lastBlogServiceConfig();
      expect(serviceConfig.sanitizeContent).toBe(sanitizeContent);
      expect(serviceConfig.modelName).toBe('news');
    });

    it('BS-SC-02: create 저장값에 지정한 새니타이저 결과를 적용한다', async () => {
      const sanitizeContent = vi.fn(() => HOST_SANITIZED);
      const system = createSingle(sanitizeContent);

      await system.blogService!.create(postInput, 'author-1');

      expect(sanitizeContent).toHaveBeenCalledWith(RAW_CONTENT);
      expect(prisma.news.create).toHaveBeenCalledTimes(1);
      expect(prisma.news.create.mock.calls[0][0].data.content).toBe(HOST_SANITIZED);
    });

    it('BS-SC-03: update 저장값에 지정한 새니타이저 결과를 적용한다', async () => {
      const sanitizeContent = vi.fn(() => HOST_SANITIZED);
      const system = createSingle(sanitizeContent);

      await system.blogService!.update('post-1', { content: RAW_CONTENT } as any);

      expect(sanitizeContent).toHaveBeenCalledWith(RAW_CONTENT);
      expect(prisma.news.update).toHaveBeenCalledTimes(1);
      expect(prisma.news.update.mock.calls[0][0].data.content).toBe(HOST_SANITIZED);
    });

    it('BS-SC-04: 미지정 시 blog-core 기본 새니타이저로 create·update 한다', async () => {
      const system = createSingle();

      expect(lastBlogServiceConfig().sanitizeContent).toBeUndefined();

      const expected = sanitizeHtmlContent(RAW_CONTENT);
      expect(expected).not.toContain('<script');

      await system.blogService!.create(postInput, 'author-1');
      await system.blogService!.update('post-1', { content: RAW_CONTENT } as any);

      expect(prisma.news.create.mock.calls[0][0].data.content).toBe(expected);
      expect(prisma.news.update.mock.calls[0][0].data.content).toBe(expected);
    });

    // 새니타이저가 본문 전체를 제거하면(예: <script> 만 있는 본문) 원문으로 되돌아가지 않고
    // 빈 본문이 저장되어야 한다. blog-core 2.1.5 부터 보장된다.
    const SCRIPT_ONLY = '<script>alert(1)</script>';

    it('BS-SC-08: 새니타이저가 빈 문자열을 반환하면 create·update 에 원문 대신 빈 본문을 저장한다', async () => {
      const sanitizeContent = vi.fn(() => '');
      const system = createSingle(sanitizeContent);

      await system.blogService!.create({ ...postInput, content: SCRIPT_ONLY }, 'author-1');
      await system.blogService!.update('post-1', { content: SCRIPT_ONLY } as any);

      expect(sanitizeContent).toHaveBeenCalledTimes(2);
      expect(sanitizeContent).toHaveBeenCalledWith(SCRIPT_ONLY);
      expect(prisma.news.create.mock.calls[0][0].data.content).toBe('');
      expect(prisma.news.update.mock.calls[0][0].data.content).toBe('');
    });

    it('BS-SC-09: 새니타이저가 null 을 반환하면 create·update 에 원문 대신 빈 본문을 저장한다', async () => {
      const sanitizeContent = vi.fn(() => null);
      const system = createSingle(sanitizeContent);

      await system.blogService!.create({ ...postInput, content: SCRIPT_ONLY }, 'author-1');
      await system.blogService!.update('post-1', { content: SCRIPT_ONLY } as any);

      expect(sanitizeContent).toHaveBeenCalledTimes(2);
      expect(prisma.news.create.mock.calls[0][0].data.content).toBe('');
      expect(prisma.news.update.mock.calls[0][0].data.content).toBe('');
    });
  });

  // ── multi 모드 ──

  describe('multi 모드', () => {
    function createMulti(sanitizeContent?: (html: string | null | undefined) => string | null) {
      return createBlogSystem({
        mode: 'multi',
        prisma,
        auth: { jwtSecret: JWT_SECRET },
        blog: { modelName: 'news' },
        ...(sanitizeContent && { sanitizeContent }),
      });
    }

    it('BS-SC-05: createScopedBlogService 가 지정한 sanitizeContent 를 createBlogService 설정으로 전달한다', () => {
      const sanitizeContent = vi.fn(() => HOST_SANITIZED);
      const system = createMulti(sanitizeContent);

      system.createScopedBlogService!('tenant-a');

      const serviceConfig = lastBlogServiceConfig();
      expect(serviceConfig.sanitizeContent).toBe(sanitizeContent);
      expect(serviceConfig.modelName).toBe('news');
    });

    it('BS-SC-06: 테넌트 스코프 서비스의 create·update 저장값에 지정한 새니타이저 결과를 적용한다', async () => {
      const sanitizeContent = vi.fn(() => HOST_SANITIZED);
      const system = createMulti(sanitizeContent);
      const scoped = system.createScopedBlogService!('tenant-a');

      await scoped.create(postInput, 'author-1');
      await scoped.update('post-1', { content: RAW_CONTENT } as any);

      expect(sanitizeContent).toHaveBeenCalledTimes(2);
      expect(sanitizeContent).toHaveBeenCalledWith(RAW_CONTENT);

      const createArgs = prisma.news.create.mock.calls[0][0];
      expect(createArgs.data.content).toBe(HOST_SANITIZED);
      // 테넌트 격리는 그대로 유지되어야 한다.
      expect(createArgs.data.tenantId).toBe('tenant-a');

      const updateArgs = prisma.news.update.mock.calls[0][0];
      expect(updateArgs.data.content).toBe(HOST_SANITIZED);
      expect(updateArgs.where.tenantId).toBe('tenant-a');
    });

    it('BS-SC-07: 미지정 시 테넌트 스코프 서비스도 blog-core 기본 새니타이저로 create·update 한다', async () => {
      const system = createMulti();
      const scoped = system.createScopedBlogService!('tenant-a');

      expect(lastBlogServiceConfig().sanitizeContent).toBeUndefined();

      const expected = sanitizeHtmlContent(RAW_CONTENT);

      await scoped.create(postInput, 'author-1');
      await scoped.update('post-1', { content: RAW_CONTENT } as any);

      expect(prisma.news.create.mock.calls[0][0].data.content).toBe(expected);
      expect(prisma.news.update.mock.calls[0][0].data.content).toBe(expected);
    });
  });
});
