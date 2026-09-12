import Stripe from 'stripe';
import type { Subscription, UsageRecord, UsageCheck } from '../types/billing';
import { createWebhookHandler } from './webhook-handler';

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

export interface BillingService {
  createCustomer(tenantId: string, email: string, name?: string): Promise<string>;
  createSubscription(tenantId: string, planId: string): Promise<Subscription>;
  cancelSubscription(tenantId: string, cancelImmediately?: boolean): Promise<void>;
  changePlan(tenantId: string, newPlanId: string): Promise<Subscription>;
  getSubscription(tenantId: string): Promise<Subscription | null>;
  createCheckoutSession(
    tenantId: string,
    planId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string>;
  createPortalSession(tenantId: string, returnUrl: string): Promise<string>;
  trackUsage(tenantId: string, metric: string, value: number): Promise<void>;
  getUsage(tenantId: string, period?: Date): Promise<UsageRecord[]>;
  checkLimit(tenantId: string, metric: string): Promise<UsageCheck>;
  handleWebhook(payload: string, signature: string): Promise<void>;
}

export function createBillingService(
  prisma: any,
  stripeConfig: StripeConfig,
): BillingService {
  const stripe = new Stripe(stripeConfig.secretKey);
  const webhookHandler = createWebhookHandler(prisma, stripe);

  return {
    async createCustomer(
      tenantId: string,
      email: string,
      name?: string,
    ): Promise<string> {
      const customer = await stripe.customers.create({
        email,
        name: name ?? undefined,
        metadata: { tenantId },
      });

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId: customer.id },
      });

      return customer.id;
    },

    async createSubscription(
      tenantId: string,
      planId: string,
    ): Promise<Subscription> {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new Error(`플랜을 찾을 수 없습니다: ${planId}`);
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant?.stripeCustomerId) {
        throw new Error('Stripe 고객이 아직 생성되지 않았습니다');
      }

      let stripeSubscription: Stripe.Subscription | null = null;
      if (plan.stripePriceId) {
        stripeSubscription = await stripe.subscriptions.create({
          customer: tenant.stripeCustomerId,
          items: [{ price: plan.stripePriceId }],
        });
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId,
          stripeSubscriptionId: stripeSubscription?.id ?? null,
          stripeCustomerId: tenant.stripeCustomerId,
          status: 'ACTIVE',
          currentPeriodStart: stripeSubscription
            ? new Date(stripeSubscription.current_period_start * 1000)
            : now,
          currentPeriodEnd: stripeSubscription
            ? new Date(stripeSubscription.current_period_end * 1000)
            : periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      return mapToSubscription(subscription);
    },

    async cancelSubscription(
      tenantId: string,
      cancelImmediately?: boolean,
    ): Promise<void> {
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      });

      if (!subscription) {
        throw new Error('활성 구독이 없습니다');
      }

      if (subscription.stripeSubscriptionId) {
        if (cancelImmediately) {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } else {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        }
      }

      if (cancelImmediately) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', cancelAtPeriodEnd: false },
        });
      } else {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { cancelAtPeriodEnd: true },
        });
      }
    },

    async changePlan(
      tenantId: string,
      newPlanId: string,
    ): Promise<Subscription> {
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
      });

      if (!subscription) {
        throw new Error('활성 구독이 없습니다');
      }

      const newPlan = await prisma.plan.findUnique({
        where: { id: newPlanId },
      });
      if (!newPlan) {
        throw new Error(`플랜을 찾을 수 없습니다: ${newPlanId}`);
      }

      if (subscription.stripeSubscriptionId && newPlan.stripePriceId) {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId,
        );
        const itemId = stripeSubscription.items.data[0]?.id;

        if (itemId) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [{ id: itemId, price: newPlan.stripePriceId }],
          });
        }
      }

      const updated = await prisma.subscription.update({
        where: { id: subscription.id },
        data: { planId: newPlanId, cancelAtPeriodEnd: false },
      });

      return mapToSubscription(updated);
    },

    async getSubscription(tenantId: string): Promise<Subscription | null> {
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      return subscription ? mapToSubscription(subscription) : null;
    },

    async createCheckoutSession(
      tenantId: string,
      planId: string,
      successUrl: string,
      cancelUrl: string,
    ): Promise<string> {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan?.stripePriceId) {
        throw new Error('Stripe 가격이 설정되지 않은 플랜입니다');
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: tenant?.stripeCustomerId ?? undefined,
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { tenantId, planId },
      });

      if (!session.url) {
        throw new Error('체크아웃 세션 URL 생성 실패');
      }

      return session.url;
    },

    async createPortalSession(
      tenantId: string,
      returnUrl: string,
    ): Promise<string> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant?.stripeCustomerId) {
        throw new Error('Stripe 고객이 아직 생성되지 않았습니다');
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    },

    async trackUsage(
      tenantId: string,
      metric: string,
      value: number,
    ): Promise<void> {
      const period = getMonthStart(new Date());

      // upsert로 원자적 기록 — @@unique([tenantId, metric, period]) 복합 유니크 제약 활용
      await prisma.usageRecord.upsert({
        where: {
          tenantId_metric_period: { tenantId, metric, period },
        },
        create: { tenantId, metric, value, period },
        update: { value: { increment: value } },
      });
    },

    async getUsage(
      tenantId: string,
      period?: Date,
    ): Promise<UsageRecord[]> {
      const targetPeriod = period ? getMonthStart(period) : getMonthStart(new Date());

      const records = await prisma.usageRecord.findMany({
        where: { tenantId, period: targetPeriod },
      });

      return records.map(mapToUsageRecord);
    },

    async checkLimit(
      tenantId: string,
      metric: string,
    ): Promise<UsageCheck> {
      const subscription = await prisma.subscription.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        include: { plan: true },
      });

      if (!subscription?.plan) {
        return { allowed: false, current: 0, max: 0, metric };
      }

      const max = getMetricMax(subscription.plan, metric);

      const period = getMonthStart(new Date());
      const usage = await prisma.usageRecord.findFirst({
        where: { tenantId, metric, period },
      });

      const current = usage?.value ?? 0;

      return {
        allowed: current < max,
        current,
        max,
        metric,
      };
    },

    async handleWebhook(payload: string, signature: string): Promise<void> {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeConfig.webhookSecret,
      );

      await webhookHandler.handleEvent(event);
    },
  };
}

function mapToSubscription(record: any): Subscription {
  return {
    id: record.id,
    tenantId: record.tenantId,
    planId: record.planId,
    stripeSubscriptionId: record.stripeSubscriptionId ?? undefined,
    stripeCustomerId: record.stripeCustomerId ?? undefined,
    status: record.status,
    currentPeriodStart: new Date(record.currentPeriodStart),
    currentPeriodEnd: new Date(record.currentPeriodEnd),
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  };
}

function mapToUsageRecord(record: any): UsageRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    metric: record.metric,
    value: record.value,
    period: new Date(record.period),
  };
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMetricMax(plan: any, metric: string): number {
  switch (metric) {
    case 'posts':
      return plan.maxPosts;
    case 'storage_bytes':
      return plan.maxStorage;
    case 'api_calls':
      // API 호출 제한은 플랜에 별도 필드가 없으므로 기본값 사용
      return Number.MAX_SAFE_INTEGER;
    default:
      return 0;
  }
}
