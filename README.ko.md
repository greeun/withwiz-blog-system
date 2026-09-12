# @withwiz/blog-system

> 블로그/뉴스 **SaaS 프레임워크** — 단일 테넌트 또는 멀티 테넌트 구성을 지원.

`@withwiz/blog-system`은 `@withwiz/blog-core` 위에 **인증 + 테넌트 + 과금(Stripe) + 커스텀 도메인 + 온보딩 + 슈퍼 어드민**을 더한 완전한 SaaS 프레임워크다.
`createBlogSystem({ mode, ... })` 한 줄로 모든 서비스와 API 라우트가 조립된다.

## 목차

- [의존성](#의존성)
- [blog-system vs blog-core 선택 기준](#blog-system-vs-blog-core-선택-기준)
- [설치](#설치)
- [빠른 시작 — Single 모드](#빠른-시작--single-모드)
- [빠른 시작 — Multi 모드](#빠른-시작--multi-모드)
- [Next.js App Router 연결](#nextjs-app-router-연결)
- [기능 토글](#기능-토글)
- [BlogSystem 반환 타입](#blogsystem-반환-타입)
- [인증](#인증)
- [테넌트 관리 (Multi 모드)](#테넌트-관리-multi-모드)
- [행 수준 격리 — 테넌트 프록시](#행-수준-격리--테넌트-프록시)
- [커스텀 도메인](#커스텀-도메인)
- [과금 (Stripe)](#과금-stripe)
- [온보딩](#온보딩)
- [슈퍼 어드민](#슈퍼-어드민)
- [환경 변수](#환경-변수)
- [데이터베이스 셋업](#데이터베이스-셋업)
- [배포](#배포)
- [보안 체크리스트](#보안-체크리스트)
- [문서 가이드](#문서-가이드)
- [기능 체크리스트](#기능-체크리스트)
- [관련 패키지](#관련-패키지)

## 의존성

| 패키지 | 역할 |
|---|---|
| `@withwiz/blog-core` | 블로그 CRUD, 태그, 댓글, 검색, 스케줄러, SEO (하위 의존) |
| `@withwiz/toolkit` | JWT, OAuth, PasswordHasher, Prisma 리포지토리 (peer) |
| `@prisma/client` | DB 액세스 (peer) |
| `stripe` | 과금 (dep) |
| `next` | Next.js 프레임워크 (peer, >=15) |
| `react` | React (peer, >=18) |
| `zod` | 스키마 검증 (peer, >=3) |

## blog-system vs blog-core 선택 기준

| 상황 | 권장 |
|---|---|
| 단일 사이트 (1개 블로그/뉴스) + 간단한 인증 | **blog-system `mode: 'single'`** — 인증/라우트까지 조립됨 |
| 단일 사이트 + 완전히 커스텀한 인증 | blog-core 단독 |
| **멀티 테넌트 SaaS** (서브도메인/커스텀 도메인, Stripe 과금) | **blog-system `mode: 'multi'`** (필수) |
| 기능의 일부만 쓰고 싶음 | blog-core 단독 또는 필요한 서브패스만 선택적으로 import |

## 설치

호스트 프로젝트의 `package.json`에 추가:

```json
{
  "dependencies": {
    "@withwiz/blog-core": "file:./packages/blog-core",
    "@withwiz/blog-system": "file:./packages/blog-system"
  }
}
```

peer 패키지 설치:

```bash
npm install @prisma/client next react stripe zod
```

## 빠른 시작 — Single 모드

`mode: 'single'`은 단일 사이트용이다. Tenant/Billing/Domain 서비스는 활성화되지 않는다.

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

// 편의 export
export const { blogService, authService, tagService, commentService, searchService } = system;
```

## 빠른 시작 — Multi 모드

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

`domain.baseDomain`은 서브도메인 해석의 기준이다:
`my-blog.blog.example.com` → 테넌트 `slug='my-blog'`로 매핑된다.

## Next.js App Router 연결

### 인증 라우트

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

### 블로그 라우트

```ts
// app/api/blog/route.ts
export const GET = system.routes.blog.list;

// app/api/blog/[slug]/route.ts
export const GET = system.routes.blog.detail;

// app/api/admin/blog/route.ts
export const GET = system.routes.blog.adminList;
export const POST = system.routes.blog.adminCreate;
```

### 태그, 댓글, 검색, 스케줄러

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

### 멀티 테넌트 라우트 (multi 모드 전용)

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

### 인증 미들웨어 (Next.js)

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

## 기능 토글

Single/Multi 모드 공통:

```ts
features: {
  tags: true,                        // 기본값: true
  comments: {
    enabled: true,
    autoApprove: false,
    requireLogin: false,
    maxDepth: 2,
    rateLimit: { maxPerHour: 5 },
  },
  search: true,                      // 기본값: true (Postgres FTS 필요)
  scheduler: {
    enabled: true,
    cronSecret: process.env.CRON_SECRET!,
  },
}
```

## BlogSystem 반환 타입

```ts
interface BlogSystem {
  blogService: BlogService | null;           // single 모드에서만 인스턴스화
  authService: AuthService | null;
  tenantService: TenantService | null;       // multi 모드 전용
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
  createScopedBlogService: ((tenantId: string) => BlogService) | null;  // multi 모드
}
```

> **주의**: multi 모드에서는 `blogService`가 `null`이다.
> 테넌트별 스코프 서비스는 `createScopedBlogService(tenantId)`로 얻는다.

## 인증

### 개요

- JWT 액세스/리프레시 토큰 + httpOnly 보안 쿠키
- OAuth 지원: Google, GitHub
- 비밀번호 해싱 + 상수 시간 비교 (타이밍 공격 방어)
- Refresh Token Rotation (재발급 시 이전 토큰 즉시 무효화)

### 토큰 설정

| 토큰 | 기본 만료 | 저장 위치 |
|---|---|---|
| Access Token | 15분 | `httpOnly; Secure; SameSite=Strict` 쿠키 |
| Refresh Token | 7일 | `httpOnly; Secure; SameSite=Strict` 쿠키 |

> **중요**: `localStorage`에 토큰을 저장하지 마라. 반드시 httpOnly 쿠키를 사용한다.

### OAuth 설정

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

### 인증 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/auth/register` | POST | 신규 사용자 등록 (email, password, name) |
| `/api/auth/login` | POST | 로그인 (email, password) → access + refresh 토큰 발급 |
| `/api/auth/refresh` | POST | 액세스 토큰 갱신 |
| `/api/auth/oauth/[provider]/callback` | GET | OAuth 콜백 (Google/GitHub) |

## 테넌트 관리 (Multi 모드)

### 핵심 개념

| 개념 | 설명 |
|---|---|
| **Tenant** | 고객/구독 단위. 슬러그와 선택적 커스텀 도메인을 가진다 |
| **TenantUser** | 사용자 ↔ 테넌트 매핑 + 역할 |
| **역할 계층** | `OWNER > ADMIN > EDITOR > VIEWER` |
| **Super Admin** | `SystemRole.SUPER_ADMIN` — 시스템 전체 관리 권한 |

### RBAC (역할 기반 접근 제어)

| 역할 | 권한 |
|---|---|
| `OWNER` | 전체 제어: 테넌트 삭제, 과금 관리, 모든 하위 권한 |
| `ADMIN` | 사용자 관리, 설정 변경, 모든 하위 권한 |
| `EDITOR` | 게시물 생성/수정/삭제, 태그 관리 |
| `VIEWER` | 읽기 전용 |

### 역할 미들웨어로 라우트 보호

```ts
import { createTenantRoleMiddleware } from '@withwiz/blog-system';
import { TenantRole } from '@withwiz/blog-system';

const requireEditor = createTenantRoleMiddleware(TenantRole.EDITOR);

export async function POST(req: Request) {
  const authResult = await requireEditor(req);
  if (authResult instanceof Response) return authResult; // 403
  // 인증된 로직 수행
}
```

### 테넌트 해석 (Tenant Resolution)

요청의 호스트명으로 테넌트를 식별한다:

| 요청 호스트 | 매칭 |
|---|---|
| `my-blog.blog.example.com` | 서브도메인 → `tenant.slug = 'my-blog'` |
| `www.customsite.com` | 커스텀 도메인 조회 |
| `blog.example.com` | 매칭 실패 (랜딩/마케팅 페이지 취급) |

### 테넌트 해석 미들웨어

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

### 서버 컴포넌트에서 테넌트 ID 접근

```ts
import { headers } from 'next/headers';
import { TENANT_ID_HEADER } from '@withwiz/blog-system';

export async function getCurrentTenantId() {
  return headers().get(TENANT_ID_HEADER);
}
```

## 행 수준 격리 — 테넌트 프록시

`createTenantProxy`는 Prisma 클라이언트를 Proxy로 감싸서 **모든 쿼리에 `tenantId` 조건을 자동 주입**한다.

| 메서드 | 주입 위치 |
|---|---|
| `findMany`, `findFirst`, `findUnique`, `count`, `groupBy` | `where.tenantId = X` |
| `create` | `data.tenantId = X` |
| `update`, `updateMany`, `delete`, `deleteMany` | `where.tenantId = X` |
| `$transaction` | 트랜잭션 내부 `tx` 객체도 동일하게 프록시 |

### 직접 사용

```ts
import { createTenantProxy } from '@withwiz/blog-system';

const scopedPrisma = createTenantProxy(prisma, 'tenant-id-123');
const posts = await scopedPrisma.post.findMany();
// 실제 실행: SELECT * FROM post WHERE tenantId = 'tenant-id-123'
```

### createScopedBlogService를 통한 사용

```ts
export async function GET(req: Request) {
  const tenant = await system.middleware.resolveTenantFromRequest!(req);
  if (!tenant) return new Response('Not found', { status: 404 });

  const blog = system.createScopedBlogService!(tenant.tenantId);
  const result = await blog.listPublished({ page: 1, limit: 12 });
  return Response.json(result);
}
```

> **경고**: 테넌트 해석은 **모든 API 호출**에서 수행해야 한다.
> 누락하면 테넌트 간 데이터 유출 위험이 있다.

## 커스텀 도메인

### DNS TXT 인증

커스텀 도메인은 DNS TXT 레코드를 통해 인증된다:

1. 테넌트가 커스텀 도메인을 추가
2. 시스템이 인증 토큰을 생성
3. 테넌트가 DNS TXT 레코드 생성: `_withwiz-verify.{domain}` → 토큰 값
4. 시스템이 TXT 레코드를 검증
5. 도메인 활성화

### Vercel 통합 (선택)

Vercel에 배포하는 경우, SSL이 자동으로 프로비저닝된다:

```ts
domain: {
  baseDomain: 'blog.example.com',
  vercelTeamId: process.env.VERCEL_TEAM_ID,
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
  vercelApiToken: process.env.VERCEL_API_TOKEN,
},
```

자체 호스팅 환경에서는 nginx 또는 Traefik의 Host 헤더 라우팅을 설정한다.

## 과금 (Stripe)

### 플랜 정의

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

### 체크아웃 플로우

1. `billingService.createCheckoutSession(tenantId, planId)` → Stripe 체크아웃 URL
2. 사용자가 Stripe에서 결제 완료
3. Stripe가 `checkout.session.completed` 웹훅 전송
4. 시스템이 구독 상태 업데이트

### 사용량 추적

```ts
const check = await billingService.checkUsage(tenantId, 'posts');
if (!check.allowed) {
  return new Response('플랜 한도 초과', { status: 402 });
}
```

### Stripe 웹훅 설정

1. Stripe Dashboard → Webhooks → **Add endpoint**
2. URL: `https://your-domain.com/api/webhooks/stripe`
3. 이벤트 선택: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. 발급된 Signing secret을 `STRIPE_WEBHOOK_SECRET`에 설정

### 로컬 테스트

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 온보딩

`OnboardingService`는 새 테넌트 셋업을 원자적으로 수행한다:

1. **테넌트** — 이름, 슬러그, 설정
2. **소유자** — `OWNER` 역할의 첫 사용자
3. **기본 카테고리** — general, notice, tech
4. **샘플 게시물** (선택)
5. **플랜 할당** (선택)

### 슬러그 규칙

- 3~63자
- 소문자, 숫자, 하이픈만 허용
- 예약어 차단: `www`, `api`, `admin`, `app`, `mail`, `blog`, `static`

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

## 슈퍼 어드민

`SystemRole.SUPER_ADMIN` 사용자는 시스템 전체 관리 권한을 가진다.

### 기능

- 모든 테넌트 조회 및 관리
- 테넌트 활성화/비활성화
- 전체 테넌트의 사용자 역할 관리
- 시스템 메트릭 모니터링 (총 테넌트, 사용자, 게시물, 스토리지)

### 미들웨어

```ts
// 슈퍼 어드민 라우트는 자동으로 보호된다
export const GET = system.routes.admin?.dashboard;
export const POST = system.routes.admin?.deactivateTenant;
```

### 초기 설정

최초 슈퍼 어드민은 DB 마이그레이션/시드로 생성한다:

```sql
UPDATE users SET system_role = 'SUPER_ADMIN' WHERE email = 'ops@example.com';
```

> **경고**: `SUPER_ADMIN`은 무제한 접근 권한을 가진다. 모든 작업을 감사 로그에 기록해야 한다.

## 환경 변수

### 필수 (공통)

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
JWT_SECRET=<openssl rand -base64 48>    # 최소 32자
NEXT_PUBLIC_SITE_URL=https://example.com
```

### OAuth (선택)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://example.com/api/auth/oauth/google/callback

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://example.com/api/auth/oauth/github/callback
```

### 예약 발행 (선택)

```bash
CRON_SECRET=<openssl rand -hex 32>
```

### Stripe — 멀티 테넌트 과금 (선택)

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 커스텀 도메인 — Vercel (선택)

```bash
VERCEL_TEAM_ID=team_xxx
VERCEL_PROJECT_ID=prj_xxx
VERCEL_API_TOKEN=xxx
```

### R2 스토리지 (선택)

```bash
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://cdn.example.com
```

## 데이터베이스 셋업

```bash
# 1. 스키마 마이그레이션 적용
npx prisma migrate deploy

# 2. (선택) 전문 검색(FTS) 마이그레이션
psql "$DATABASE_URL" -f packages/blog-core/prisma/migrations/fulltext-search.sql

# 3. (Multi 모드) 초기 슈퍼 어드민 생성
psql "$DATABASE_URL" -c "UPDATE users SET system_role='SUPER_ADMIN' WHERE email='ops@example.com';"
```

### Prisma 스키마 (Multi 모드)

호스트의 Prisma 스키마에 테넌트 관련 모델이 포함돼야 한다:

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
  // ... blog-core 표준 필드
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, published, publishedAt(sort: Desc)])
  @@map("posts")
}
```

## 배포

### 빌드 & 실행

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버
npm start

# Docker
docker build -t my-blog .
docker run -p 3000:3000 --env-file .env.production my-blog
```

### 헬스 체크

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

### Cron 설정

| 호스팅 | 추천 Cron |
|---|---|
| Vercel | Vercel Cron (`vercel.json`) |
| AWS ECS/Fargate | EventBridge → Lambda → HTTP |
| GCP Cloud Run | Cloud Scheduler → HTTP |
| 자체 서버 | crontab + curl |
| GitHub Actions | Scheduled workflow |

### 모니터링

- **APM**: Sentry, New Relic, Datadog
- **로그 집계**: Loki + Grafana, CloudWatch, BetterStack
- **업타임**: UptimeRobot, Pingdom
- **알림**: Sentry → Slack/Discord

## 보안 체크리스트

- [ ] `JWT_SECRET` 최소 32자 랜덤 (`openssl rand -base64 48`)
- [ ] `CRON_SECRET` 최소 32자 랜덤
- [ ] `.env*` 파일 `.gitignore`에 포함
- [ ] 프로덕션 시크릿은 보안 저장소에만 (GitHub Secrets / AWS SSM / Vercel Env)
- [ ] 모든 인증 쿠키: `HttpOnly; Secure; SameSite=Strict`
- [ ] Access Token 만료 ≤ 15분
- [ ] Refresh Token Rotation 구현
- [ ] `localStorage`에 토큰 저장 금지
- [ ] CSP, HSTS, X-Content-Type-Options 헤더 설정
- [ ] 모든 입력 Zod 스키마로 검증
- [ ] HTML 콘텐츠 `sanitizeContent`로 새니타이즈
- [ ] 관리자 라우트 `requireAdmin` 미들웨어로 보호
- [ ] Multi 모드: **모든** API 호출에서 테넌트 해석 수행
- [ ] 테넌트 데이터는 `tenantProxy`를 통해서만 접근
- [ ] Stripe 웹훅 `stripe-signature` 검증
- [ ] Cron 라우트 `Authorization: Bearer` 검증
- [ ] 슈퍼 어드민 작업 감사 로그 기록
- [ ] 로그인 엔드포인트 레이트 리밋
- [ ] 프로덕션 응답에 스택 트레이스 노출 금지

## 문서 가이드

| 문서 | 내용 |
|---|---|
| [01-getting-started.md](./docs/01-getting-started.md) | 설치, single/multi 모드 선택 |
| [02-single-tenant.md](./docs/02-single-tenant.md) | 단일 모드 완전 설정 |
| [03-multi-tenant.md](./docs/03-multi-tenant.md) | 멀티 모드, 테넌트 해석, 격리 |
| [04-authentication.md](./docs/04-authentication.md) | JWT/OAuth/비밀번호 |
| [05-tenant-management.md](./docs/05-tenant-management.md) | Tenant/TenantUser, RBAC |
| [06-billing-stripe.md](./docs/06-billing-stripe.md) | Stripe 구독/웹훅/사용량 |
| [07-custom-domains.md](./docs/07-custom-domains.md) | DNS TXT 인증, Vercel API |
| [08-onboarding.md](./docs/08-onboarding.md) | 테넌트 온보딩 플로우 |
| [09-super-admin.md](./docs/09-super-admin.md) | 슈퍼 어드민 콘솔 |
| [10-deployment.md](./docs/10-deployment.md) | 환경변수, Cron, 보안 체크리스트 |

## 기능 체크리스트

- [x] Single / Multi 모드 (`createBlogSystem`)
- [x] 테넌트 프록시 (`createTenantProxy`) — 행 수준 격리
- [x] JWT 액세스/리프레시 + OAuth (Google, GitHub)
- [x] Tenant / TenantUser 서비스 + 역할 계층 (OWNER > ADMIN > EDITOR > VIEWER)
- [x] Stripe 구독/체크아웃/포털/웹훅/사용량 추적
- [x] 커스텀 도메인 DNS TXT 인증 + Vercel Domain API (선택)
- [x] 온보딩 서비스 (테넌트 + 소유자 + 기본 카테고리 + 샘플 글)
- [x] 슈퍼 어드민 UI (Tenant/User/System 대시보드)
- [x] blog-core의 모든 기능 (태그/댓글/검색/스케줄러) 경로 노출

## 호스트 프로젝트 구조

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── refresh/route.ts
│   │   │   └── oauth/[provider]/callback/route.ts
│   │   ├── blog/
│   │   │   ├── route.ts             # 공개 목록
│   │   │   ├── [slug]/route.ts      # 공개 상세
│   │   │   ├── search/route.ts
│   │   │   ├── tags/route.ts
│   │   │   └── comments/route.ts
│   │   ├── admin/blog/route.ts      # 관리자 CRUD
│   │   └── cron/blog-publish/route.ts
│   ├── blog/
│   │   ├── page.tsx                 # 공개 목록 UI
│   │   └── [slug]/page.tsx          # 공개 상세 UI
│   └── admin/blog/
│       ├── page.tsx                 # BlogManagerClient
│       └── [id]/page.tsx            # BlogEditForm
├── lib/
│   ├── prisma.ts
│   ├── blog-system.ts
│   └── blog-config.ts
└── middleware.ts
```

## 관련 패키지

- [`@withwiz/blog-core`](../blog-core/README.md) — 코어 블로그 엔진
- [`@withwiz/toolkit`](../toolkit/README.md) — 공유 유틸리티

## 라이선스

MIT
