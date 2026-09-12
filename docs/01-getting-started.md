# 01. 시작하기

## 설치

호스트 `package.json`:

```json
{
  "dependencies": {
    "@withwiz/blog-core": "file:./packages/blog-core",
    "@withwiz/blog-system": "file:./packages/blog-system"
  }
}
```

그리고 peer 패키지:

```bash
npm install @prisma/client next react stripe zod
```

## 최소 설정 — Single 모드

`mode: 'single'`은 기본 단일 사이트용이다. Tenant/Billing/Domain 없이 동작한다.

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
  },
  blog: {
    modelName: 'news',
  },
});

// 사용 가능한 서비스/라우트
system.blogService;
system.authService;
system.routes.blog;   // GET/POST 핸들러 맵
system.routes.auth;
```

## Next.js 라우트 연결 — Single

```ts
// app/api/blog/route.ts
import { system } from '@/lib/blog-system';
export const GET = system.routes.blog.list;   // 공개 목록

// app/api/auth/login/route.ts
export const POST = system.routes.auth.login;

// app/api/auth/refresh/route.ts
export const POST = system.routes.auth.refresh;
```

> **주의**: 라우트 핸들러 맵의 키는 `routes/*.ts` 구현에 따른다.
> 실제 제공 키는 `packages/blog-system/src/routes/blog-routes.ts` 등을 참조.

## 멀티 모드 필수 요구 사항

```ts
createBlogSystem({
  mode: 'multi',
  prisma,
  auth: { jwtSecret: process.env.JWT_SECRET! },
  blog: { modelName: 'post' },
  domain: { baseDomain: 'blog.example.com' },   // 필수
  // billing, onboarding은 선택
});
```

`domain.baseDomain`은 **서브도메인 해석의 기준**이다.
`my-blog.blog.example.com` → 테넌트 `slug='my-blog'`로 매핑된다.

## 기능 토글 (Single / Multi 공통)

```ts
features: {
  tags: true,                      // 기본 true
  comments: {
    enabled: true,
    autoApprove: false,
    requireLogin: false,
    maxDepth: 2,
    rateLimit: { maxPerHour: 5 },
  },
  search: true,                    // 기본 true (Postgres FTS 필요)
  scheduler: {
    enabled: true,
    cronSecret: process.env.CRON_SECRET!,
  },
}
```

각 기능의 상세는 blog-core 문서에 있다:
- 태그: [../../blog-core/docs/04-tags.md](../../blog-core/docs/04-tags.md)
- 댓글: [../../blog-core/docs/05-comments.md](../../blog-core/docs/05-comments.md)
- 검색: [../../blog-core/docs/06-search.md](../../blog-core/docs/06-search.md)
- 스케줄러: [../../blog-core/docs/07-scheduler.md](../../blog-core/docs/07-scheduler.md)

## 반환 타입 — `BlogSystem`

```ts
interface BlogSystem {
  blogService: BlogService | null;       // single 모드에서만 존재
  authService: AuthService | null;
  tenantService: TenantService | null;   // multi 전용
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
  createScopedBlogService: ((tenantId: string) => BlogService) | null;  // multi
}
```

> **주의**: multi 모드에서는 `blogService`가 `null`이다.
> 테넌트별 스코프 서비스는 `createScopedBlogService(tenantId)`로 얻는다.

## 다음 단계

- 단일 호스트 구성 상세: [02-single-tenant.md](./02-single-tenant.md)
- 멀티 테넌트 상세: [03-multi-tenant.md](./03-multi-tenant.md)
- 인증 상세: [04-authentication.md](./04-authentication.md)
