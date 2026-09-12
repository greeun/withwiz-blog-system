export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';

export interface Plan {
  id: string;
  name: string;
  maxPosts: number;
  /** 바이트 단위 */
  maxStorage: number;
  maxUsers: number;
  /** 센트 단위 */
  priceMonthly: number;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
}

export interface PlanDefinition {
  name: string;
  maxPosts: number;
  maxStorage: number;
  maxUsers: number;
  priceMonthly: number;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  /** 예: 'posts', 'storage_bytes', 'api_calls' */
  metric: string;
  value: number;
  /** 월 시작일 */
  period: Date;
}

export interface UsageCheck {
  allowed: boolean;
  current: number;
  max: number;
  metric: string;
}
