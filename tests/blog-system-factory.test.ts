/**
 * Task 15: blog-system 팩토리 (createBlogSystem) 테스트 (7건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// blog-core 서비스를 mock
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

// toolkit auth 모듈을 mock — class 패턴 사용
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

// Prisma 어댑터 mock
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

import { createBlogSystem } from '@withwiz/blog-system/core';

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
    $transaction: vi.fn(async (fn: any) => fn({
      tenant: { ...delegate },
      $transaction: vi.fn(),
    })),
  } as any;
}

describe('createBlogSystem', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  // ── single 모드 ──
  it('BS-BF-01: single 모드 — blogService 존재, tenantService null', () => {
    const system = createBlogSystem({
      mode: 'single',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
    });

    expect(system.blogService).not.toBeNull();
    expect(system.tenantService).toBeNull();
  });

  it('BS-BF-02: single 모드 — blogRoutes 존재, tenantRoutes null', () => {
    const system = createBlogSystem({
      mode: 'single',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
    });

    expect(system.routes.blog).not.toBeNull();
    expect(system.routes.tenant).toBeNull();
  });

  // ── multi 모드 ──
  it('BS-BF-03: multi 모드 — 모든 서비스 존재', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
      domain: { baseDomain: 'blog.example.com' },
    });

    expect(system.tenantService).not.toBeNull();
    expect(system.tenantUserService).not.toBeNull();
    expect(system.onboardingService).not.toBeNull();
  });

  it('BS-BF-04: multi 모드 — billing 미설정 → billingService null', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
    });

    expect(system.billingService).toBeNull();
    expect(system.planService).toBeNull();
  });

  it('BS-BF-05: multi 모드 — billing 설정 → billingService 존재', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
      billing: {
        stripeSecretKey: 'sk_test_xxx',
        stripeWebhookSecret: 'whsec_xxx',
        plans: [],
      },
    });

    expect(system.billingService).not.toBeNull();
    expect(system.planService).not.toBeNull();
  });

  it('BS-BF-06: multi 모드 — domain 미설정 → domainService null', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
    });

    expect(system.domainService).toBeNull();
  });

  it('BS-BF-07: createScopedBlogService — tenantProxy 적용', () => {
    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
    });

    expect(system.createScopedBlogService).not.toBeNull();
    const scopedService = system.createScopedBlogService!('tenant-123');
    expect(scopedService).toBeDefined();
  });
});
