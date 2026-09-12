/**
 * WebhookHandler 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookHandler, type WebhookHandler } from '../../src/billing/webhook-handler';
import type Stripe from 'stripe';

// ── Prisma 모킹 ──

function createMockPrisma() {
  return {
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

// ── 헬퍼: Stripe 이벤트 생성 ──

function createStripeEvent(type: string, dataObject: any): Stripe.Event {
  return {
    id: `evt_${Date.now()}`,
    type,
    data: { object: dataObject },
    object: 'event',
    api_version: '2024-01-01',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

// ── 테스트 ──

describe('WebhookHandler', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let handler: WebhookHandler;
  const mockStripe = {} as Stripe;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    handler = createWebhookHandler(prisma, mockStripe);
  });

  // ── customer.subscription.created ──

  describe('customer.subscription.created', () => {
    it('DB에 Subscription 레코드를 업데이트한다', async () => {
      const now = Math.floor(Date.now() / 1000);
      const stripeSubscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 3600,
        cancel_at_period_end: false,
      };

      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-1',
        stripeCustomerId: 'cus_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      const event = createStripeEvent('customer.subscription.created', stripeSubscription);
      await handler.handleEvent(event);

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_123' },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: {
          stripeSubscriptionId: 'sub_123',
          status: 'ACTIVE',
          currentPeriodStart: new Date(now * 1000),
          currentPeriodEnd: new Date((now + 30 * 24 * 3600) * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    });
  });

  // ── customer.subscription.updated ──

  describe('customer.subscription.updated', () => {
    it('구독 상태 및 플랜 변경을 반영한다', async () => {
      const now = Math.floor(Date.now() / 1000);
      const stripeSubscription = {
        id: 'sub_123',
        status: 'past_due',
        current_period_start: now,
        current_period_end: now + 30 * 24 * 3600,
        cancel_at_period_end: true,
      };

      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-1',
        stripeSubscriptionId: 'sub_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      const event = createStripeEvent('customer.subscription.updated', stripeSubscription);
      await handler.handleEvent(event);

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_123' },
      });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: {
          status: 'PAST_DUE',
          currentPeriodStart: new Date(now * 1000),
          currentPeriodEnd: new Date((now + 30 * 24 * 3600) * 1000),
          cancelAtPeriodEnd: true,
        },
      });
    });
  });

  // ── customer.subscription.deleted ──

  describe('customer.subscription.deleted', () => {
    it('구독 상태를 CANCELED로 변경한다', async () => {
      const stripeSubscription = {
        id: 'sub_123',
        status: 'canceled',
        current_period_start: 0,
        current_period_end: 0,
        cancel_at_period_end: false,
      };

      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-1',
        stripeSubscriptionId: 'sub_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      const event = createStripeEvent('customer.subscription.deleted', stripeSubscription);
      await handler.handleEvent(event);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
        },
      });
    });
  });

  // ── invoice.payment_succeeded ──

  describe('invoice.payment_succeeded', () => {
    it('결제 성공 시 구독 상태를 ACTIVE로 갱신한다', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
      };

      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-1',
        stripeSubscriptionId: 'sub_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      const event = createStripeEvent('invoice.payment_succeeded', invoice);
      await handler.handleEvent(event);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: { status: 'ACTIVE' },
      });
    });
  });

  // ── invoice.payment_failed ──

  describe('invoice.payment_failed', () => {
    it('결제 실패 시 구독 상태를 PAST_DUE로 변경한다', async () => {
      const invoice = {
        id: 'in_456',
        subscription: 'sub_123',
      };

      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-db-1',
        stripeSubscriptionId: 'sub_123',
      });
      prisma.subscription.update.mockResolvedValue({});

      const event = createStripeEvent('invoice.payment_failed', invoice);
      await handler.handleEvent(event);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-db-1' },
        data: { status: 'PAST_DUE' },
      });
    });
  });

  // ── 알 수 없는 이벤트 타입 ──

  describe('알 수 없는 이벤트 타입', () => {
    it('알 수 없는 이벤트 타입은 무시한다 (에러 없음)', async () => {
      const event = createStripeEvent('unknown.event.type', {});

      await expect(handler.handleEvent(event)).resolves.toBeUndefined();
      expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });
});
