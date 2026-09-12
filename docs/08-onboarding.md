# 08. 온보딩 (Onboarding)

`OnboardingService`는 신규 테넌트의 초기 설정을 **트랜잭션처럼** 묶어서 처리한다:

1. 테넌트 생성 (슬러그 + 이름 + 설정)
2. 소유자(OWNER) 사용자 추가
3. 기본 카테고리 설정
4. 샘플 게시글 생성 (선택)
5. 플랜 연결 (선택)

## API

```ts
interface OnboardingInput {
  tenantName: string;
  tenantSlug: string;
  ownerUserId: string;
  categories?: Array<{ key: string; label: string }>;
  createSamplePost?: boolean;
  planId?: string;
}

interface OnboardingResult {
  tenant: Tenant;
  tenantUser: TenantUser;
  samplePostId?: string;
}

interface OnboardingService {
  onboardTenant(data: OnboardingInput): Promise<OnboardingResult>;
}
```

## 기본 카테고리

`categories`를 지정하지 않으면 다음 3개가 자동 설정된다:

```ts
[
  { key: 'general', label: '일반' },
  { key: 'notice', label: '공지사항' },
  { key: 'tech', label: '기술' },
]
```

## 사용 예 — 사용자 가입 + 테넌트 생성

```ts
// app/api/onboarding/route.ts
export async function POST(req: Request) {
  const { email, password, name, tenantName, tenantSlug } = await req.json();

  // 1. 사용자 가입 (JWT 발급)
  const { user, tokens } = await system.authService!.register(email, password, name);

  // 2. 테넌트 생성 + OWNER 지정 + 카테고리 + 샘플 글
  const result = await system.onboardingService!.onboardTenant({
    tenantName,
    tenantSlug,
    ownerUserId: user.id,
    createSamplePost: true,
    planId: 'free',
  });

  const res = Response.json({
    user,
    tenant: result.tenant,
    samplePostId: result.samplePostId,
  });
  setAuthCookies(res, tokens);
  return res;
}
```

## 슬러그 규칙

`tenantSlug`는 서브도메인으로 쓰이므로 엄격한 규칙이 필요하다.

```ts
import { z } from 'zod';

const TenantSlugSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '소문자, 숫자, 하이픈만 허용');
```

### 예약어 차단

```ts
const RESERVED = ['www', 'api', 'admin', 'app', 'mail', 'blog', 'static'];
if (RESERVED.includes(slug)) {
  throw new Error('사용할 수 없는 슬러그입니다.');
}
```

> **주의**: 서브도메인 관례상 `www`, `api`, `admin`은 공용 인프라로 남겨두자.
> DNS 또는 라우팅 충돌을 피할 수 있다.

## 온보딩 위저드 컴포넌트

`OnboardingWizard`는 단계별 UI 셸이다.

```tsx
'use client';
import { OnboardingWizard } from '@withwiz/blog-system/admin';

export default function OnboardingPage() {
  return (
    <OnboardingWizard
      submitEndpoint="/api/onboarding"
      onSuccess={(result) => {
        window.location.href = `https://${result.tenant.slug}.${process.env.NEXT_PUBLIC_BASE_DOMAIN}`;
      }}
    />
  );
}
```

기본 단계:
1. 계정 생성 (이메일 + 비밀번호 + 이름)
2. 테넌트 정보 (이름 + 슬러그 + 슬러그 중복 체크)
3. 카테고리 선택 (기본 3개 유지 또는 커스텀)
4. 샘플 글 생성 여부
5. 플랜 선택 (무료/유료)
6. 결제(유료 시) → Stripe 체크아웃으로 리다이렉트

## 완료 후 리다이렉트 전략

- **서브도메인 방식**: `https://{slug}.{baseDomain}/admin/onboarding-complete`
- **경로 방식**: `/dashboard?tenantId={tenant.id}`

서브도메인 전환 시 사용자는 **재로그인이 필요**할 수 있다 (쿠키 도메인 때문).
쿠키를 `.example.com`처럼 부모 도메인으로 설정하면 서브도메인 간 공유 가능.

```ts
// httpOnly 쿠키 — 부모 도메인 스코프
'access_token=xxx; Domain=.blog.example.com; HttpOnly; Secure'
```

> **주의**: 커스텀 도메인(다른 루트)에서는 쿠키를 공유할 수 없다.
> 커스텀 도메인은 별도 로그인이 필요한 게 정상이다.

## 트랜잭션 보장

현재 `onboardTenant`는 각 단계를 순차 호출한다. 중간 실패 시:
- 테넌트 생성 O → 소유자 추가 X → **고아 테넌트** 발생
- 고아 테넌트는 관리자가 수동 삭제하거나, 배치로 정리

필요하다면 Prisma `$transaction`으로 묶는 구현 고도화가 가능하지만,
외부 API(Stripe customer 생성 등)와 섞이면 트랜잭션이 깨진다는 점에 주의.

## 관련 문서

- [05-tenant-management.md](./05-tenant-management.md) — Tenant/TenantUser
- [04-authentication.md](./04-authentication.md) — 사용자 가입 API
- [06-billing-stripe.md](./06-billing-stripe.md) — 결제 단계
