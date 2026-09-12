# 03. 멀티 테넌트 (Multi Mode)

여러 테넌트(고객)가 한 Next.js 인스턴스를 공유하는 SaaS 구성.

## 핵심 개념

| 요소 | 설명 |
|---|---|
| **Tenant** | 고객/구독 단위. 슬러그와 선택적 커스텀 도메인을 가진다. |
| **TenantUser** | 사용자 ↔ 테넌트 매핑 + 역할(`OWNER/ADMIN/EDITOR/VIEWER`) |
| **Row-level 격리** | `tenantProxy`가 모든 Prisma 쿼리에 `tenantId`를 자동 주입 |
| **테넌트 해석** | 호스트명(서브도메인 또는 커스텀 도메인)으로 테넌트 식별 |
| **Super Admin** | `SystemRole.SUPER_ADMIN` — 전체 테넌트 관리 권한 |

## 설정

```ts
import { createBlogSystem } from '@withwiz/blog-system';

export const system = createBlogSystem({
  mode: 'multi',
  prisma,
  auth: { jwtSecret: process.env.JWT_SECRET! },
  blog: { modelName: 'post' },
  domain: {
    baseDomain: 'blog.example.com',          // 서브도메인 기준
    vercelTeamId: process.env.VERCEL_TEAM_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
    vercelApiToken: process.env.VERCEL_API_TOKEN,
  },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    plans: [/* ... */],
  },
});
```

## 테넌트 해석 (Tenant Resolution)

`TenantResolver`는 호스트명에서 테넌트를 찾는다.

### 우선순위

1. **커스텀 도메인 매칭** — `tenant.customDomain === hostname`
2. **서브도메인 매칭** — `hostname === '{slug}.{baseDomain}'`
3. null (404 처리)

### 예

| 요청 호스트 | 매칭 |
|---|---|
| `my-blog.blog.example.com` | 서브도메인 → `tenant.slug = 'my-blog'` |
| `www.customsite.com` | 커스텀 도메인 조회 |
| `blog.example.com` | 매칭 실패 (랜딩/마케팅 페이지 취급) |

### 미들웨어에서 사용

```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { system, TENANT_ID_HEADER } from '@/lib/blog-system';

export async function middleware(req: NextRequest) {
  const result = await system.middleware.resolveTenantFromRequest!(req);
  if (!result) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url));
  }

  // 후속 핸들러에 테넌트 정보 주입 (헤더로 전달)
  const headers = new Headers(req.headers);
  headers.set(TENANT_ID_HEADER, result.tenantId);
  return NextResponse.next({ request: { headers } });
}
```

## Row-Level 격리 — `createTenantProxy`

`tenantProxy`는 Prisma 클라이언트를 Proxy로 감싸서 **모든 쿼리에 `tenantId` where 조건을 자동 추가**한다.

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

### 자동화 — `createScopedBlogService`

`createBlogSystem` 반환의 `createScopedBlogService(tenantId)`가 이미 프록시를 감싼 BlogService를 준다.

```ts
export async function GET(req: Request) {
  const tenant = await system.middleware.resolveTenantFromRequest!(req);
  if (!tenant) return new Response('Not found', { status: 404 });

  const blog = system.createScopedBlogService!(tenant.tenantId);
  const result = await blog.listPublished({ page: 1, limit: 12 });
  return Response.json(result);
}
```

> **주의**: 테넌트 해석은 **모든 API**에서 수행해야 한다.
> 누락하면 다른 테넌트의 데이터가 섞일 위험이 있다.

> **주의**: `tenantProxy`는 `where/data`에 `tenantId`를 **덮어쓰지 않고** 추가한다.
> 명시적으로 다른 tenantId를 `where`에 넣어도 무시되고 스코프된 id가 사용된다.

## Prisma 스키마 예 (multi 용)

호스트의 Prisma 스키마에는 Tenant 관련 모델이 포함돼야 한다.

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

// 블로그 모델에 tenantId 컬럼 필수
model Post {
  id       String @id @default(cuid())
  tenantId String
  // ... (blog-core 표준 필드)
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, published, publishedAt(sort: Desc)])
  @@map("posts")
}
```

## 컨텍스트 전달

테넌트 ID는 **요청 단위**로 결정된다. React Server Component나 서버 액션에서는 `headers()`로 접근한다.

```ts
import { headers } from 'next/headers';
import { TENANT_ID_HEADER } from '@withwiz/blog-system';

export async function getCurrentTenantId() {
  return headers().get(TENANT_ID_HEADER);
}
```

## 슈퍼 어드민

`SystemRole.SUPER_ADMIN` 사용자는 시스템 전체 콘솔에서 모든 테넌트를 관리한다.
[09-super-admin.md](./09-super-admin.md) 참조.

## 테넌트별 기능 토글

각 테넌트의 플랜에 따라 `tenant.settings`에 기능 플래그를 저장하고, 런타임에서 체크한다.

```ts
const settings = await tenantService!.getSettings(tenantId);
if (!settings.featureFlags?.comments) return notFound();
```

## 관련 문서

- [05-tenant-management.md](./05-tenant-management.md) — Tenant/TenantUser API
- [07-custom-domains.md](./07-custom-domains.md) — 커스텀 도메인
- [06-billing-stripe.md](./06-billing-stripe.md) — 플랜/구독 제한
