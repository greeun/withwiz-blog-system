# 09. 슈퍼 어드민 (Super Admin)

`SystemRole.SUPER_ADMIN` 사용자를 위한 시스템 전체 관리 콘솔.

```ts
enum SystemRole {
  USER = 'USER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}
```

## 사용 범위

- 모든 테넌트 목록 조회 및 활성화/비활성화
- 전체 사용자 관리 (역할 변경, 계정 차단)
- 시스템 지표 모니터링 (테넌트 수, 활성 구독, 사용량)
- 테넌트 간 이슈 대응 (고객 지원)

> **주의**: 슈퍼 어드민은 **모든 테넌트의 데이터에 접근**할 수 있다.
> 이 권한은 **내부 운영자**에게만 부여하고, 접근 로그를 반드시 기록하자.

## 컴포넌트

```ts
import {
  SuperAdminDashboard,
  TenantManager,
  UserManager,
  SystemMonitor,
} from '@withwiz/blog-system/admin';
```

### `SuperAdminDashboard`

슈퍼 어드민 루트 페이지 — 주요 지표 + 네비게이션 셸.

```tsx
// app/super-admin/page.tsx
import { SuperAdminDashboard } from '@withwiz/blog-system/admin';

export default function Page() {
  return (
    <SuperAdminDashboard
      apiBasePath="/api/super-admin"
    />
  );
}
```

### `TenantManager`

테넌트 CRUD + 검색 + 활성화 토글.

```tsx
<TenantManager apiBasePath="/api/super-admin/tenants" />
```

### `UserManager`

전체 사용자 목록 + 시스템 역할 변경 + 테넌트 멤버십 확인.

```tsx
<UserManager apiBasePath="/api/super-admin/users" />
```

### `SystemMonitor`

시스템 수준 지표 대시보드 (테넌트 수, 활성 구독, 실패한 결제 등).

```tsx
<SystemMonitor apiBasePath="/api/super-admin/metrics" />
```

## 라우트 — `createSuperAdminRoutes`

```ts
// system.routes.admin (mode: multi 전용)
system.routes.admin.tenants.list;
system.routes.admin.tenants.deactivate;
system.routes.admin.users.list;
// ... 실제 키는 packages/blog-system/src/routes/admin-routes.ts 참조
```

### 인증 미들웨어

슈퍼 어드민 라우트는 `SystemRole.SUPER_ADMIN` 체크가 필수다.

```ts
async function requireSuperAdmin(req: Request): Promise<Response | null> {
  const token = getAuthToken(req);
  const user = await system.authService!.getCurrentUser(token);
  if (!user || user.systemRole !== SystemRole.SUPER_ADMIN) {
    return new Response('Forbidden', { status: 403 });
  }
  return null;
}

// app/api/super-admin/tenants/route.ts
export async function GET(req: Request) {
  const denied = await requireSuperAdmin(req);
  if (denied) return denied;
  return system.routes.admin!.tenants.list(req);
}
```

## 시스템 수준 작업 예

### 모든 테넌트 검색

```ts
const { items, total } = await system.tenantService!.listAll({
  page: 1,
  limit: 50,
  search: 'acme',
});
```

### 테넌트 비활성화 (로그인/서비스 차단)

```ts
await system.tenantService!.deactivate(tenantId);
// 내부 상태: isActive = false
// TenantResolver가 isActive=true만 매칭하므로 즉시 접근 차단
```

### 전체 사용자 통계

```ts
const totalUsers = await prisma.user.count();
const superAdmins = await prisma.user.count({
  where: { systemRole: 'SUPER_ADMIN' },
});
```

### 시스템 지표 수집

```ts
const metrics = {
  totalTenants: await prisma.tenant.count(),
  activeTenants: await prisma.tenant.count({ where: { isActive: true } }),
  totalUsers: await prisma.user.count(),
  activeSubscriptions: await prisma.subscription.count({
    where: { status: { in: ['active', 'trialing'] } },
  }),
  failedPayments: await prisma.subscription.count({
    where: { status: 'past_due' },
  }),
};
```

## 감사 로그 (권장)

슈퍼 어드민 작업은 반드시 감사 로그에 기록하자.

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String   // 슈퍼 어드민 사용자 ID
  action    String   // 'tenant.deactivate', 'user.role_change', ...
  targetId  String?  // 대상 엔티티 ID
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@map("audit_logs")
}
```

각 슈퍼 어드민 라우트에서:

```ts
await prisma.auditLog.create({
  data: {
    actorId: currentUser.id,
    action: 'tenant.deactivate',
    targetId: tenantId,
    metadata: { reason: body.reason },
  },
});
```

## 슈퍼 어드민 부여/해제

DB에서 직접 수정하거나, 다른 슈퍼 어드민이 업데이트.

```sql
UPDATE users SET system_role = 'SUPER_ADMIN' WHERE email = 'ops@example.com';
```

> **주의**: 초기 슈퍼 어드민은 마이그레이션 seed 또는 수동 SQL로 생성한다.
> 일반 사용자가 본인을 슈퍼 어드민으로 승격하는 API를 제공하지 말 것.

## 관련 문서

- [05-tenant-management.md](./05-tenant-management.md) — Tenant/TenantUser 서비스
- [10-deployment.md](./10-deployment.md) — 초기 슈퍼 어드민 생성
