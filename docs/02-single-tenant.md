# 02. 단일 테넌트 (Single Mode)

단일 사이트용 완전 구성 가이드.

## 특징

- `BlogService`, `AuthService` 등 모든 서비스가 **즉시 인스턴스화**된다.
- Tenant/Billing/Domain/Onboarding 서비스는 `null`.
- `createScopedBlogService` → `null`.
- 모든 API가 글로벌 스코프.

## 전체 설정 예

```ts
// src/lib/blog-system.ts
import { createBlogSystem } from '@withwiz/blog-system';
import { prisma } from '@/lib/prisma';
import { createS3StorageAdapter } from '@withwiz/blog-core/storage';

// S3, Cloudflare R2, MinIO 등 S3 API 호환 스토리지
const storage = createS3StorageAdapter({
  bucket: process.env.R2_BUCKET_NAME!,
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  keyPrefix: 'blog/',
});

export const system = createBlogSystem({
  mode: 'single',
  prisma,
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
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
  blog: {
    modelName: 'news',
    basePath: '/blog',
    adminBasePath: '/admin/blog',
    uploadEndpoint: '/api/upload',
    pageSize: 12,
    categories: {
      notice: { key: 'notice', label: '공지', bgColor: '#121212', textColor: '#FEFEFE' },
      performance: { key: 'performance', label: '공연', bgColor: '#D4AF37', textColor: '#121212' },
    },
  },
  storage,
  features: {
    tags: true,
    comments: {
      enabled: true,
      autoApprove: false,
      requireLogin: false,
      maxDepth: 2,
      rateLimit: { maxPerHour: 5 },
    },
    search: true,
    scheduler: {
      enabled: true,
      cronSecret: process.env.CRON_SECRET!,
    },
  },
});

// 편의 export
export const { blogService, authService, tagService, commentService, searchService } = system;
```

## Next.js App Router 연결

### Auth

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

### Blog

```ts
// app/api/blog/route.ts
export const GET = system.routes.blog.list;

// app/api/blog/[slug]/route.ts
export const GET = system.routes.blog.detail;

// app/api/admin/blog/route.ts — 인증 미들웨어로 감싼다
import { withAdminApi } from '@withwiz/pms/infrastructure';
export const GET = withAdminApi(system.routes.blog.adminList);
export const POST = withAdminApi(system.routes.blog.adminCreate);
```

> **주의**: 라우트 핸들러 맵의 정확한 키는 `packages/blog-system/src/routes/blog-routes.ts` 구현을 참고하자.
> 본 문서는 대표 예시이며, 구현과 차이가 있을 수 있다.

### Tag / Comment / Search / Scheduler

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

## 인증 통합 — Next.js 미들웨어

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

## 호스트 프로젝트 구조 예

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
│   │   └── [slug]/
│   │       ├── page.tsx
│   │       └── opengraph-image.tsx
│   └── admin/blog/
│       ├── page.tsx                 # BlogManagerClient
│       └── [id]/page.tsx            # BlogEditForm
├── lib/
│   ├── prisma.ts
│   ├── blog-system.ts
│   └── blog-config.ts
└── middleware.ts
```

## 환경 변수

호스트 `.env.local`에 최소:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
CRON_SECRET=...
NEXT_PUBLIC_SITE_URL=https://your-blog.example.com

# OAuth (선택)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# R2 (선택)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
```

전체 변수: [10-deployment.md](./10-deployment.md)

## 관련 문서

- [04-authentication.md](./04-authentication.md) — JWT/OAuth 상세
- [10-deployment.md](./10-deployment.md) — 배포 체크리스트
