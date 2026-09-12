# 06. 과금 — Stripe 연동

`createBillingService`는 Stripe 기반 구독 관리, 체크아웃/포털, 사용량 추적, 웹훅 처리를 제공한다.

> **주의**: 과금은 **멀티 테넌트 모드 전용**이다. single 모드에서는 활성화하지 않는다.

## 설정

```ts
createBlogSystem({
  mode: 'multi',
  // ...
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    plans: [
      {
        id: 'free',
        name: 'Free',
        stripePriceId: 'price_xxx',
        limits: { posts: 10, customDomains: 0 },
      },
      {
        id: 'pro',
        name: 'Pro',
        stripePriceId: 'price_yyy',
        limits: { posts: 1000, customDomains: 1 },
      },
    ],
  },
});
```

`createBlogSystem`이 `system.billingService`, `system.planService`, `system.routes.billing`을 생성.

## `BillingService` API

```ts
interface BillingService {
  // 고객
  createCustomer(tenantId, email, name?): Promise<string>;

  // 구독
  createSubscription(tenantId, planId): Promise<Subscription>;
  cancelSubscription(tenantId, cancelImmediately?): Promise<void>;
  changePlan(tenantId, newPlanId): Promise<Subscription>;
  getSubscription(tenantId): Promise<Subscription | null>;

  // 체크아웃
  createCheckoutSession(tenantId, planId, successUrl, cancelUrl): Promise<string>;
  createPortalSession(tenantId, returnUrl): Promise<string>;

  // 사용량
  trackUsage(tenantId, metric, value): Promise<void>;
  getUsage(tenantId, period?): Promise<UsageRecord[]>;
  checkLimit(tenantId, metric): Promise<UsageCheck>;

  // 웹훅
  handleWebhook(payload, signature): Promise<void>;
}
```

## Plan 정의

```ts
interface PlanDefinition {
  id: string;
  name: string;
  stripePriceId: string;    // Stripe Dashboard에서 복사
  limits: Record<string, number>;
}
```

Stripe Dashboard에서 **Price**를 생성하고 `price_xxx` ID를 `stripePriceId`에 붙여 넣는다.

## 구독 생성 플로우

```
1. 테넌트 생성 + OWNER 사용자 생성 (onboarding)
2. Stripe 고객 생성: billingService.createCustomer(tenantId, email)
3. 체크아웃 세션 URL 생성: billingService.createCheckoutSession(...)
4. 사용자 → Stripe Checkout 페이지로 리다이렉트
5. 결제 완료 → Stripe이 webhook 발송 → 서버가 subscription 상태 업데이트
```

### 체크아웃 라우트

```ts
// app/api/billing/checkout/route.ts
export async function POST(req: Request) {
  const { tenantId, planId } = await req.json();
  const url = await system.billingService!.createCheckoutSession(
    tenantId,
    planId,
    `${process.env.NEXT_PUBLIC_APP_URL}/billing/success`,
    `${process.env.NEXT_PUBLIC_APP_URL}/billing/cancel`,
  );
  return Response.json({ url });
}
```

### 고객 포털 (구독 관리)

```ts
export async function POST() {
  const url = await system.billingService!.createPortalSession(
    tenantId,
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  );
  return Response.redirect(url, 302);
}
```

## 웹훅 처리

Stripe → 웹훅 → 서버가 구독 상태를 DB에 반영.

```ts
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  try {
    await system.billingService!.handleWebhook(payload, signature);
    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Invalid signature', { status: 400 });
  }
}

// 이 라우트는 raw body가 필요하다 — Next.js App Router는 기본 raw 지원
```

지원되는 Stripe 이벤트(내부 구현):
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

> **주의**: 웹훅 엔드포인트는 **공개**되어야 하지만, 반드시 `stripe-signature` 헤더로 서명 검증을 해야 한다.
> `STRIPE_WEBHOOK_SECRET`이 유출되면 공격자가 위조 이벤트를 보낼 수 있다.

### Stripe CLI로 로컬 테스트

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 사용량 추적 + 제한

```ts
// 글 생성 시 카운트
await system.billingService!.trackUsage(tenantId, 'posts', 1);

// 제한 체크
const { allowed, current, limit } = await system.billingService!.checkLimit(tenantId, 'posts');
if (!allowed) {
  return Response.json(
    { error: '플랜 한도 초과', current, limit },
    { status: 402 },   // Payment Required
  );
}
```

### 유용한 사용량 지표 예

- `posts` — 발행된 글 수
- `storage_mb` — R2 스토리지 사용량
- `api_requests` — 분당 API 호출 수
- `custom_domains` — 연결된 커스텀 도메인 수

## 구독 상태

```ts
type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';
```

`past_due`, `incomplete` 상태면 기능을 제한하되, 그레이스 피리어드(예: 7일)는 허용하는 UX를 권장.

## 플랜 변경

```ts
await system.billingService!.changePlan(tenantId, 'pro');
// Stripe: subscription item price 교체 (즉시 비례 결제)
```

> **주의**: 다운그레이드 시 기존 사용량이 새 한도를 초과할 수 있다.
> UI에서 경고하거나, 초과 리소스 숨김/아카이브 정책을 명시하자.

## 관련 문서

- [03-multi-tenant.md](./03-multi-tenant.md) — 멀티 모드 요구 사항
- [10-deployment.md](./10-deployment.md) — Stripe 환경변수 + 웹훅 설정
