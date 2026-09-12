# 05. 테넌트 관리 (Tenant Management)

멀티 테넌트 모드에서 Tenant, TenantUser CRUD와 역할 기반 권한을 관리한다.

## 서비스

| 서비스 | 팩토리 | 책임 |
|---|---|---|
| `TenantService` | `createTenantService(prisma)` | Tenant CRUD, 설정 |
| `TenantUserService` | `createTenantUserService(prisma)` | 사용자 ↔ 테넌트 매핑, 역할 |

`createBlogSystem({ mode: 'multi' })`이 이미 생성해서 `system.tenantService`, `system.tenantUserService`에 제공한다.

## `TenantService` API

```ts
interface TenantService {
  create(data: CreateTenantInput): Promise<Tenant>;
  getById(id: string): Promise<Tenant | null>;
  getBySlug(slug: string): Promise<Tenant | null>;
  getByCustomDomain(domain: string): Promise<Tenant | null>;
  update(id: string, data: UpdateTenantInput): Promise<Tenant>;
  deactivate(id: string): Promise<void>;
  listAll({ page, limit, search? }): Promise<PaginatedResult<Tenant>>;
  getSettings(tenantId: string): Promise<TenantSettings>;
  updateSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<TenantSettings>;
}
```

### `CreateTenantInput`

```ts
interface CreateTenantInput {
  slug: string;            // URL 식별자 (유니크)
  name: string;
  planId?: string;
  settings?: Partial<TenantSettings>;
}
```

### 사용 예

```ts
const tenant = await system.tenantService!.create({
  slug: 'acme',
  name: 'ACME Corp Blog',
  settings: {
    blogConfig: { categories: { notice: { label: '공지' } } },
  },
});
```

## `TenantUserService` API — RBAC

```ts
enum TenantRole { OWNER, ADMIN, EDITOR, VIEWER }

interface TenantUserService {
  addUser(tenantId, userId, role): Promise<TenantUser>;
  removeUser(tenantId, userId): Promise<void>;
  updateRole(tenantId, userId, role): Promise<TenantUser>;
  listUsers(tenantId, { page, limit }?): Promise<PaginatedResult<TenantUserWithUser>>;
  getUserRole(tenantId, userId): Promise<TenantRole | null>;
  getUserTenants(userId): Promise<UserTenantMembership[]>;
  hasPermission(tenantId, userId, requiredRole): Promise<boolean>;
}
```

### 역할 계층

```
OWNER(4) > ADMIN(3) > EDITOR(2) > VIEWER(1)
```

`hasPermission(tenantId, userId, requiredRole)`는 `ROLE_LEVELS`를 비교해서 **이상(≥)** 권한을 체크한다.

| 요구 역할 | 허용 역할 |
|---|---|
| VIEWER | VIEWER, EDITOR, ADMIN, OWNER |
| EDITOR | EDITOR, ADMIN, OWNER |
| ADMIN | ADMIN, OWNER |
| OWNER | OWNER만 |

### 권한별 일반적 기능 매핑

| 역할 | 권한 |
|---|---|
| OWNER | 플랜 변경, 결제, 테넌트 삭제, 모든 하위 권한 |
| ADMIN | 사용자 초대, 도메인 관리, 글 게시, 모더레이션 |
| EDITOR | 글 작성/수정/삭제, 댓글 모더레이션 |
| VIEWER | 읽기 전용 (초안 확인용) |

## 권한 미들웨어 — `requireTenantRole`

```ts
import { TenantRole } from '@withwiz/blog-system';

// 라우트 단위
export async function POST(req: Request) {
  const check = system.middleware.requireTenantRole!(TenantRole.EDITOR);
  const denied = await check(req);
  if (denied) return denied;           // 미들웨어가 403 Response 반환 시

  // ... 핸들러 본문
}
```

또는 직접 호출:

```ts
const ok = await system.tenantUserService!.hasPermission(
  tenantId,
  userId,
  TenantRole.ADMIN,
);
if (!ok) return new Response('Forbidden', { status: 403 });
```

## 테넌트 사용자 초대 플로우 (권장)

1. 관리자가 이메일 + 역할 입력 → 초대 토큰 생성 (JWT/별도 테이블)
2. 초대 이메일 발송 — 링크에 토큰 포함
3. 초대받은 사용자가 가입(또는 로그인)하면 토큰 검증
4. `tenantUserService.addUser(tenantId, userId, role)` 호출

> **주의**: 초대 토큰은 **단기 만료**(48시간 권장)로 설정하고, 사용 후 즉시 무효화하자.
> 토큰 테이블에 `usedAt` 타임스탬프를 기록하는 방식이 안전하다.

## `TenantSettings` 구조

```ts
interface TenantSettings {
  blogConfig?: {
    categories?: Record<string, { label: string; bgColor?: string; textColor?: string }>;
    basePath?: string;
    pageSize?: number;
  };
  theme?: {
    primaryColor?: string;
    logo?: string;
  };
  seo?: {
    defaultMetaDescription?: string;
    defaultOgImage?: string;
  };
  featureFlags?: Record<string, boolean>;
}
```

### 부분 업데이트

```ts
await tenantService.updateSettings(tenantId, {
  theme: { primaryColor: '#D4AF37' },
});
```

기존 설정과 얕은 머지 수행.

## 사용자의 소속 테넌트 목록

로그인한 사용자가 여러 테넌트에 속할 수 있다.

```ts
const memberships = await tenantUserService.getUserTenants(userId);
// [{ tenant: { slug, name, ... }, role: 'OWNER' }, ...]
```

## 관련 문서

- [03-multi-tenant.md](./03-multi-tenant.md) — 테넌트 해석
- [04-authentication.md](./04-authentication.md) — JWT 발급
- [08-onboarding.md](./08-onboarding.md) — 테넌트 + OWNER 생성 통합 플로우
