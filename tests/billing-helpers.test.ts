/**
 * Task 12: billing-service 헬퍼 함수 테스트 (9건)
 *
 * 내부 함수(getMonthStart, getMetricMax, mapToSubscription, mapToUsageRecord)는
 * 공개 API(createBillingService)를 통해 간접 테스트한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stripe를 mock해서 createBillingService가 초기화할 수 있게 한다
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

import { createBillingService } from '@withwiz/blog-system/billing';

function createMockPrisma() {
  return {
    tenant: { findUnique: vi.fn(), update: vi.fn() },
    plan: { findUnique: vi.fn() },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    usageRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe('billing-service 헬퍼 함수', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReturnType<typeof createBillingService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = createBillingService(prisma as any, {
      secretKey: 'sk_test_xxx',
      webhookSecret: 'whsec_xxx',
    });
  });

  // ── getMonthStart 간접 테스트 (getUsage를 통해) ──
  it('BS-BH-01: getMonthStart — 2025-03-15 → 2025-03-01', async () => {
    prisma.usageRecord.findMany.mockResolvedValue([]);
    // getUsage 호출 시 period 인자로 3월 15일을 전달하면 내부에서 3월 1일로 변환
    await service.getUsage('t-1', new Date(2025, 2, 15));
    expect(prisma.usageRecord.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't-1',
        period: new Date(2025, 2, 1),
      },
    });
  });

  it('BS-BH-02: getMonthStart — 1월 1일 → 1월 1일', async () => {
    prisma.usageRecord.findMany.mockResolvedValue([]);
    await service.getUsage('t-1', new Date(2025, 0, 1));
    expect(prisma.usageRecord.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: 't-1',
        period: new Date(2025, 0, 1),
      },
    });
  });

  it('BS-BH-03: getMonthStart — 시간 00:00:00 초기화', async () => {
    prisma.usageRecord.findMany.mockResolvedValue([]);
    await service.getUsage('t-1', new Date(2025, 2, 15, 14, 30, 45));
    const period = prisma.usageRecord.findMany.mock.calls[0][0].where.period as Date;
    expect(period.getHours()).toBe(0);
    expect(period.getMinutes()).toBe(0);
    expect(period.getSeconds()).toBe(0);
  });

  // ── getMetricMax 간접 테스트 (checkLimit를 통해) ──
  it('BS-BH-04: getMetricMax — posts → plan.maxPosts', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      plan: { maxPosts: 100, maxStorage: 5000, maxUsers: 10 },
    });
    prisma.usageRecord.findFirst.mockResolvedValue({ value: 50 });
    const result = await service.checkLimit('t-1', 'posts');
    expect(result.max).toBe(100);
    expect(result.allowed).toBe(true);
  });

  it('BS-BH-05: getMetricMax — storage_bytes → plan.maxStorage', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      plan: { maxPosts: 100, maxStorage: 5000, maxUsers: 10 },
    });
    prisma.usageRecord.findFirst.mockResolvedValue({ value: 3000 });
    const result = await service.checkLimit('t-1', 'storage_bytes');
    expect(result.max).toBe(5000);
  });

  it('BS-BH-06: getMetricMax — api_calls → Number.MAX_SAFE_INTEGER', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      plan: { maxPosts: 100, maxStorage: 5000, maxUsers: 10 },
    });
    prisma.usageRecord.findFirst.mockResolvedValue(null);
    const result = await service.checkLimit('t-1', 'api_calls');
    expect(result.max).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('BS-BH-07: getMetricMax — 미지원 메트릭 → 0', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      plan: { maxPosts: 100, maxStorage: 5000, maxUsers: 10 },
    });
    prisma.usageRecord.findFirst.mockResolvedValue(null);
    const result = await service.checkLimit('t-1', 'unknown_metric');
    expect(result.max).toBe(0);
  });

  // ── mapToSubscription 간접 테스트 (getSubscription을 통해) ──
  it('BS-BH-08: mapToSubscription — null 필드 → undefined', async () => {
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      tenantId: 't-1',
      planId: 'plan-1',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
    });

    const result = await service.getSubscription('t-1');
    expect(result).not.toBeNull();
    expect(result!.stripeSubscriptionId).toBeUndefined();
    expect(result!.stripeCustomerId).toBeUndefined();
  });

  // ── mapToUsageRecord 간접 테스트 (getUsage를 통해) ──
  it('BS-BH-09: mapToUsageRecord — 정상 변환', async () => {
    const period = new Date(2025, 2, 1);
    prisma.usageRecord.findMany.mockResolvedValue([
      { id: 'ur-1', tenantId: 't-1', metric: 'posts', value: 5, period },
    ]);

    const result = await service.getUsage('t-1', new Date(2025, 2, 15));
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'ur-1',
      tenantId: 't-1',
      metric: 'posts',
      value: 5,
      period: expect.any(Date),
    });
  });
});
