/**
 * BillingService 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Stripe 모킹 ──
// vi.mock은 hoisting되므로 vi.hoisted로 모킹 객체를 먼저 선언한다

const {
  mockStripeCustomers,
  mockStripeSubscriptions,
  mockStripeCheckoutSessions,
  mockStripeBillingPortalSessions,
  mockStripeWebhooks,
} = vi.hoisted(() => ({
  mockStripeCustomers: { create: vi.fn() },
  mockStripeSubscriptions: { create: vi.fn(), cancel: vi.fn(), update: vi.fn(), retrieve: vi.fn() },
  mockStripeCheckoutSessions: { create: vi.fn() },
  mockStripeBillingPortalSessions: { create: vi.fn() },
  mockStripeWebhooks: { constructEvent: vi.fn() },
}));

vi.mock('stripe', () => {
  function StripeMock() {
    return {
      customers: mockStripeCustomers,
      subscriptions: mockStripeSubscriptions,
      checkout: { sessions: mockStripeCheckoutSessions },
      billingPortal: { sessions: mockStripeBillingPortalSessions },
      webhooks: mockStripeWebhooks,
    };
  }
  return { default: StripeMock };
});

import { createBillingService, type BillingService } from '../../src/billing/billing-service';

// ── Prisma 모킹 ──

function createMockPrisma() {
  return {
    tenant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    },
    subscription: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    usageRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

// ── 테스트 ──

describe('BillingService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = createBillingService(prisma, {
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    });
  });

  // ── 팩토리 ──

  describe('createBillingService 팩토리', () => {
    it('prisma + stripe config으로 BillingService 인스턴스를 생성한다', () => {
      expect(service).toBeDefined();
      expect(service.createCustomer).toBeTypeOf('function');
      expect(service.createSubscription).toBeTypeOf('function');
      expect(service.cancelSubscription).toBeTypeOf('function');
      expect(service.changePlan).toBeTypeOf('function');
      expect(service.createCheckoutSession).toBeTypeOf('function');
      expect(service.createPortalSession).toBeTypeOf('function');
      expect(service.trackUsage).toBeTypeOf('function');
      expect(service.checkLimit).toBeTypeOf('function');
      expect(service.handleWebhook).toBeTypeOf('function');
    });
  });

  // ── 고객 관리 ──

  describe('createCustomer', () => {
    it('tenantId + email로 Stripe 고객을 생성하고 stripeCustomerId를 반환한다', async () => {
      mockStripeCustomers.create.mockResolvedValue({ id: 'cus_123' });
      prisma.tenant.update.mockResolvedValue({});

      const result = await service.createCustomer('tenant-1', 'test@example.com', 'Test User');

      expect(result).toBe('cus_123');
      expect(mockStripeCustomers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
        metadata: { tenantId: 'tenant-1' },
      });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { stripeCustomerId: 'cus_123' },
      });
    });
  });

  // ── 구독 관리 ──

  describe('createSubscription', () => {
    const mockPlan = {
      id: 'plan-1',
      name: 'Pro',
      stripePriceId: 'price_123',
      maxPosts: 100,
      maxStorage: 1000000,
    };

    const mockTenant = {
      id: 'tenant-1',
      stripeCustomerId: 'cus_123',
    };

    it('정상: tenantId + planId로 Subscription을 반환한다', async () => {
      prisma.plan.findUnique.mockResolvedValue(mockPlan);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const now = Math.floor(Date.now() / 1000);
      mockStripeSubscriptions.create.mockResolvedValue({
        id: 'sub_123',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 3600,
      });

      const subscriptionRecord = {
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        planId: 'plan-1',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'ACTIVE',
        currentPeriodStart: new Date(now * 1000),
        currentPeriodEnd: new Date((now + 30 * 24 * 3600) * 1000),
        cancelAtPeriodEnd: false,
      };
      prisma.subscription.create.mockResolvedValue(subscriptionRecord);

      const result = await service.createSubscription('tenant-1', 'plan-1');

      expect(result.id).toBe('sub-db-1');
      expect(result.status).toBe('ACTIVE');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.planId).toBe('plan-1');
      expect(mockStripeSubscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        items: [{ price: 'price_123' }],
      });
    });

    it('Plan에 stripePriceId가 없으면 Stripe 구독 없이 DB 레코드만 생성한다', async () => {
      const planWithoutStripe = { ...mockPlan, stripePriceId: null };
      prisma.plan.findUnique.mockResolvedValue(planWithoutStripe);
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const subscriptionRecord = {
        id: 'sub-db-2',
        tenantId: 'tenant-1',
        planId: 'plan-1',
        stripeSubscriptionId: null,
        stripeCustomerId: 'cus_123',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };
      prisma.subscription.create.mockResolvedValue(subscriptionRecord);

      const result = await service.createSubscription('tenant-1', 'plan-1');

      expect(result.id).toBe('sub-db-2');
      expect(mockStripeSubscriptions.create).not.toHaveBeenCalled();
    });
  });

  // ── 구독 해지 ──

  describe('cancelSubscription', () => {
    const activeSubscription = {
      id: 'sub-db-1',
      tenantId: 'tenant-1',
      stripeSubscriptionId: 'sub_123',
      status: 'ACTIVE',
    };

    it('cancelImmediately=false이면 cancel_at_period_end를 설정한다', async () => {
      prisma.subscription.findFirst.mockResolvedValue(activeSubscription);
      mockStripeSubscriptions.update.mockResolvedValue({});
      prisma.subscription.update.mockResolvedValue({});

      await service.cancelSubscription('tenant-1', false);

      expect(mockStripeSubscriptions.update).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: { cancelAtPeriodEnd: true },
      });
    });

    it('cancelImmediately=true이면 즉시 취소한다', async () => {
      prisma.subscription.findFirst.mockResolvedValue(activeSubscription);
      mockStripeSubscriptions.cancel.mockResolvedValue({});
      prisma.subscription.update.mockResolvedValue({});

      await service.cancelSubscription('tenant-1', true);

      expect(mockStripeSubscriptions.cancel).toHaveBeenCalledWith('sub_123');
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: { status: 'CANCELED', cancelAtPeriodEnd: false },
      });
    });

    it('활성 구독이 없으면 에러를 던진다', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelSubscription('tenant-1')).rejects.toThrow(
        '활성 구독이 없습니다',
      );
    });
  });

  // ── 플랜 변경 ──

  describe('changePlan', () => {
    it('기존 구독의 플랜을 변경한다', async () => {
      const subscription = {
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        stripeSubscriptionId: 'sub_123',
        status: 'ACTIVE',
      };
      const newPlan = {
        id: 'plan-2',
        name: 'Enterprise',
        stripePriceId: 'price_456',
      };

      prisma.subscription.findFirst.mockResolvedValue(subscription);
      prisma.plan.findUnique.mockResolvedValue(newPlan);
      mockStripeSubscriptions.retrieve.mockResolvedValue({
        items: { data: [{ id: 'si_123' }] },
      });
      mockStripeSubscriptions.update.mockResolvedValue({});

      const updatedRecord = {
        id: 'sub-db-1',
        tenantId: 'tenant-1',
        planId: 'plan-2',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };
      prisma.subscription.update.mockResolvedValue(updatedRecord);

      const result = await service.changePlan('tenant-1', 'plan-2');

      expect(result.planId).toBe('plan-2');
      expect(mockStripeSubscriptions.update).toHaveBeenCalledWith('sub_123', {
        items: [{ id: 'si_123', price: 'price_456' }],
      });
    });
  });

  // ── 체크아웃 ──

  describe('createCheckoutSession', () => {
    it('successUrl + cancelUrl로 체크아웃 URL을 반환한다', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        stripePriceId: 'price_123',
      });
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
      });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/session_123',
      });

      const result = await service.createCheckoutSession(
        'tenant-1',
        'plan-1',
        'https://example.com/success',
        'https://example.com/cancel',
      );

      expect(result).toBe('https://checkout.stripe.com/session_123');
      expect(mockStripeCheckoutSessions.create).toHaveBeenCalledWith({
        mode: 'subscription',
        customer: 'cus_123',
        line_items: [{ price: 'price_123', quantity: 1 }],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: { tenantId: 'tenant-1', planId: 'plan-1' },
      });
    });
  });

  // ── 포털 세션 ──

  describe('createPortalSession', () => {
    it('returnUrl로 포털 URL을 반환한다', async () => {
      prisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        stripeCustomerId: 'cus_123',
      });
      mockStripeBillingPortalSessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/portal_123',
      });

      const result = await service.createPortalSession(
        'tenant-1',
        'https://example.com/dashboard',
      );

      expect(result).toBe('https://billing.stripe.com/portal_123');
    });
  });

  // ── 사용량 ──

  describe('trackUsage', () => {
    it('Prisma upsert 단일 호출로 원자적으로 기록한다 (race condition 방지)', async () => {
      prisma.usageRecord.upsert.mockResolvedValue({});

      await service.trackUsage('tenant-1', 'posts', 5);

      // 단일 upsert 호출 (findFirst + create/update 조합이 아님)
      expect(prisma.usageRecord.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.usageRecord.findFirst).not.toHaveBeenCalled();
      expect(prisma.usageRecord.create).not.toHaveBeenCalled();
      expect(prisma.usageRecord.update).not.toHaveBeenCalled();

      const call = prisma.usageRecord.upsert.mock.calls[0][0];
      expect(call.where.tenantId_metric_period).toMatchObject({
        tenantId: 'tenant-1',
        metric: 'posts',
      });
      expect(call.create).toMatchObject({
        tenantId: 'tenant-1',
        metric: 'posts',
        value: 5,
      });
      // update 측은 증가 연산 (increment)
      expect(call.update).toEqual({ value: { increment: 5 } });
    });
  });

  // ── 사용량 제한 ──

  describe('checkLimit', () => {
    it('사용량 < 한도이면 allowed: true를 반환한다', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        plan: { maxPosts: 100, maxStorage: 1000000 },
      });
      prisma.usageRecord.findFirst.mockResolvedValue({ value: 50 });

      const result = await service.checkLimit('tenant-1', 'posts');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(50);
      expect(result.max).toBe(100);
    });

    it('사용량 >= 한도이면 allowed: false를 반환한다', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        plan: { maxPosts: 100, maxStorage: 1000000 },
      });
      prisma.usageRecord.findFirst.mockResolvedValue({ value: 100 });

      const result = await service.checkLimit('tenant-1', 'posts');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(100);
      expect(result.max).toBe(100);
    });

    it('활성 구독이 없으면 allowed: false를 반환한다', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.checkLimit('tenant-1', 'posts');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(0);
      expect(result.max).toBe(0);
    });
  });
});
