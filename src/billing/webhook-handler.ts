import type Stripe from 'stripe';
import type { SubscriptionStatus } from '../types/billing';

export interface WebhookHandler {
  handleEvent(event: Stripe.Event): Promise<void>;
}

export function createWebhookHandler(
  prisma: any,
  stripe: Stripe,
): WebhookHandler {
  return {
    async handleEvent(event: Stripe.Event): Promise<void> {
      switch (event.type) {
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCreated(prisma, subscription);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdated(prisma, subscription);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(prisma, subscription);
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentSucceeded(prisma, invoice);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await handlePaymentFailed(prisma, invoice);
          break;
        }

        default:
          break;
      }
    },
  };
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'trialing':
      return 'TRIALING';
    default:
      return 'ACTIVE';
  }
}

async function handleSubscriptionCreated(
  prisma: any,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const existing = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!existing) {
    // 웹훅이 API 응답보다 먼저 도착한 경우 — 무시
    return;
  }

  await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      stripeSubscriptionId: subscription.id,
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionUpdated(
  prisma: any,
  subscription: Stripe.Subscription,
): Promise<void> {
  const record = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!record) return;

  await prisma.subscription.update({
    where: { id: record.id },
    data: {
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionDeleted(
  prisma: any,
  subscription: Stripe.Subscription,
): Promise<void> {
  const record = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!record) return;

  await prisma.subscription.update({
    where: { id: record.id },
    data: {
      status: 'CANCELED' as SubscriptionStatus,
      cancelAtPeriodEnd: false,
    },
  });
}

async function handlePaymentSucceeded(
  prisma: any,
  invoice: Stripe.Invoice,
): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

  const record = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!record) return;

  await prisma.subscription.update({
    where: { id: record.id },
    data: { status: 'ACTIVE' as SubscriptionStatus },
  });
}

async function handlePaymentFailed(
  prisma: any,
  invoice: Stripe.Invoice,
): Promise<void> {
  if (!invoice.subscription) return;

  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;

  const record = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!record) return;

  await prisma.subscription.update({
    where: { id: record.id },
    data: { status: 'PAST_DUE' as SubscriptionStatus },
  });
}
