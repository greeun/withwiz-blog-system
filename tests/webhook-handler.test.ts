/**
 * Task 10: webhook-handler 테스트 (11건)
 *
 * mapStripeStatus는 비공개 함수이므로 handleEvent를 통해 간접 테스트.
 * mapStripeStatus 자체 테스트를 위해 구독 생성 이벤트의 update 호출 인자를 검사.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookHandler } from '@withwiz/blog-system/billing';
import type Stripe from 'stripe';

function createMockPrisma() {
  return {
    subscription: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
}

function makeSubscriptionEvent(
  type: string,
  subscription: Partial<Stripe.Subscription>,
): Stripe.Event {
  return {
    type,
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
        ...subscription,
      },
    },
  } as unknown as Stripe.Event;
}

function makeInvoiceEvent(
  type: string,
  invoice: Partial<Stripe.Invoice>,
): Stripe.Event {
  return {
    type,
    data: {
      object: {
        subscription: 'sub_123',
        ...invoice,
      },
    },
  } as unknown as Stripe.Event;
}

describe('createWebhookHandler', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let handler: ReturnType<typeof createWebhookHandler>;

  beforeEach(() => {
    prisma = createMockPrisma();
    handler = createWebhookHandler(prisma as any, {} as any);
  });

  // ── mapStripeStatus 간접 테스트 ──
  it('BS-WH-01: mapStripeStatus — active → ACTIVE', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'active' }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('BS-WH-02: mapStripeStatus — past_due → PAST_DUE', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'past_due' }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAST_DUE' }),
      }),
    );
  });

  it('BS-WH-03: mapStripeStatus — canceled → CANCELED', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'canceled' }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    );
  });

  it('BS-WH-04: mapStripeStatus — trialing → TRIALING', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'trialing' }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'TRIALING' }),
      }),
    );
  });

  it('BS-WH-05: mapStripeStatus — unknown → ACTIVE 기본값', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', { status: 'incomplete' as any }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  // ── handleEvent 라우팅 ──
  it('BS-WH-06: handleEvent — customer.subscription.created 라우팅', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1', stripeCustomerId: 'cus_123' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.created', {}));
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: 'cus_123' } }),
    );
  });

  it('BS-WH-07: handleEvent — customer.subscription.updated 라우팅', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.updated', {}));
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeSubscriptionId: 'sub_123' } }),
    );
  });

  it('BS-WH-08: handleEvent — customer.subscription.deleted 라우팅', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeSubscriptionEvent('customer.subscription.deleted', {}));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    );
  });

  it('BS-WH-09: handleEvent — invoice.payment_succeeded 라우팅', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeInvoiceEvent('invoice.payment_succeeded', {}));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });

  it('BS-WH-10: handleEvent — invoice.payment_failed 라우팅', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: 'rec-1' });
    prisma.subscription.update.mockResolvedValue({});

    await handler.handleEvent(makeInvoiceEvent('invoice.payment_failed', {}));
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAST_DUE' }),
      }),
    );
  });

  it('BS-WH-11: handleEvent — 미지원 이벤트 → 에러 없이 무시', async () => {
    await expect(
      handler.handleEvent({ type: 'unknown.event', data: { object: {} } } as any),
    ).resolves.not.toThrow();
  });
});
