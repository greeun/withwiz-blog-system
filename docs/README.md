# @withwiz/blog-system

> Blog/news **SaaS system** — supports single-tenant or multi-tenant configurations.

`@withwiz/blog-system` is a complete SaaS framework that adds **authentication + tenancy + billing (Stripe) + custom domains + onboarding + super admin** on top of `@withwiz/blog-core`.
A single line of `createBlogSystem({ mode, ... })` assembles all services and API routes.

## Dependencies

| Package | Role |
|---|---|
| `@withwiz/blog-core` | Blog CRUD/tags/comments/search/scheduler/SEO (downstream dependency) |
| `@withwiz/toolkit` | JWT, OAuth, PasswordHasher, Prisma repositories (peer) |
| `@prisma/client` | DB access (peer) |
| `stripe` | Billing (dep) |

## When to use blog-system vs. blog-core alone

| Situation | Recommendation |
|---|---|
| Single site (one blog/news) + simple auth | **blog-system `mode: 'single'`** — assembles auth/routes too |
| Single site + fully custom auth | blog-core alone |
| **Multi-tenant SaaS** (subdomains/custom domains, Stripe billing) | **blog-system `mode: 'multi'`** (required) |
| Want to use only some features | blog-core alone, or selectively import only the subpaths you need |

## Quick Start (single)

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

## Multi-tenant Sketch

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

## Documentation Guide

| Document | Contents |
|---|---|
| [01-getting-started.md](./01-getting-started.md) | Installation, choosing single/multi mode |
| [02-single-tenant.md](./02-single-tenant.md) | Full single-mode configuration |
| [03-multi-tenant.md](./03-multi-tenant.md) | Multi mode, tenant resolution, isolation |
| [04-authentication.md](./04-authentication.md) | JWT/OAuth/password |
| [05-tenant-management.md](./05-tenant-management.md) | Tenant/TenantUser, RBAC |
| [06-billing-stripe.md](./06-billing-stripe.md) | Stripe subscriptions/webhooks/usage |
| [07-custom-domains.md](./07-custom-domains.md) | DNS TXT verification, Vercel API |
| [08-onboarding.md](./08-onboarding.md) | Tenant onboarding flow |
| [09-super-admin.md](./09-super-admin.md) | Super admin console |
| [10-deployment.md](./10-deployment.md) | Environment variables, Cron, security checklist |

## Feature Checklist

- [x] Single / Multi mode (`createBlogSystem`)
- [x] Tenant proxy (`createTenantProxy`) — row-level isolation
- [x] JWT access/refresh + OAuth (Google, GitHub)
- [x] Tenant / TenantUser service + role hierarchy (OWNER > ADMIN > EDITOR > VIEWER)
- [x] Stripe subscriptions/checkout/portal/webhooks/usage tracking
- [x] Custom domain DNS TXT verification + Vercel Domains API (optional)
- [x] Onboarding service (tenant + owner + default category + sample post)
- [x] Super admin UI (Tenant/User/System dashboards)
- [x] Exposes paths to all blog-core features (tags/comments/search/scheduler)

## Related Packages

- [`@withwiz/blog-core`](../../blog-core/docs/README.md)
