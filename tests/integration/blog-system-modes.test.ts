/**
 * createBlogSystem 모드별 통합 테스트 (4건)
 *
 * single/multi 모드에서 서비스 및 라우트 생성 여부를 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── blog-core 모킹 ──

vi.mock('@withwiz/blog-core/services', () => ({
  createBlogService: vi.fn().mockReturnValue({
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    listAll: vi.fn(),
    listPublished: vi.fn(),
    getPublishedBySlug: vi.fn(),
    getFeatured: vi.fn(),
    togglePublish: vi.fn(),
    bulkUpdatePublished: vi.fn(),
    bulkUpdateFeatured: vi.fn(),
    removeMany: vi.fn(),
    checkSlugAvailable: vi.fn(),
    getDashboardStats: vi.fn(),
  }),
  // Sprint E5: 신규 서비스 팩토리 모킹
  createTagService: vi.fn().mockReturnValue({}),
  createCommentService: vi.fn().mockReturnValue({}),
  createSearchService: vi.fn().mockReturnValue({}),
  createSchedulerService: vi.fn().mockReturnValue({}),
}));

// ── toolkit auth 모킹 ──

vi.mock('@withwiz/toolkit/auth', () => {
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

vi.mock('@withwiz/toolkit/auth/adapters/prisma', () => {
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

vi.mock('@withwiz/toolkit/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => handler),
  withAdminApi: vi.fn((handler: any) => handler),
  withAuthApi: vi.fn((handler: any) => handler),
}));

vi.mock('@withwiz/toolkit/utils/api-helpers', () => ({
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

import { createBlogSystem } from '@withwiz/blog-system/core';

// ── Mock Prisma 팩토리 ──

function createMockPrisma() {
  const delegate = {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue({ id: '1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
  return {
    tenant: { ...delegate },
    tenantUser: { ...delegate },
    user: { ...delegate },
    news: { ...delegate },
    subscription: { ...delegate },
    plan: { ...delegate },
    usageRecord: { ...delegate },
    $transaction: vi.fn(async (fn: any) =>
      fn({ tenant: { ...delegate }, $transaction: vi.fn() }),
    ),
  } as any;
}

const JWT_SECRET = 'test-jwt-secret-key-for-unit-testing-minimum-32-chars';

describe('createBlogSystem 모드별 동작', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it('BS-SM-01: single 모드 — blog + auth 라우트만 존재, tenant/billing null', () => {
    const system = createBlogSystem({
      mode: 'single',
      prisma,
      auth: { jwtSecret: JWT_SECRET },
      blog: { modelName: 'news' },
    });

    // blog, auth 라우트 존재
    expect(system.routes.blog).not.toBeNull();
    expect(system.routes.auth).not.toBeNull();

    // tenant, billing, domain 라우트는 null
    expect(system.routes.tenant).toBeNull();
    expect(system.routes.billing).toBeNull();
    expect(system.routes.domain).toBeNull();

    // single 모드에서 blogService는 존재
    expect(system.blogService).not.toBeNull();
    expect(system.tenantService).toBeNull();
  });

  it('BS-SM-02: multi 모드 — 모든 서비스/라우트 생성', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: JWT_SECRET },
      blog: { modelName: 'news' },
      domain: { baseDomain: 'blog.example.com' },
    });

    // 모든 라우트 존재 (billing 제외 — 별도 설정 필요)
    expect(system.routes.blog).not.toBeNull();
    expect(system.routes.auth).not.toBeNull();
    expect(system.routes.tenant).not.toBeNull();
    expect(system.routes.admin).not.toBeNull();

    // 서비스 존재
    expect(system.tenantService).not.toBeNull();
    expect(system.tenantUserService).not.toBeNull();
    expect(system.onboardingService).not.toBeNull();

    // multi 모드에서 blogService는 null (스코프 서비스 사용)
    expect(system.blogService).toBeNull();
    expect(system.createScopedBlogService).not.toBeNull();
  });

  it('BS-SM-03: multi 모드 + billing 설정 → billing 라우트 존재', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: JWT_SECRET },
      blog: { modelName: 'news' },
      billing: {
        stripeSecretKey: 'sk_test_xxx',
        stripeWebhookSecret: 'whsec_xxx',
        plans: [],
      },
    });

    expect(system.billingService).not.toBeNull();
    expect(system.planService).not.toBeNull();
    expect(system.routes.billing).not.toBeNull();
  });

  it('BS-SM-04: multi 모드 — createScopedBlogService로 테넌트 스코프 서비스 생성', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: JWT_SECRET },
      blog: { modelName: 'news' },
    });

    expect(system.createScopedBlogService).not.toBeNull();

    // 스코프 서비스 생성 호출
    const scopedService = system.createScopedBlogService!('tenant-abc');
    expect(scopedService).toBeDefined();
    expect(typeof scopedService.create).toBe('function');
    expect(typeof scopedService.listPublished).toBe('function');
  });
});
