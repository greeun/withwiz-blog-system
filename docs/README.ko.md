# @withwiz/blog-system

> 블로그/뉴스 **SaaS 시스템** — 단일 테넌트 또는 멀티 테넌트 구성을 지원.

`@withwiz/blog-system`은 `@withwiz/blog-core` 위에 **인증 + 테넌트 + 과금(Stripe) + 커스텀 도메인 + 온보딩 + 슈퍼 어드민**을 더한 완전한 SaaS 프레임워크다.
`createBlogSystem({ mode, ... })` 한 줄로 모든 서비스와 API 라우트가 조립된다.

## 의존성

| 패키지 | 역할 |
|---|---|
| `@withwiz/blog-core` | 블로그 CRUD/태그/댓글/검색/스케줄러/SEO (하위 의존) |
| `@withwiz/toolkit` | JWT, OAuth, PasswordHasher, Prisma 리포지토리 (peer) |
| `@prisma/client` | DB 액세스 (peer) |
| `stripe` | 과금 (dep) |

## 언제 blog-system을 쓰는가? vs blog-core 단독

| 상황 | 권장 |
|---|---|
| 단일 사이트 (1개 블로그/뉴스) + 간단한 인증 | **blog-system `mode: 'single'`** — 인증/라우트까지 조립됨 |
| 단일 사이트 + 완전히 커스텀한 인증 | blog-core 단독 |
| **멀티 테넌트 SaaS** (서브도메인/커스텀 도메인, Stripe 과금) | **blog-system `mode: 'multi'`** (필수) |
| 기능의 일부만 쓰고 싶음 | blog-core 단독 또는 필요한 서브패스만 선택적으로 import |

## 빠른 시작 (single)

```ts
// src/lib/blog-system.ts
import { createBlogSystem } from '@withwiz/blog-system';
import { prisma } from '@/lib/prisma';

export const system = createBlogSystem({
  mode: 'single',
  prisma,
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  },
  blog: {
    modelName: 'news',
    basePath: '/blog',
    adminBasePath: '/admin/blog',
    pageSize: 12,
  },
  features: {
    tags: true,
    comments: { enabled: true, maxDepth: 2 },
    search: true,
    scheduler: { enabled: true, cronSecret: process.env.CRON_SECRET! },
  },
});
```

## 멀티 테넌트 스케치

```ts
export const system = createBlogSystem({
  mode: 'multi',
  prisma,
  auth: { jwtSecret: process.env.JWT_SECRET! },
  blog: { modelName: 'post' },
  domain: { baseDomain: 'blog.example.com' },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    plans: [/* PlanDefinition[] */],
  },
});
```

## 문서 가이드

| 문서 | 내용 |
|---|---|
| [01-getting-started.md](./01-getting-started.md) | 설치, single/multi 모드 선택 |
| [02-single-tenant.md](./02-single-tenant.md) | 단일 모드 완전 설정 |
| [03-multi-tenant.md](./03-multi-tenant.md) | 멀티 모드, 테넌트 해석, 격리 |
| [04-authentication.md](./04-authentication.md) | JWT/OAuth/비밀번호 |
| [05-tenant-management.md](./05-tenant-management.md) | Tenant/TenantUser, RBAC |
| [06-billing-stripe.md](./06-billing-stripe.md) | Stripe 구독/웹훅/사용량 |
| [07-custom-domains.md](./07-custom-domains.md) | DNS TXT 인증, Vercel API |
| [08-onboarding.md](./08-onboarding.md) | 테넌트 온보딩 플로우 |
| [09-super-admin.md](./09-super-admin.md) | 슈퍼 어드민 콘솔 |
| [10-deployment.md](./10-deployment.md) | 환경변수, Cron, 보안 체크리스트 |

## 기능 체크리스트

- [x] Single / Multi 모드 (`createBlogSystem`)
- [x] 테넌트 프록시 (`createTenantProxy`) — 행 수준 격리
- [x] JWT 액세스/리프레시 + OAuth(Google, GitHub)
- [x] Tenant / TenantUser 서비스 + 역할 계층 (OWNER > ADMIN > EDITOR > VIEWER)
- [x] Stripe 구독/체크아웃/포털/웹훅/사용량 추적
- [x] 커스텀 도메인 DNS TXT 인증 + Vercel 도메인 API (선택)
- [x] 온보딩 서비스 (테넌트 + 소유자 + 기본 카테고리 + 샘플 글)
- [x] 슈퍼 어드민 UI (Tenant/User/System 대시보드)
- [x] blog-core의 모든 기능(태그/댓글/검색/스케줄러) 경로 노출

## 관련 패키지

- [`@withwiz/blog-core`](../../blog-core/docs/README.md)
