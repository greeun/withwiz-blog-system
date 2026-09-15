/**
 * 관리 라우트 인가 보안 테스트
 *
 * tenant·billing·domain 라우트가 toolkit withAdminApi 인증 외에 요청자의 권한을 확인하는지 검증한다.
 * - 플랫폼 수준 작업(전체 테넌트 목록·생성·비활성화, 요금제 관리, 전체 도메인 목록)은 SUPER_ADMIN 만 허용한다.
 * - 테넌트 수준 작업은 해당 테넌트에 ADMIN 이상 역할로 소속된 사용자만 허용한다.
 * - 인증 정보가 없으면 401, 권한을 확인할 수 없거나 권한이 없으면 403 으로 거부한다(fail-closed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({
  user: undefined as undefined | { id: string; role: string; email: string },
}));

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => {
  const wrap = (handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: auth.user, metadata: {} }, props);
  return {
    withAdminApi: vi.fn(wrap),
    withAuthApi: vi.fn(wrap),
    withPublicApi: vi.fn((handler: any) => (req: Request, props?: unknown) =>
      handler({ request: req, user: undefined, metadata: {} }, props),
    ),
  };
});

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn(() => ({ page: 1, limit: 10 })),
  getSearchParam: vi.fn((req: Request, key: string) => new URL(req.url).searchParams.get(key)),
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

import {
  createTenantRoutes,
  createSuperAdminRoutes,
  createBillingRoutes,
  createDomainRoutes,
} from '@withwiz/blog-system/routes';
import { createBlogSystem } from '@withwiz/blog-system/core';
import { TenantRole } from '@withwiz/blog-system/types';

// ── 사용자 ──

const SUPER_ADMIN = { id: 'super-1', role: 'SUPER_ADMIN', email: 'super@test.com' };
const ADMIN = { id: 'u-1', role: 'ADMIN', email: 'u1@test.com' };

// ── Mock 팩토리 ──

/** `${tenantId}:${userId}` → 역할 */
function createTenantUserService(memberships: Record<string, TenantRole> = {}) {
  return {
    getUserRole: vi.fn(async (tenantId: string, userId: string) => memberships[`${tenantId}:${userId}`] ?? null),
    hasPermission: vi.fn(),
    addUser: vi.fn(async (tenantId: string, userId: string, role: TenantRole) => ({ id: 'tu-new', tenantId, userId, role })),
    removeUser: vi.fn().mockResolvedValue(undefined),
    updateRole: vi.fn(async (tenantId: string, userId: string, role: TenantRole) => ({ id: 'tu-1', tenantId, userId, role })),
    listUsers: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
    getUserTenants: vi.fn().mockResolvedValue([]),
  } as any;
}

function createTenantService() {
  return {
    listAll: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
    create: vi.fn(async (data: any) => ({ id: 't-new', ...data, isActive: true })),
    getById: vi.fn(async (id: string) => ({ id, name: '테넌트', slug: 'tenant', isActive: true })),
    getBySlug: vi.fn(),
    getByCustomDomain: vi.fn(),
    update: vi.fn(async (id: string, data: any) => ({ id, ...data })),
    deactivate: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({ blogConfig: {}, theme: {}, seo: {} }),
    updateSettings: vi.fn().mockResolvedValue({ blogConfig: {}, theme: {}, seo: {} }),
  } as any;
}

function createBillingService() {
  return {
    createCheckoutSession: vi.fn().mockResolvedValue('https://checkout.stripe.com/s'),
    createPortalSession: vi.fn().mockResolvedValue('https://billing.stripe.com/p'),
    getSubscription: vi.fn().mockResolvedValue({ id: 'sub-1', status: 'active' }),
    getUsage: vi.fn().mockResolvedValue({ posts: 1 }),
    handleWebhook: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createPlanService() {
  return {
    listActive: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'plan-new' }),
    update: vi.fn().mockResolvedValue({ id: 'plan-1' }),
    getById: vi.fn(),
  } as any;
}

function createDomainService() {
  return {
    addCustomDomain: vi.fn().mockResolvedValue({ domain: 'blog.example.com', tenantId: 't-1' }),
    verifyDomain: vi.fn().mockResolvedValue(true),
    checkVerification: vi.fn().mockResolvedValue({ status: 'verified' }),
    removeCustomDomain: vi.fn().mockResolvedValue(undefined),
    listCustomDomains: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 10, total: 0, totalPages: 0 }),
  } as any;
}

// ── 요청 헬퍼 ──

function json(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = (values: Record<string, string>) => ({ params: Promise.resolve(values) });

async function expectRejected(res: Response, status: 401 | 403) {
  expect(res.status).toBe(status);
  const body = await res.json();
  expect(body.success).toBe(false);
}

beforeEach(() => {
  auth.user = ADMIN;
});

// ── 테넌트 라우트 ──

describe('테넌트 라우트 — 플랫폼 수준 작업은 슈퍼 관리자 전용', () => {
  it('BS-AZ-01: 슈퍼 관리자가 아닌 ADMIN 의 create.POST → 403, 테넌트 미생성', async () => {
    const tenantService = createTenantService();
    const routes = createTenantRoutes(tenantService, createTenantUserService());

    const res = await routes.create.POST(
      json('http://localhost/api/tenants', 'POST', { name: '새 테넌트', slug: 'new-tenant' }),
    );

    await expectRejected(res, 403);
    expect(tenantService.create).not.toHaveBeenCalled();
  });

  it('BS-AZ-02: 슈퍼 관리자가 아닌 ADMIN 의 list.GET·deactivate.PATCH → 403', async () => {
    const tenantService = createTenantService();
    const routes = createTenantRoutes(
      tenantService,
      createTenantUserService({ 't-1:u-1': TenantRole.OWNER }),
    );

    await expectRejected(await routes.list.GET(new Request('http://localhost/api/tenants')), 403);
    await expectRejected(
      await routes.deactivate.PATCH(
        new Request('http://localhost/api/tenants/t-1/deactivate', { method: 'PATCH' }),
        params({ id: 't-1' }),
      ),
      403,
    );
    expect(tenantService.listAll).not.toHaveBeenCalled();
    expect(tenantService.deactivate).not.toHaveBeenCalled();
  });

  it('BS-AZ-03: 인증 정보 없음 → 슈퍼 관리자 작업과 테넌트 작업 모두 401', async () => {
    auth.user = undefined;
    const tenantService = createTenantService();
    const tenantUserService = createTenantUserService();
    const routes = createTenantRoutes(tenantService, tenantUserService);

    await expectRejected(
      await routes.create.POST(json('http://localhost/api/tenants', 'POST', { name: 'n', slug: 'new-tenant' })),
      401,
    );
    await expectRejected(
      await routes.settings.GET(new Request('http://localhost/api/tenants/t-1/settings'), params({ id: 't-1' })),
      401,
    );
    expect(tenantService.create).not.toHaveBeenCalled();
    expect(tenantService.getSettings).not.toHaveBeenCalled();
    expect(tenantUserService.getUserRole).not.toHaveBeenCalled();
  });

  it('BS-AZ-04: 같은 ADMIN 컨텍스트는 createSuperAdminRoutes 의 tenants.create.POST 에서도 403 이다', async () => {
    const tenantService = createTenantService();
    const adminRoutes = createSuperAdminRoutes(tenantService, createTenantUserService(), {} as any);

    const res = await adminRoutes.tenants.create.POST(
      json('http://localhost/api/super/tenants', 'POST', { name: '새 테넌트', slug: 'new-tenant' }),
    );

    await expectRejected(res, 403);
    expect(tenantService.create).not.toHaveBeenCalled();
  });
});

describe('테넌트 라우트 — 테넌트 수준 작업은 소속 관리자 전용', () => {
  it('BS-AZ-05: 소속되지 않은 테넌트의 users.updateRole.PATCH → 403, 역할 미변경', async () => {
    const tenantUserService = createTenantUserService({ 't-1:u-1': TenantRole.OWNER });
    const routes = createTenantRoutes(createTenantService(), tenantUserService);

    const res = await routes.users.updateRole.PATCH(
      json('http://localhost/api/tenants/t-other/users/role', 'PATCH', { userId: 'u-2', role: TenantRole.ADMIN }),
      params({ id: 't-other' }),
    );

    await expectRejected(res, 403);
    expect(tenantUserService.getUserRole).toHaveBeenCalledWith('t-other', 'u-1');
    expect(tenantUserService.updateRole).not.toHaveBeenCalled();
  });

  it('BS-AZ-06: ADMIN 미만(EDITOR) 구성원의 settings.PUT → 403, 설정 미변경', async () => {
    const tenantService = createTenantService();
    const routes = createTenantRoutes(tenantService, createTenantUserService({ 't-1:u-1': TenantRole.EDITOR }));

    const res = await routes.settings.PUT(
      json('http://localhost/api/tenants/t-1/settings', 'PUT', { seo: { siteName: 'x' } }),
      params({ id: 't-1' }),
    );

    await expectRejected(res, 403);
    expect(tenantService.updateSettings).not.toHaveBeenCalled();
  });

  it('BS-AZ-07: ADMIN 구성원은 detail.GET·settings.GET·settings.PUT·users.list.GET 을 호출할 수 있다', async () => {
    const tenantService = createTenantService();
    const tenantUserService = createTenantUserService({ 't-1:u-1': TenantRole.ADMIN });
    const routes = createTenantRoutes(tenantService, tenantUserService);
    const p = () => params({ id: 't-1' });

    expect((await routes.detail.GET(new Request('http://localhost/api/tenants/t-1'), p())).status).toBe(200);
    expect((await routes.settings.GET(new Request('http://localhost/api/tenants/t-1/settings'), p())).status).toBe(200);
    expect(
      (await routes.settings.PUT(json('http://localhost/api/tenants/t-1/settings', 'PUT', { seo: {} }), p())).status,
    ).toBe(200);
    expect((await routes.users.list.GET(new Request('http://localhost/api/tenants/t-1/users'), p())).status).toBe(200);
    expect(tenantService.updateSettings).toHaveBeenCalledWith('t-1', { seo: {} });
    expect(tenantUserService.listUsers).toHaveBeenCalledWith('t-1', { page: 1, limit: 10 });
  });

  it('BS-AZ-08: SUPER_ADMIN 이라도 테넌트에 소속되지 않으면 settings.GET → 403', async () => {
    auth.user = SUPER_ADMIN;
    const tenantService = createTenantService();
    const routes = createTenantRoutes(tenantService, createTenantUserService());

    const res = await routes.settings.GET(new Request('http://localhost/api/tenants/t-1/settings'), params({ id: 't-1' }));

    await expectRejected(res, 403);
    expect(tenantService.getSettings).not.toHaveBeenCalled();
  });

  it('BS-AZ-09: tenantUserService 없이 만든 라우트는 테넌트 작업을 403 으로 거부한다', async () => {
    const tenantService = createTenantService();
    const routes = createTenantRoutes(tenantService);

    await expectRejected(await routes.detail.GET(new Request('http://localhost/api/tenants/t-1'), params({ id: 't-1' })), 403);
    await expectRejected(
      await routes.settings.PUT(json('http://localhost/api/tenants/t-1/settings', 'PUT', {}), params({ id: 't-1' })),
      403,
    );
    expect(tenantService.getById).not.toHaveBeenCalled();
    expect(tenantService.updateSettings).not.toHaveBeenCalled();
  });

  it('BS-AZ-10: ADMIN 구성원은 OWNER 역할을 부여할 수 없고, OWNER 구성원은 부여할 수 있다', async () => {
    const tenantUserService = createTenantUserService({
      't-1:u-1': TenantRole.ADMIN,
      't-1:owner-1': TenantRole.OWNER,
    });
    const routes = createTenantRoutes(createTenantService(), tenantUserService);
    const body = { userId: 'u-3', role: TenantRole.OWNER };

    await expectRejected(
      await routes.users.add.POST(json('http://localhost/api/tenants/t-1/users', 'POST', body), params({ id: 't-1' })),
      403,
    );
    expect(tenantUserService.addUser).not.toHaveBeenCalled();

    auth.user = { id: 'owner-1', role: 'ADMIN', email: 'owner@test.com' };
    const res = await routes.users.add.POST(json('http://localhost/api/tenants/t-1/users', 'POST', body), params({ id: 't-1' }));
    expect(res.status).toBe(201);
    expect(tenantUserService.addUser).toHaveBeenCalledWith('t-1', 'u-3', TenantRole.OWNER);
  });

  it('BS-AZ-11: ADMIN 구성원은 OWNER 구성원의 역할 변경·제거를 할 수 없고, EDITOR 구성원은 제거할 수 있다', async () => {
    const tenantUserService = createTenantUserService({
      't-1:u-1': TenantRole.ADMIN,
      't-1:owner-1': TenantRole.OWNER,
      't-1:editor-1': TenantRole.EDITOR,
    });
    const routes = createTenantRoutes(createTenantService(), tenantUserService);

    await expectRejected(
      await routes.users.updateRole.PATCH(
        json('http://localhost/api/tenants/t-1/users/role', 'PATCH', { userId: 'owner-1', role: TenantRole.VIEWER }),
        params({ id: 't-1' }),
      ),
      403,
    );
    await expectRejected(
      await routes.users.remove.DELETE(
        json('http://localhost/api/tenants/t-1/users', 'DELETE', { userId: 'owner-1' }),
        params({ id: 't-1' }),
      ),
      403,
    );
    expect(tenantUserService.updateRole).not.toHaveBeenCalled();
    expect(tenantUserService.removeUser).not.toHaveBeenCalled();

    const res = await routes.users.remove.DELETE(
      json('http://localhost/api/tenants/t-1/users', 'DELETE', { userId: 'editor-1' }),
      params({ id: 't-1' }),
    );
    expect(res.status).toBe(200);
    expect(tenantUserService.removeUser).toHaveBeenCalledWith('t-1', 'editor-1');
  });

  it('BS-AZ-12: OWNER 구성원도 detail.PUT 으로 customDomain·planId·isActive 를 바꿀 수 없고, name 은 바꿀 수 있다', async () => {
    const tenantService = createTenantService();
    const routes = createTenantRoutes(tenantService, createTenantUserService({ 't-1:u-1': TenantRole.OWNER }));

    for (const restricted of [
      { customDomain: 'victim.example.com' },
      { planId: 'cjld2cjxh0000qzrmn831i7rn' },
      { isActive: true },
    ]) {
      await expectRejected(
        await routes.detail.PUT(json('http://localhost/api/tenants/t-1', 'PUT', restricted), params({ id: 't-1' })),
        403,
      );
    }
    expect(tenantService.update).not.toHaveBeenCalled();

    const res = await routes.detail.PUT(json('http://localhost/api/tenants/t-1', 'PUT', { name: '새 이름' }), params({ id: 't-1' }));
    expect(res.status).toBe(200);
    expect(tenantService.update).toHaveBeenCalledWith('t-1', { name: '새 이름' });
  });
});

// ── 과금 라우트 ──

describe('과금 라우트', () => {
  it('BS-AZ-13: 소속되지 않은 테넌트의 subscription.GET·usage.GET → 403, 조회 미호출', async () => {
    const billingService = createBillingService();
    const routes = createBillingRoutes(
      billingService,
      createPlanService(),
      createTenantUserService({ 't-1:u-1': TenantRole.OWNER }),
    );

    await expectRejected(await routes.subscription.GET(new Request('http://localhost/api/billing/subscription?tenantId=t-other')), 403);
    await expectRejected(await routes.usage.GET(new Request('http://localhost/api/billing/usage?tenantId=t-other')), 403);
    expect(billingService.getSubscription).not.toHaveBeenCalled();
    expect(billingService.getUsage).not.toHaveBeenCalled();
  });

  it('BS-AZ-14: 소속되지 않은 테넌트의 checkout.POST·portal.POST → 403, 세션 미생성', async () => {
    const billingService = createBillingService();
    const routes = createBillingRoutes(billingService, createPlanService(), createTenantUserService());

    await expectRejected(
      await routes.checkout.POST(
        json('http://localhost/api/billing/checkout', 'POST', {
          tenantId: 't-other', planId: 'plan-1', successUrl: 'http://s', cancelUrl: 'http://c',
        }),
      ),
      403,
    );
    await expectRejected(
      await routes.portal.POST(json('http://localhost/api/billing/portal', 'POST', { tenantId: 't-other', returnUrl: 'http://r' })),
      403,
    );
    expect(billingService.createCheckoutSession).not.toHaveBeenCalled();
    expect(billingService.createPortalSession).not.toHaveBeenCalled();
  });

  it('BS-AZ-15: ADMIN 구성원의 subscription.GET → 200, 해당 테넌트 구독 조회', async () => {
    const billingService = createBillingService();
    const routes = createBillingRoutes(
      billingService,
      createPlanService(),
      createTenantUserService({ 't-1:u-1': TenantRole.ADMIN }),
    );

    const res = await routes.subscription.GET(new Request('http://localhost/api/billing/subscription?tenantId=t-1'));

    expect(res.status).toBe(200);
    expect(billingService.getSubscription).toHaveBeenCalledWith('t-1');
  });

  it('BS-AZ-16: 요금제 관리 adminPlans 는 SUPER_ADMIN 만 호출할 수 있다', async () => {
    const planService = createPlanService();
    const routes = createBillingRoutes(createBillingService(), planService, createTenantUserService());
    const plan = { name: 'Pro', maxPosts: 10, maxStorage: 10 };

    await expectRejected(await routes.adminPlans.GET(new Request('http://localhost/api/billing/admin/plans')), 403);
    await expectRejected(await routes.adminPlans.POST(json('http://localhost/api/billing/admin/plans', 'POST', plan)), 403);
    await expectRejected(
      await routes.adminPlans.PUT(json('http://localhost/api/billing/admin/plans', 'PUT', { id: 'plan-1', name: 'x' })),
      403,
    );
    expect(planService.create).not.toHaveBeenCalled();
    expect(planService.update).not.toHaveBeenCalled();

    auth.user = SUPER_ADMIN;
    const res = await routes.adminPlans.POST(json('http://localhost/api/billing/admin/plans', 'POST', plan));
    expect(res.status).toBe(201);
    expect(planService.create).toHaveBeenCalledWith(plan);
  });

  it('BS-AZ-17: tenantUserService 없이 만든 과금 라우트는 테넌트 작업을 403 으로 거부하고, 공개 경로는 그대로 동작한다', async () => {
    const billingService = createBillingService();
    const routes = createBillingRoutes(billingService, createPlanService());

    await expectRejected(await routes.subscription.GET(new Request('http://localhost/api/billing/subscription?tenantId=t-1')), 403);
    expect(billingService.getSubscription).not.toHaveBeenCalled();

    expect((await routes.plans.GET(new Request('http://localhost/api/billing/plans'))).status).toBe(200);
    const webhook = await routes.webhook.POST(
      new Request('http://localhost/api/billing/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
      }),
    );
    expect(webhook.status).toBe(200);
    expect(billingService.handleWebhook).toHaveBeenCalledWith('{}', 'sig');
  });
});

// ── 도메인 라우트 ──

describe('도메인 라우트', () => {
  it('BS-AZ-18: 소속되지 않은 테넌트의 remove.DELETE → 403, 도메인 미제거', async () => {
    const domainService = createDomainService();
    const routes = createDomainRoutes(domainService, createTenantUserService({ 't-1:u-1': TenantRole.OWNER }));

    const res = await routes.remove.DELETE(new Request('http://localhost/api/domains?tenantId=t-other', { method: 'DELETE' }));

    await expectRejected(res, 403);
    expect(domainService.removeCustomDomain).not.toHaveBeenCalled();
  });

  it('BS-AZ-19: 소속되지 않은 테넌트의 add.POST·verify.POST·status.GET → 403, 서비스 미호출', async () => {
    const domainService = createDomainService();
    const routes = createDomainRoutes(domainService, createTenantUserService());
    const body = { tenantId: 't-other', domain: 'blog.example.com' };

    await expectRejected(await routes.add.POST(json('http://localhost/api/domains', 'POST', body)), 403);
    await expectRejected(await routes.verify.POST(json('http://localhost/api/domains/verify', 'POST', body)), 403);
    await expectRejected(
      await routes.status.GET(new Request('http://localhost/api/domains/status?tenantId=t-other&domain=blog.example.com')),
      403,
    );
    expect(domainService.addCustomDomain).not.toHaveBeenCalled();
    expect(domainService.verifyDomain).not.toHaveBeenCalled();
    expect(domainService.checkVerification).not.toHaveBeenCalled();
  });

  it('BS-AZ-20: 경로 파라미터 테넌트의 ADMIN 구성원 add.POST → 201', async () => {
    const domainService = createDomainService();
    const routes = createDomainRoutes(domainService, createTenantUserService({ 't-1:u-1': TenantRole.ADMIN }));

    const res = await routes.add.POST(
      json('http://localhost/api/tenants/t-1/domains', 'POST', { domain: 'blog.example.com' }),
      params({ id: 't-1' }),
    );

    expect(res.status).toBe(201);
    expect(domainService.addCustomDomain).toHaveBeenCalledWith('t-1', 'blog.example.com');
  });

  it('BS-AZ-21: 전체 도메인 목록 list.GET 은 SUPER_ADMIN 만 호출할 수 있다', async () => {
    const domainService = createDomainService();
    const routes = createDomainRoutes(domainService, createTenantUserService({ 't-1:u-1': TenantRole.OWNER }));

    await expectRejected(await routes.list.GET(new Request('http://localhost/api/domains')), 403);
    expect(domainService.listCustomDomains).not.toHaveBeenCalled();

    auth.user = SUPER_ADMIN;
    expect((await routes.list.GET(new Request('http://localhost/api/domains'))).status).toBe(200);
  });
});

// ── createBlogSystem 조립 ──

describe('createBlogSystem multi 모드 조립', () => {
  it('BS-AZ-22: billing·domain 라우트가 시스템의 테넌트 멤버십으로 소속을 확인한다', async () => {
    const delegate = () => ({
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    });
    const prisma: any = {
      tenant: delegate(),
      tenantUser: delegate(),
      user: delegate(),
      subscription: delegate(),
      plan: delegate(),
      usageRecord: delegate(),
      $transaction: vi.fn(),
      $queryRawUnsafe: vi.fn(),
    };

    const system = createBlogSystem({
      mode: 'multi',
      prisma,
      auth: { jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars' },
      blog: { modelName: 'news' },
      billing: { stripeSecretKey: 'sk_test_xxx', stripeWebhookSecret: 'whsec_xxx', plans: [] },
      domain: { baseDomain: 'blog.example.com' },
    });

    const domainRes = await system.routes.domain!.remove.DELETE(
      new Request('http://localhost/api/domains?tenantId=t-other', { method: 'DELETE' }),
    );
    const billingRes = await system.routes.billing!.subscription.GET(
      new Request('http://localhost/api/billing/subscription?tenantId=t-other'),
    );

    await expectRejected(domainRes, 403);
    await expectRejected(billingRes, 403);
    expect(prisma.tenantUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId_userId: { tenantId: 't-other', userId: 'u-1' } } }),
    );
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });
});
