/**
 * 과금 라우트 핸들러 통합 테스트 (5건)
 *
 * createBillingRoutes()로 생성된 핸들러를 실제 Request 객체로 호출하여
 * Response 상태 코드와 JSON 응답을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 미들웨어 모킹 ──

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = { request: req, user: undefined, metadata: {} };
      return handler(context, props);
    };
  }),
  withAdminApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = {
        request: req,
        user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
        metadata: {},
      };
      return handler(context, props);
    };
  }),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn().mockReturnValue({ page: 1, limit: 10 }),
  getSearchParam: vi.fn().mockReturnValue(null),
}));

import { createBillingRoutes } from '@withwiz/blog-system/routes';

// ── Mock 서비스 팩토리 ──

function createMockBillingService() {
  return {
    createCheckoutSession: vi.fn().mockResolvedValue(
      'https://checkout.stripe.com/session_xxx',
    ),
    createPortalSession: vi.fn().mockResolvedValue(
      'https://billing.stripe.com/portal_xxx',
    ),
    getSubscription: vi.fn().mockResolvedValue({
      id: 'sub-1',
      tenantId: 't-1',
      planId: 'plan-1',
      status: 'active',
    }),
    getUsage: vi.fn().mockResolvedValue({
      posts: 42,
      storage: 1024,
      period: '2026-04',
    }),
    handleWebhook: vi.fn().mockResolvedValue(undefined),
    cancelSubscription: vi.fn(),
    recordUsage: vi.fn(),
    checkUsageLimit: vi.fn(),
  } as any;
}

function createMockPlanService() {
  return {
    listActive: vi.fn().mockResolvedValue([
      { id: 'plan-1', name: 'Starter', maxPosts: 100, maxStorage: 5000, isActive: true },
      { id: 'plan-2', name: 'Pro', maxPosts: 1000, maxStorage: 50000, isActive: true },
    ]),
    create: vi.fn().mockResolvedValue({
      id: 'plan-new',
      name: 'Enterprise',
    }),
    update: vi.fn().mockResolvedValue({
      id: 'plan-1',
      name: 'Starter Updated',
    }),
    getById: vi.fn(),
  } as any;
}

describe('과금 라우트 핸들러', () => {
  let billingService: ReturnType<typeof createMockBillingService>;
  let planService: ReturnType<typeof createMockPlanService>;
  let routes: ReturnType<typeof createBillingRoutes>;

  beforeEach(() => {
    billingService = createMockBillingService();
    planService = createMockPlanService();
    routes = createBillingRoutes(billingService, planService);
  });

  // ── 플랜 목록 ──

  it('BS-BI-01: 플랜 목록 — GET → 활성 플랜 목록 반환', async () => {
    const req = new Request('http://localhost/api/billing/plans');
    const res = await routes.plans.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  // ── 체크아웃 세션 ──

  it('BS-BI-02: 체크아웃 생성 — POST → 세션 URL 반환', async () => {
    const req = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 't-1',
        planId: 'plan-1',
        successUrl: 'http://localhost/success',
        cancelUrl: 'http://localhost/cancel',
      }),
    });
    const res = await routes.checkout.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.url).toContain('stripe.com');
  });

  // ── 구독 조회 ──

  it('BS-BI-03: 구독 조회 — GET → 구독 정보 반환', async () => {
    const req = new Request(
      'http://localhost/api/billing/subscription?tenantId=t-1',
    );
    const res = await routes.subscription.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');
  });

  // ── 사용량 조회 ──

  it('BS-BI-04: 사용량 조회 — GET → 사용량 통계 반환', async () => {
    const req = new Request(
      'http://localhost/api/billing/usage?tenantId=t-1',
    );
    const res = await routes.usage.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.posts).toBe(42);
  });

  // ── Stripe 웹훅 ──

  it('BS-BI-05: 웹훅 — POST 유효 Stripe 이벤트 → 처리 완료', async () => {
    const req = new Request('http://localhost/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'sig_test_xxx',
      },
      body: JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_xxx' } },
      }),
    });
    const res = await routes.webhook.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.received).toBe(true);
    expect(billingService.handleWebhook).toHaveBeenCalled();
  });
});
