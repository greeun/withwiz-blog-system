# @withwiz/blog-system

> A complete Blog/News **SaaS framework** supporting single-tenant and multi-tenant configurations.

`@withwiz/blog-system` extends `@withwiz/blog-core` with **authentication + tenants + billing (Stripe) + custom domains + onboarding + super admin**, forming a production-ready SaaS platform.
A single call to `createBlogSystem({ mode, ... })` assembles all services and API routes.

## Table of Contents

- [Dependencies](#dependencies)
- [When to Use blog-system vs blog-core](#when-to-use-blog-system-vs-blog-core)
- [Installation](#installation)
- [Quick Start — Single Mode](#quick-start--single-mode)
- [Quick Start — Multi-Tenant Mode](#quick-start--multi-tenant-mode)
- [Next.js App Router Integration](#nextjs-app-router-integration)
- [Feature Toggles](#feature-toggles)
- [BlogSystem Return Type](#blogsystem-return-type)
- [Authentication](#authentication)
- [Tenant Management (Multi Mode)](#tenant-management-multi-mode)
- [Row-Level Isolation — Tenant Proxy](#row-level-isolation--tenant-proxy)
- [Custom Domains](#custom-domains)
- [Billing (Stripe)](#billing-stripe)
- [Onboarding](#onboarding)
- [Super Admin](#super-admin)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Deployment](#deployment)
- [Security Checklist](#security-checklist)
- [Documentation Guide](#documentation-guide)
- [Feature Checklist](#feature-checklist)
- [Related Packages](#related-packages)

## Dependencies

| Package | Role |
|---|---|
| `@withwiz/blog-core` | Blog CRUD, tags, comments, search, scheduler, SEO (dependency) |
| `@withwiz/toolkit` | JWT, OAuth, PasswordHasher, Prisma repositories (peer) |
| `@prisma/client` | Database access (peer) |
| `stripe` | Billing (dependency) |
| `next` | Next.js framework (peer, >=15) |
| `react` | React (peer, >=18) |
| `zod` | Schema validation (peer, >=3) |

## When to Use blog-system vs blog-core

| Scenario | Recommendation |
|---|---|
| Single site (1 blog/news) + simple auth | **blog-system `mode: 'single'`** — auth & routes assembled for you |
| Single site + fully custom auth | blog-core standalone |
| **Multi-tenant SaaS** (subdomains, custom domains, Stripe billing) | **blog-system `mode: 'multi'`** (required) |
| Need only a subset of features | blog-core standalone or selectively import sub-paths |

## Installation

Add to your host project's `package.json`:

```json
{
  "dependencies": {
    "@withwiz/blog-core": "file:./packages/blog-core",
    "@withwiz/blog-system": "file:./packages/blog-system"
  }
}
```

Install peer dependencies:

```bash
npm install @prisma/client next react stripe zod
```

## Quick Start — Single Mode

`mode: 'single'` is for single-site use. Tenant/Billing/Domain services are not activated.

```ts
// src/lib/blog-system.ts
import { createBlogSystem } from '@withwiz/blog-system';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

// Convenience exports
export const { blogService, authService, tagService, commentService, searchService } = system;
```

## Quick Start — Multi-Tenant Mode

```ts
import { createBlogSystem } from '@withwiz/blog-system';

export const system = createBlogSystem({
  mode: 'multi',
  prisma,
  auth: { jwtSecret: process.env.JWT_SECRET! },
  blog: { modelName: 'post' },
  domain: {
    baseDomain: 'blog.example.com',
    vercelTeamId: process.env.VERCEL_TEAM_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
    vercelApiToken: process.env.VERCEL_API_TOKEN,
  },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    plans: [
      {
        id: 'free',
        name: 'Free',
        stripePriceId: null,
        limits: { posts: 10, storage: 100_000_000 },
      },
      {
        id: 'pro',
        name: 'Pro',
        stripePriceId: 'price_xxx',
        limits: { posts: -1, storage: 5_000_000_000, custom_domains: 3 },
      },
    ],
  },
});
```

`domain.baseDomain` is the reference for subdomain resolution:
`my-blog.blog.example.com` maps to tenant `slug='my-blog'`.

## Next.js App Router Integration

### Auth Routes

```ts
// app/api/auth/register/route.ts
export const POST = system.routes.auth.register;

// app/api/auth/login/route.ts
export const POST = system.routes.auth.login;

// app/api/auth/refresh/route.ts
export const POST = system.routes.auth.refresh;

// app/api/auth/oauth/[provider]/callback/route.ts
export const GET = system.routes.auth.oauthCallback;
```

### Blog Routes

```ts
// app/api/blog/route.ts
export const GET = system.routes.blog.list;

// app/api/blog/[slug]/route.ts
export const GET = system.routes.blog.detail;

// app/api/admin/blog/route.ts
export const GET = system.routes.blog.adminList;
export const POST = system.routes.blog.adminCreate;
```

### Tags, Comments, Search, Scheduler

```ts
// app/api/blog/tags/route.ts
export const GET = system.routes.tag?.list;

// app/api/blog/comments/route.ts
export const POST = system.routes.comment?.create;

// app/api/blog/search/route.ts
export const GET = system.routes.search?.query;

// app/api/cron/blog-publish/route.ts
export const GET = system.routes.scheduler?.publishScheduled.GET;
export const POST = system.routes.scheduler?.publishScheduled.POST;
```

### Multi-Tenant Routes (multi mode only)

```ts
// app/api/tenants/route.ts
export const GET = system.routes.tenant?.list;
export const POST = system.routes.tenant?.create;

// app/api/billing/checkout/route.ts
export const POST = system.routes.billing?.createCheckout;

// app/api/webhooks/stripe/route.ts
export const POST = system.routes.billing?.webhook;

// app/api/admin/system/route.ts
export const GET = system.routes.admin?.dashboard;
```

### Auth Middleware (Next.js)

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { system } from '@/lib/blog-system';

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const token = req.cookies.get('access_token')?.value;
    if (!token) return NextResponse.redirect(new URL('/login', req.url));
    const user = await system.authService!.getCurrentUser(token);
    if (!user) return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
```

## Feature Toggles

Shared between single and multi modes:

```ts
features: {
  tags: true,                        // default: true
  comments: {
    enabled: true,
    autoApprove: false,
    requireLogin: false,
    maxDepth: 2,
    rateLimit: { maxPerHour: 5 },
  },
  search: true,                      // default: true (requires Postgres FTS)
  scheduler: {
    enabled: true,
    cronSecret: process.env.CRON_SECRET!,
  },
}
```

## BlogSystem Return Type

```ts
interface BlogSystem {
  blogService: BlogService | null;           // instantiated in single mode only
  authService: AuthService | null;
  tenantService: TenantService | null;       // multi mode only
  tenantUserService: TenantUserService | null;
  onboardingService: OnboardingService | null;
  billingService: BillingService | null;
  planService: PlanService | null;
  domainService: DomainService | null;
  tagService, commentService, searchService, schedulerService;
  routes: {
    blog, auth, tenant?, admin?, billing?, domain?,
    tag?, comment?, search?, scheduler?,
  };
  middleware: {
    resolveTenantFromRequest, requireTenantRole, ...
  };
  blogConfig: BlogConfig;
  createScopedBlogService: ((tenantId: string) => BlogService) | null;  // multi mode
}
```

> **Note**: In multi mode, `blogService` is `null`.
> Use `createScopedBlogService(tenantId)` to obtain a tenant-scoped service.

## Authentication

### Overview

- JWT access/refresh tokens with httpOnly secure cookies
- OAuth support: Google, GitHub
- Password hashing with constant-time comparison
- Refresh Token Rotation (previous token invalidated on reissue)

### Token Configuration

| Token | Default Expiry | Storage |
|---|---|---|
| Access Token | 15 minutes | `httpOnly; Secure; SameSite=Strict` cookie |
| Refresh Token | 7 days | `httpOnly; Secure; SameSite=Strict` cookie |

> **Important**: Never store tokens in `localStorage`. Always use httpOnly cookies.

### OAuth Setup

```ts
auth: {
  jwtSecret: process.env.JWT_SECRET!,
  oauthProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_REDIRECT_URI!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectUri: process.env.GITHUB_REDIRECT_URI!,
    },
  },
},
```

### Auth API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | Register new user (email, password, name) |
| `/api/auth/login` | POST | Login (email, password) → access + refresh tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/oauth/[provider]/callback` | GET | OAuth callback (Google/GitHub) |

## Tenant Management (Multi Mode)

### Core Concepts

| Concept | Description |
|---|---|
| **Tenant** | Customer/subscription unit with slug and optional custom domain |
| **TenantUser** | User-tenant mapping with role |
| **Role Hierarchy** | `OWNER > ADMIN > EDITOR > VIEWER` |
| **Super Admin** | `SystemRole.SUPER_ADMIN` — system-wide management authority |

### RBAC (Role-Based Access Control)

| Role | Permissions |
|---|---|
| `OWNER` | Full control: delete tenant, manage billing, all lower permissions |
| `ADMIN` | Manage users, settings, all lower permissions |
| `EDITOR` | Create/edit/delete posts, manage tags |
| `VIEWER` | Read-only access |

### Protecting Routes with Role Middleware

```ts
import { createTenantRoleMiddleware } from '@withwiz/blog-system';
import { TenantRole } from '@withwiz/blog-system';

const requireEditor = createTenantRoleMiddleware(TenantRole.EDITOR);

export async function POST(req: Request) {
  const authResult = await requireEditor(req);
  if (authResult instanceof Response) return authResult; // 403
  // proceed with authorized logic
}
```

### Tenant Resolution

Request hostname is used to identify the tenant:

| Request Host | Match |
|---|---|
| `my-blog.blog.example.com` | Subdomain → `tenant.slug = 'my-blog'` |
| `www.customsite.com` | Custom domain lookup |
| `blog.example.com` | No match (landing/marketing page) |

### Tenant Resolution Middleware

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { system, TENANT_ID_HEADER } from '@/lib/blog-system';

export async function middleware(req: NextRequest) {
  const result = await system.middleware.resolveTenantFromRequest!(req);
  if (!result) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url));
  }
  const headers = new Headers(req.headers);
  headers.set(TENANT_ID_HEADER, result.tenantId);
  return NextResponse.next({ request: { headers } });
}
```

### Accessing Tenant ID in Server Components

```ts
import { headers } from 'next/headers';
import { TENANT_ID_HEADER } from '@withwiz/blog-system';

export async function getCurrentTenantId() {
  return headers().get(TENANT_ID_HEADER);
}
```

## Row-Level Isolation — Tenant Proxy

`createTenantProxy` wraps the Prisma client with a Proxy that **automatically injects `tenantId` conditions into all queries**.

| Method | Injection |
|---|---|
| `findMany`, `findFirst`, `findUnique`, `count`, `groupBy` | `where.tenantId = X` |
| `create` | `data.tenantId = X` |
| `update`, `updateMany`, `delete`, `deleteMany` | `where.tenantId = X` |
| `$transaction` | Inner `tx` object is also proxied |

### Direct Usage

```ts
import { createTenantProxy } from '@withwiz/blog-system';

const scopedPrisma = createTenantProxy(prisma, 'tenant-id-123');
const posts = await scopedPrisma.post.findMany();
// Actual query: SELECT * FROM post WHERE tenantId = 'tenant-id-123'
```

### Via createScopedBlogService

```ts
export async function GET(req: Request) {
  const tenant = await system.middleware.resolveTenantFromRequest!(req);
  if (!tenant) return new Response('Not found', { status: 404 });

  const blog = system.createScopedBlogService!(tenant.tenantId);
  const result = await blog.listPublished({ page: 1, limit: 12 });
  return Response.json(result);
}
```

> **Warning**: Tenant resolution must be performed on **every API call**.
> Missing it risks leaking data across tenants.

## Custom Domains

### DNS TXT Verification

Custom domains are verified via DNS TXT records:

1. Tenant adds a custom domain
2. System generates a verification token
3. Tenant creates DNS TXT record: `_withwiz-verify.{domain}` → token value
4. System verifies the TXT record
5. Domain is activated

### Optional Vercel Integration

When deploying on Vercel, SSL is automatically provisioned:

```ts
domain: {
  baseDomain: 'blog.example.com',
  vercelTeamId: process.env.VERCEL_TEAM_ID,
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
  vercelApiToken: process.env.VERCEL_API_TOKEN,
},
```

For self-hosted environments, configure nginx or Traefik with Host header routing.

## Billing (Stripe)

### Plan Definition

```ts
billing: {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  plans: [
    {
      id: 'free',
      name: 'Free',
      stripePriceId: null,
      limits: { posts: 10, storage: 100_000_000 },
    },
    {
      id: 'pro',
      name: 'Pro',
      stripePriceId: 'price_xxx',
      limits: { posts: -1, storage: 5_000_000_000, custom_domains: 3 },
    },
  ],
},
```

### Checkout Flow

1. `billingService.createCheckoutSession(tenantId, planId)` → Stripe Checkout URL
2. User completes payment on Stripe
3. Stripe sends `checkout.session.completed` webhook
4. System updates subscription status

### Usage Tracking

```ts
const check = await billingService.checkUsage(tenantId, 'posts');
if (!check.allowed) {
  return new Response('Plan limit reached', { status: 402 });
}
```

### Stripe Webhook Setup

1. Stripe Dashboard → Webhooks → **Add endpoint**
2. URL: `https://your-domain.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Set the signing secret as `STRIPE_WEBHOOK_SECRET`

### Local Testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Onboarding

The `OnboardingService` atomically creates a new tenant setup:

1. **Tenant** — name, slug, settings
2. **Owner** — first user with `OWNER` role
3. **Default categories** — general, notice, tech
4. **Sample post** (optional)
5. **Plan assignment** (optional)

### Slug Rules

- 3–63 characters
- Lowercase letters, digits, hyphens only
- Reserved words blocked: `www`, `api`, `admin`, `app`, `mail`, `blog`, `static`

```ts
const result = await system.onboardingService!.onboard({
  tenantName: 'My Blog',
  tenantSlug: 'my-blog',
  ownerEmail: 'owner@example.com',
  ownerPassword: 'securePassword123',
  ownerName: 'Blog Owner',
  planId: 'free',
});
// result.tenant, result.owner, result.tenantUser
```

## Super Admin

Users with `SystemRole.SUPER_ADMIN` have system-wide administrative access.

### Capabilities

- View and manage all tenants
- Activate/deactivate tenants
- Manage user roles across tenants
- Monitor system metrics (total tenants, users, posts, storage)

### Middleware

```ts
// Super admin routes are protected automatically
export const GET = system.routes.admin?.dashboard;
export const POST = system.routes.admin?.deactivateTenant;
```

### Initial Setup

The first super admin is created via database migration/seed:

```sql
UPDATE users SET system_role = 'SUPER_ADMIN' WHERE email = 'ops@example.com';
```

> **Warning**: `SUPER_ADMIN` has unrestricted access. All actions must be audit-logged.

## Environment Variables

### Required (All Modes)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
JWT_SECRET=<openssl rand -base64 48>    # minimum 32 characters
NEXT_PUBLIC_SITE_URL=https://example.com
```

### OAuth (Optional)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://example.com/api/auth/oauth/google/callback

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://example.com/api/auth/oauth/github/callback
```

### Scheduled Publishing (Optional)

```bash
CRON_SECRET=<openssl rand -hex 32>
```

### Stripe — Multi-Tenant Billing (Optional)

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Custom Domains — Vercel (Optional)

```bash
VERCEL_TEAM_ID=team_xxx
VERCEL_PROJECT_ID=prj_xxx
VERCEL_API_TOKEN=xxx
```

### R2 Storage (Optional)

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://cdn.example.com
```

## Database Setup

```bash
# 1. Apply schema migrations
npx prisma migrate deploy

# 2. (Optional) Full-text search migration
psql "$DATABASE_URL" -f packages/blog-core/prisma/migrations/fulltext-search.sql

# 3. (Multi mode) Create initial super admin
psql "$DATABASE_URL" -c "UPDATE users SET system_role='SUPER_ADMIN' WHERE email='ops@example.com';"
```

### Prisma Schema (Multi Mode)

Your host Prisma schema must include tenant models:

```prisma
model Tenant {
  id           String   @id @default(cuid())
  slug         String   @unique
  name         String
  customDomain String?  @unique @map("custom_domain")
  isActive     Boolean  @default(true) @map("is_active")
  settings     Json     @default("{}")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  users  TenantUser[]
  posts  Post[]
  @@map("tenants")
}

model TenantUser {
  tenantId  String
  userId    String
  role      TenantRole
  createdAt DateTime @default(now())

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([tenantId, userId])
  @@map("tenant_users")
}

enum TenantRole {
  OWNER
  ADMIN
  EDITOR
  VIEWER
}

model Post {
  id       String @id @default(cuid())
  tenantId String
  // ... blog-core standard fields
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, published, publishedAt(sort: Desc)])
  @@map("posts")
}
```

## Deployment

### Build & Run

```bash
# Production build
npm run build

# Production server
npm start

# Docker
docker build -t my-blog .
docker run -p 3000:3000 --env-file .env.production my-blog
```

### Health Check

```ts
// app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', time: new Date().toISOString() });
  } catch {
    return Response.json({ status: 'error' }, { status: 503 });
  }
}
```

### Cron Setup

| Hosting | Recommended Cron |
|---|---|
| Vercel | Vercel Cron (`vercel.json`) |
| AWS ECS/Fargate | EventBridge → Lambda → HTTP |
| GCP Cloud Run | Cloud Scheduler → HTTP |
| Self-hosted | crontab + curl |
| GitHub Actions | Scheduled workflow |

### Monitoring

- **APM**: Sentry, New Relic, Datadog
- **Logs**: Loki + Grafana, CloudWatch, BetterStack
- **Uptime**: UptimeRobot, Pingdom
- **Alerts**: Sentry → Slack/Discord

## Security Checklist

- [ ] `JWT_SECRET` minimum 32 chars random (`openssl rand -base64 48`)
- [ ] `CRON_SECRET` minimum 32 chars random
- [ ] `.env*` files in `.gitignore`
- [ ] Production secrets in secure storage (GitHub Secrets / AWS SSM / Vercel Env)
- [ ] All auth cookies: `HttpOnly; Secure; SameSite=Strict`
- [ ] Access Token expiry ≤ 15 minutes
- [ ] Refresh Token Rotation implemented
- [ ] No tokens in `localStorage`
- [ ] CSP, HSTS, X-Content-Type-Options headers set
- [ ] All input validated with Zod schemas
- [ ] HTML content sanitized via `sanitizeContent`
- [ ] Admin routes protected with `requireAdmin` middleware
- [ ] Multi mode: tenant resolution on **every** API call
- [ ] Tenant data accessed only through `tenantProxy`
- [ ] Stripe webhook `stripe-signature` verification
- [ ] Cron routes require `Authorization: Bearer` verification
- [ ] Super admin actions audit-logged
- [ ] Login endpoint rate-limited
- [ ] No stack traces in production responses

## Documentation Guide

| Document | Content |
|---|---|
| [01-getting-started.md](./docs/01-getting-started.md) | Installation, single/multi mode selection |
| [02-single-tenant.md](./docs/02-single-tenant.md) | Single mode full configuration |
| [03-multi-tenant.md](./docs/03-multi-tenant.md) | Multi mode, tenant resolution, isolation |
| [04-authentication.md](./docs/04-authentication.md) | JWT/OAuth/password |
| [05-tenant-management.md](./docs/05-tenant-management.md) | Tenant/TenantUser, RBAC |
| [06-billing-stripe.md](./docs/06-billing-stripe.md) | Stripe subscriptions/webhooks/usage |
| [07-custom-domains.md](./docs/07-custom-domains.md) | DNS TXT verification, Vercel API |
| [08-onboarding.md](./docs/08-onboarding.md) | Tenant onboarding flow |
| [09-super-admin.md](./docs/09-super-admin.md) | Super admin console |
| [10-deployment.md](./docs/10-deployment.md) | Environment variables, cron, security checklist |

## Feature Checklist

- [x] Single / Multi mode (`createBlogSystem`)
- [x] Tenant Proxy (`createTenantProxy`) — row-level isolation
- [x] JWT access/refresh + OAuth (Google, GitHub)
- [x] Tenant / TenantUser services + role hierarchy (OWNER > ADMIN > EDITOR > VIEWER)
- [x] Stripe subscriptions/checkout/portal/webhooks/usage tracking
- [x] Custom domain DNS TXT verification + Vercel Domain API (optional)
- [x] Onboarding service (tenant + owner + default categories + sample post)
- [x] Super Admin UI (Tenant/User/System dashboard)
- [x] All blog-core features (tags/comments/search/scheduler) exposed as routes

## Host Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   └── oauth/[provider]/callback/route.ts
│   │   ├── blog/
│   │   │   ├── route.ts             # Public list
│   │   │   ├── [slug]/route.ts      # Public detail
│   │   │   ├── search/route.ts
│   │   │   ├── tags/route.ts
│   │   │   └── comments/route.ts
│   │   ├── admin/blog/route.ts      # Admin CRUD
│   │   └── cron/blog-publish/route.ts
│   ├── blog/
│   │   ├── page.tsx                 # Public list UI
│   │   └── [slug]/page.tsx          # Public detail UI
│   └── admin/blog/
│       ├── page.tsx                 # BlogManagerClient
│       └── [id]/page.tsx            # BlogEditForm
├── lib/
│   ├── prisma.ts
│   ├── blog-system.ts
│   └── blog-config.ts
└── middleware.ts
```

## Related Packages

- [`@withwiz/blog-core`](../blog-core/README.md) — Core blog engine
- [`@withwiz/toolkit`](../toolkit/README.md) — Shared utilities

## License

MIT
