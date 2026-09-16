/**
 * 실제 toolkit 래퍼 체인 통합 테스트
 *
 * 다른 라우트 테스트는 toolkit wrappers 를 통과형으로 모킹하므로 toolkit 의 인증·역할 미들웨어를 거치지 않는다.
 * 이 파일은 wrappers 를 모킹하지 않고 실제 미들웨어 체인으로 라우트를 호출한다.
 * 토큰은 blog-system `createAuthService().login` 으로 발급하므로 JWT 역할은 blog-system 시스템 역할이다.
 *
 * - SUPER_ADMIN 토큰은 슈퍼 관리자 라우트와 플랫폼 수준 작업(tenant list, billing adminPlans, domain list)에 도달한다.
 * - USER 토큰은 같은 경로에서 toolkit 이 아닌 blog-system 인가에 따라 403 이다.
 * - 시스템 역할이 USER 인 테넌트 OWNER 는 자기 테넌트의 테넌트 수준 작업에 성공하고, 다른 테넌트에는 403 이다.
 * - 토큰이 없으면 toolkit 인증 미들웨어가 401 로 거부한다.
 * - 로그인한 모든 사용자가 쓰는 me·logout·changePassword 에 USER 토큰으로 도달한다.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// toolkit 로거는 모듈을 불러오는 시점에 설정을 읽으므로, 래퍼를 불러오기 전에 오류 수준 콘솔 출력만 남긴다.
await vi.hoisted(async () => {
  const { initializeLogger } = await import('@withwiz/toolkit/core/logger/config');
  initializeLogger({
    level: 'error',
    dir: './logs',
    file: 'test.log',
    fileEnabled: false,
    consoleEnabled: true,
  });
});

import { NextRequest } from 'next/server';
import { initializeAuth } from '@withwiz/toolkit/core/auth/config';
import { PasswordHasher } from '@withwiz/toolkit/core/auth';
import { setRateLimitAdapter } from '@withwiz/toolkit/next/middleware/rate-limit';
import { createAuthService } from '@withwiz/blog-system/auth';
import {
  createAuthRoutes,
  createBillingRoutes,
  createDomainRoutes,
  createSuperAdminRoutes,
  createTenantRoutes,
} from '@withwiz/blog-system/routes';
import { TenantRole } from '@withwiz/blog-system/types';

const JWT_SECRET = 'toolkit-wrapper-chain-test-secret-at-least-32-chars';
const PASSWORD = 'password-1234';
const ORIGIN = 'https://blog.example.com';

// ── 사용자 저장소 (가짜 Prisma) ──

type UserRecord = { id: string; email: string; name: string; role: string | null; isActive: boolean; password: string };

/** role 이 null 인 사용자는 auth-service 가 'USER' 역할로 토큰을 발급한다. */
const USER_SEEDS = [
  { id: 'super-1', email: 'super@test.com', role: 'SUPER_ADMIN' },
  { id: 'user-1', email: 'user@test.com', role: 'USER' },
  { id: 'owner-1', email: 'owner@test.com', role: null },
  { id: 'toolkit-admin-1', email: 'admin@test.com', role: 'ADMIN' },
] as const;

function createPrisma(passwordHash: string) {
  const users = new Map<string, UserRecord>(
    USER_SEEDS.map((seed) => [
      seed.id,
      { ...seed, name: seed.id, isActive: true, password: passwordHash },
    ]),
  );
  const find = (where: { id?: string; email?: string }) =>
    [...users.values()].find((u) => (where.id ? u.id === where.id : u.email === where.email)) ?? null;

  return {
    user: {
      findUnique: vi.fn(async ({ where }: any) => find(where)),
      update: vi.fn(async ({ where, data }: any) => ({ ...find(where)!, ...data })),
      count: vi.fn(async () => users.size),
      findMany: vi.fn(async () => []),
    },
    tenant: {
      count: vi.fn(async () => 2),
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  } as any;
}

// ── 가짜 서비스 ──

/** 테넌트 소속: owner-1 은 t-own 의 OWNER 이고 t-other 에는 소속되지 않는다. */
const MEMBERSHIPS: Record<string, TenantRole> = { 't-own:owner-1': TenantRole.OWNER };

function createServices() {
  const page = { items: [], page: 1, limit: 10, total: 0, totalPages: 0 };
  return {
    tenantUserService: {
      getUserRole: vi.fn(async (tenantId: string, userId: string) => MEMBERSHIPS[`${tenantId}:${userId}`] ?? null),
      listUsers: vi.fn().mockResolvedValue(page),
      getUserTenants: vi.fn().mockResolvedValue([]),
      addUser: vi.fn(),
      removeUser: vi.fn(),
      updateRole: vi.fn(),
      hasPermission: vi.fn(),
    } as any,
    tenantService: {
      listAll: vi.fn().mockResolvedValue(page),
      getById: vi.fn(async (id: string) => ({ id, name: id, slug: id, isActive: true })),
      getSettings: vi.fn(async () => ({ blogConfig: {}, theme: {}, seo: {} })),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
      updateSettings: vi.fn(),
      getBySlug: vi.fn(),
      getByCustomDomain: vi.fn(),
    } as any,
    billingService: {
      getSubscription: vi.fn(async (tenantId: string) => ({ tenantId, status: 'active' })),
      getUsage: vi.fn(),
      createCheckoutSession: vi.fn(),
      createPortalSession: vi.fn(),
      handleWebhook: vi.fn(),
    } as any,
    planService: {
      listActive: vi.fn().mockResolvedValue([{ id: 'plan-1' }]),
      create: vi.fn(),
      update: vi.fn(),
      getById: vi.fn(),
    } as any,
    domainService: {
      listCustomDomains: vi.fn().mockResolvedValue(page),
      checkVerification: vi.fn(async () => ({ status: 'verified' })),
      addCustomDomain: vi.fn(),
      verifyDomain: vi.fn(),
      removeCustomDomain: vi.fn(),
    } as any,
  };
}

// ── 요청 헬퍼 ──

function request(method: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const headers = new Headers();
  if (options.token) headers.set('authorization', `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const params = (values: Record<string, string>) => ({ params: Promise.resolve(values) });

async function expectStatus(res: Response, status: number) {
  const body = await res.json();
  // 실패 메시지에 응답 본문을 남겨 toolkit 과 blog-system 중 어디서 거부했는지 보이게 한다.
  expect(res.status, JSON.stringify(body.error ?? null)).toBe(status);
  return body;
}

/** toolkit 역할 미들웨어가 아니라 blog-system 인가 헬퍼가 거부했는지 메시지로 구분한다. */
async function expectBlogSystemForbidden(res: Response, message: string) {
  const body = await expectStatus(res, 403);
  expect(body.error.message).toBe(message);
}

const SUPER_ADMIN_REQUIRED = '슈퍼 관리자 권한이 필요합니다.';
const TENANT_FORBIDDEN = '해당 테넌트에 대한 권한이 없습니다.';

// ── 공통 준비 ──

let prisma: ReturnType<typeof createPrisma>;
let services: ReturnType<typeof createServices>;
let routes: ReturnType<typeof buildRoutes>;
const tokens: Record<'superAdmin' | 'user' | 'owner' | 'toolkitAdmin', string> = {
  superAdmin: '',
  user: '',
  owner: '',
  toolkitAdmin: '',
};
const rateLimitTypes: string[] = [];

function buildRoutes() {
  const authService = createAuthService(prisma, { jwtSecret: JWT_SECRET });
  return {
    authService,
    auth: createAuthRoutes(authService),
    superAdmin: createSuperAdminRoutes(services.tenantService, services.tenantUserService, prisma),
    tenant: createTenantRoutes(services.tenantService, services.tenantUserService),
    billing: createBillingRoutes(services.billingService, services.planService, services.tenantUserService),
    domain: createDomainRoutes(services.domainService, services.tenantUserService),
  };
}

let passwordHash = '';

beforeAll(async () => {
  initializeAuth({ jwtSecret: JWT_SECRET, accessTokenExpiry: '15m', refreshTokenExpiry: '7d' });

  const limiter = (type: string) => ({
    config: { limit: 1000 },
    check: async () => {
      rateLimitTypes.push(type);
      return { success: true, remaining: 999, resetIn: 60 };
    },
  });
  setRateLimitAdapter({
    rateLimiters: { api: limiter('api'), auth: limiter('auth'), admin: limiter('admin') },
    extractClientIp: () => '127.0.0.1',
  });

  // 해시 비용을 낮춰 로그인 검증 시간을 줄인다. bcrypt 검증은 해시에 기록된 비용을 따른다.
  passwordHash = await new PasswordHasher(4).hash(PASSWORD);
  prisma = createPrisma(passwordHash);
  services = createServices();
  routes = buildRoutes();

  const login = async (email: string) => (await routes.authService.login(email, PASSWORD)).tokens.accessToken;
  tokens.superAdmin = await login('super@test.com');
  tokens.user = await login('user@test.com');
  tokens.owner = await login('owner@test.com');
  tokens.toolkitAdmin = await login('admin@test.com');
});

beforeEach(() => {
  prisma = createPrisma(passwordHash);
  services = createServices();
  routes = buildRoutes();
  rateLimitTypes.length = 0;
});

// ── 슈퍼 관리자 ──

describe('SUPER_ADMIN 토큰', () => {
  it('BS-WC-01: 슈퍼 관리자 라우트 dashboard.GET·tenants.list.GET → 200', async () => {
    const dashboard = await expectStatus(
      await routes.superAdmin.dashboard.GET(request('GET', '/api/super/dashboard', { token: tokens.superAdmin })),
      200,
    );
    expect(dashboard.data.stats.totalTenants).toBe(2);

    await expectStatus(
      await routes.superAdmin.tenants.list.GET(request('GET', '/api/super/tenants', { token: tokens.superAdmin })),
      200,
    );
    expect(services.tenantService.listAll).toHaveBeenCalledTimes(1);
  });

  it('BS-WC-02: 플랫폼 수준 작업 tenant list.GET·billing adminPlans.GET·domain list.GET → 200', async () => {
    await expectStatus(
      await routes.tenant.list.GET(request('GET', '/api/tenants', { token: tokens.superAdmin })),
      200,
    );
    const plans = await expectStatus(
      await routes.billing.adminPlans.GET(request('GET', '/api/admin/plans', { token: tokens.superAdmin })),
      200,
    );
    expect(plans.data).toEqual([{ id: 'plan-1' }]);
    await expectStatus(
      await routes.domain.list.GET(request('GET', '/api/domains', { token: tokens.superAdmin })),
      200,
    );

    expect(services.tenantService.listAll).toHaveBeenCalledTimes(1);
    expect(services.planService.listActive).toHaveBeenCalledTimes(1);
    expect(services.domainService.listCustomDomains).toHaveBeenCalledTimes(1);
  });
});

// ── 슈퍼 관리자가 아닌 토큰 ──

describe('SUPER_ADMIN 이 아닌 토큰은 blog-system 인가에서 거부', () => {
  it('BS-WC-03: USER 토큰의 슈퍼 관리자 라우트 dashboard.GET·tenants.list.GET → blog-system 403', async () => {
    await expectBlogSystemForbidden(
      await routes.superAdmin.dashboard.GET(request('GET', '/api/super/dashboard', { token: tokens.user })),
      SUPER_ADMIN_REQUIRED,
    );
    await expectBlogSystemForbidden(
      await routes.superAdmin.tenants.list.GET(request('GET', '/api/super/tenants', { token: tokens.user })),
      SUPER_ADMIN_REQUIRED,
    );

    expect(prisma.tenant.count).not.toHaveBeenCalled();
    expect(services.tenantService.listAll).not.toHaveBeenCalled();
  });

  it('BS-WC-04: USER·toolkit ADMIN 토큰의 플랫폼 수준 작업 → blog-system 403', async () => {
    for (const token of [tokens.user, tokens.toolkitAdmin]) {
      await expectBlogSystemForbidden(
        await routes.tenant.list.GET(request('GET', '/api/tenants', { token })),
        SUPER_ADMIN_REQUIRED,
      );
      await expectBlogSystemForbidden(
        await routes.billing.adminPlans.GET(request('GET', '/api/admin/plans', { token })),
        SUPER_ADMIN_REQUIRED,
      );
      await expectBlogSystemForbidden(
        await routes.domain.list.GET(request('GET', '/api/domains', { token })),
        SUPER_ADMIN_REQUIRED,
      );
    }

    expect(services.tenantService.listAll).not.toHaveBeenCalled();
    expect(services.planService.listActive).not.toHaveBeenCalled();
    expect(services.domainService.listCustomDomains).not.toHaveBeenCalled();
  });
});

// ── 테넌트 소유자 ──

describe('시스템 역할이 USER 인 테넌트 OWNER 토큰', () => {
  it('BS-WC-05: 자기 테넌트의 tenant detail.GET·users.list.GET·billing subscription.GET·domain status.GET → 200', async () => {
    const detail = await expectStatus(
      await routes.tenant.detail.GET(
        request('GET', '/api/tenants/t-own', { token: tokens.owner }),
        params({ id: 't-own' }),
      ),
      200,
    );
    expect(detail.data.id).toBe('t-own');

    await expectStatus(
      await routes.tenant.users.list.GET(
        request('GET', '/api/tenants/t-own/users', { token: tokens.owner }),
        params({ id: 't-own' }),
      ),
      200,
    );
    await expectStatus(
      await routes.billing.subscription.GET(
        request('GET', '/api/billing/subscription?tenantId=t-own', { token: tokens.owner }),
      ),
      200,
    );
    await expectStatus(
      await routes.domain.status.GET(
        request('GET', '/api/domains/status?tenantId=t-own&domain=blog.own.com', { token: tokens.owner }),
      ),
      200,
    );

    expect(services.tenantUserService.getUserRole).toHaveBeenCalledWith('t-own', 'owner-1');
    expect(services.tenantUserService.listUsers).toHaveBeenCalledWith('t-own', expect.anything());
    expect(services.billingService.getSubscription).toHaveBeenCalledWith('t-own');
    expect(services.domainService.checkVerification).toHaveBeenCalledWith('t-own', 'blog.own.com');
  });

  it('BS-WC-06: 다른 테넌트의 같은 작업 → blog-system 403, 서비스 미호출', async () => {
    await expectBlogSystemForbidden(
      await routes.tenant.detail.GET(
        request('GET', '/api/tenants/t-other', { token: tokens.owner }),
        params({ id: 't-other' }),
      ),
      TENANT_FORBIDDEN,
    );
    await expectBlogSystemForbidden(
      await routes.tenant.users.list.GET(
        request('GET', '/api/tenants/t-other/users', { token: tokens.owner }),
        params({ id: 't-other' }),
      ),
      TENANT_FORBIDDEN,
    );
    await expectBlogSystemForbidden(
      await routes.billing.subscription.GET(
        request('GET', '/api/billing/subscription?tenantId=t-other', { token: tokens.owner }),
      ),
      TENANT_FORBIDDEN,
    );
    await expectBlogSystemForbidden(
      await routes.domain.status.GET(
        request('GET', '/api/domains/status?tenantId=t-other&domain=blog.other.com', { token: tokens.owner }),
      ),
      TENANT_FORBIDDEN,
    );

    expect(services.tenantService.getById).not.toHaveBeenCalled();
    expect(services.tenantUserService.listUsers).not.toHaveBeenCalled();
    expect(services.billingService.getSubscription).not.toHaveBeenCalled();
    expect(services.domainService.checkVerification).not.toHaveBeenCalled();
  });
});

// ── 인증 정보 없음 ──

describe('토큰 없음', () => {
  it('BS-WC-07: 슈퍼 관리자·tenant·billing·domain·auth 라우트 모두 toolkit 401, 핸들러 미도달', async () => {
    const responses = [
      await routes.superAdmin.dashboard.GET(request('GET', '/api/super/dashboard')),
      await routes.tenant.list.GET(request('GET', '/api/tenants')),
      await routes.tenant.detail.GET(request('GET', '/api/tenants/t-own'), params({ id: 't-own' })),
      await routes.billing.subscription.GET(request('GET', '/api/billing/subscription?tenantId=t-own')),
      await routes.domain.list.GET(request('GET', '/api/domains')),
      await routes.auth.me.GET(request('GET', '/api/auth/me')),
      await routes.auth.logout.POST(request('POST', '/api/auth/logout')),
    ];

    for (const res of responses) {
      const body = await expectStatus(res, 401);
      expect(body.success).toBe(false);
    }
    expect(prisma.tenant.count).not.toHaveBeenCalled();
    expect(services.tenantService.listAll).not.toHaveBeenCalled();
    expect(services.tenantUserService.getUserRole).not.toHaveBeenCalled();
    expect(services.billingService.getSubscription).not.toHaveBeenCalled();
    expect(services.domainService.listCustomDomains).not.toHaveBeenCalled();
  });
});

// ── 로그인 사용자 공통 경로 ──

describe('USER 토큰의 인증 라우트', () => {
  it('BS-WC-08: me.GET·logout.POST·changePassword.POST 에 도달한다', async () => {
    const me = await expectStatus(
      await routes.auth.me.GET(request('GET', '/api/auth/me', { token: tokens.user })),
      200,
    );
    expect(me.data.user).toEqual({ id: 'user-1', email: 'user@test.com', role: 'USER' });

    await expectStatus(
      await routes.auth.logout.POST(request('POST', '/api/auth/logout', { token: tokens.user })),
      200,
    );

    await expectStatus(
      await routes.auth.changePassword.POST(
        request('POST', '/api/auth/change-password', {
          token: tokens.user,
          body: { currentPassword: PASSWORD, newPassword: 'new-password-5678' },
        }),
      ),
      200,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('BS-WC-09: role 이 비어 있는 사용자도 USER 역할 토큰으로 me.GET 에 도달한다', async () => {
    const me = await expectStatus(
      await routes.auth.me.GET(request('GET', '/api/auth/me', { token: tokens.owner })),
      200,
    );
    expect(me.data.user).toEqual({ id: 'owner-1', email: 'owner@test.com', role: 'USER' });
  });
});

// ── rate limit ──

describe('rate limit 종류', () => {
  it('BS-WC-10: 인증만 확인하는 래퍼이므로 관리 라우트도 api rate limit 을 사용한다', async () => {
    await expectStatus(
      await routes.superAdmin.dashboard.GET(request('GET', '/api/super/dashboard', { token: tokens.superAdmin })),
      200,
    );
    await expectStatus(
      await routes.tenant.detail.GET(
        request('GET', '/api/tenants/t-own', { token: tokens.owner }),
        params({ id: 't-own' }),
      ),
      200,
    );
    await expectStatus(
      await routes.auth.me.GET(request('GET', '/api/auth/me', { token: tokens.user })),
      200,
    );

    expect(rateLimitTypes).toEqual(['api', 'api', 'api']);
  });
});
