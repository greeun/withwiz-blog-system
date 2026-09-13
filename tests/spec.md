> 현행 분류 문서는 [docs/testing/test-classification.md](../docs/testing/test-classification.md) 이다.

# @withwiz/blog-system 풀테스트 스펙

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@withwiz/blog-system` 패키지의 코어/테넌트/인증/과금/온보딩/라우트 전 모듈을 독립 테스트하여 멀티테넌트 블로그 SaaS 프레임워크로서 별도 배포 품질 보증

**Architecture:** 패키지 내부 `tests/` 폴더에 Vitest 기반 단위 테스트 배치. 모듈별 디렉토리 없이 플랫 구조. Prisma/Stripe/toolkit 의존 서비스는 mock 주입 패턴 사용. `@withwiz/blog-core` 함수는 실제 사용 (peer dependency).

**Tech Stack:** Vitest, TypeScript, vi.mock/vi.fn (Prisma/Stripe/toolkit mock), zod

---

## 인프라 설정

### Task 0: Vitest 프로젝트 설정

**Files:**
- Modify: `vitest.config.ts` — `projects` 배열에 blog-system 프로젝트 추가
- Create: `packages/blog-system/tests/setup.ts`

- [ ] **Step 1: setup.ts 생성**

```ts
// packages/blog-system/tests/setup.ts
import { vi } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-testing-minimum-32-chars';
process.env.NODE_ENV = 'test';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('next/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('next/server')>();
  return {
    ...original,
    NextResponse: {
      json: (data: unknown, init?: ResponseInit) => {
        const body = JSON.stringify(data);
        return new Response(body, {
          ...init,
          headers: { 'Content-Type': 'application/json', ...init?.headers },
        });
      },
    },
  };
});
```

- [ ] **Step 2: vitest.config.ts에 프로젝트 추가**

```ts
{
  extends: true,
  test: {
    name: 'blog-system',
    include: ['packages/blog-system/tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./packages/blog-system/tests/setup.ts'],
  },
},
```

- [ ] **Step 3: 실행 확인**

```bash
npx vitest run --project blog-system
```

- [ ] **Step 4: 커밋** `test(blog-system): vitest 프로젝트 설정 추가`

---

## Sprint 1 — 코어 순수 함수

### Task 1: config (resolveBlogConfig)

**Files:**
- Test: `packages/blog-system/tests/config.test.ts`
- Source: `packages/blog-system/src/core/config.ts`

**테스트 대상:** `resolveBlogConfig` — 순수 함수

| TC ID | 설명 |
|-------|------|
| BS-CF-01 | basePath 미제공 시 기본값 `/blog` |
| BS-CF-02 | basePath `/news` → apiBasePath `/api/news` |
| BS-CF-03 | basePath `/news` → adminApiBasePath `/api/admin/news` |
| BS-CF-04 | 커스텀 basePath + 커스텀 categories 전달 확인 |
| BS-CF-05 | storage 설정 전달 확인 |
| BS-CF-06 | 빈 blog 섹션 → 모든 기본값 적용 |
| BS-CF-07 | modelName 전달 확인 |
| BS-CF-08 | storage 어댑터 지정 시에도 정상 동작 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): resolveBlogConfig 테스트 8건`

---

### Task 2: tenant-proxy (createTenantProxy)

**Files:**
- Test: `packages/blog-system/tests/tenant-proxy.test.ts`
- Source: `packages/blog-system/src/core/tenant-proxy.ts`

**mock 전략:** mock Prisma delegate 객체 직접 생성

| TC ID | 설명 |
|-------|------|
| BS-TP-01 | findMany 호출 시 where.tenantId 자동 주입 |
| BS-TP-02 | findFirst 호출 시 where.tenantId 주입 |
| BS-TP-03 | findUnique 호출 시 where.tenantId 주입 |
| BS-TP-04 | count 호출 시 where.tenantId 주입 |
| BS-TP-05 | create 호출 시 data.tenantId 주입 |
| BS-TP-06 | update 호출 시 where.tenantId 주입 |
| BS-TP-07 | delete 호출 시 where.tenantId 주입 |
| BS-TP-08 | updateMany 호출 시 where.tenantId 주입 |
| BS-TP-09 | deleteMany 호출 시 where.tenantId 주입 |
| BS-TP-10 | groupBy 호출 시 where.tenantId 주입 |
| BS-TP-11 | $transaction 콜백 내 프록시 재귀 적용 |
| BS-TP-12 | findMany 없는 프로퍼티(비모델) → 원본 그대로 반환 |
| BS-TP-13 | 기존 where 조건과 tenantId 병합 확인 |
| BS-TP-14 | where 없이 호출 시 → where: { tenantId } 자동 생성 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): tenant-proxy 테스트 14건`

---

### Task 3: tenant-validator (Zod 스키마)

**Files:**
- Test: `packages/blog-system/tests/tenant-validator.test.ts`
- Source: `packages/blog-system/src/validators/tenant.validator.ts`

| TC ID | 설명 |
|-------|------|
| BS-TV-01 | CreateTenantSchema: 유효 데이터 통과 |
| BS-TV-02 | CreateTenantSchema: name 빈 문자열 실패 |
| BS-TV-03 | CreateTenantSchema: name 101자 실패 |
| BS-TV-04 | slug: 2자 실패, 3자 통과 |
| BS-TV-05 | slug: 63자 통과, 64자 실패 |
| BS-TV-06 | slug: 하이픈 시작 실패 |
| BS-TV-07 | slug: 하이픈 끝 실패 |
| BS-TV-08 | slug: 대문자 실패 |
| BS-TV-09 | slug: 특수문자 실패 |
| BS-TV-10 | logo: 유효 URL 통과, 무효 URL 실패 |
| BS-TV-11 | planId: 비 cuid 실패 |
| BS-TV-12 | settings.seo.description: 301자 실패 |
| BS-TV-13 | settings.theme.logo: 유효하지 않은 URL 실패 |
| BS-TV-14 | settings.blogConfig: 임의 객체 통과 (passthrough) |
| BS-TV-15 | UpdateTenantSchema: 빈 객체 통과 (모두 optional) |
| BS-TV-16 | UpdateTenantSchema: slug만 변경 가능 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): tenant validator 테스트 16건`

---

## Sprint 2 — 테넌트 서비스 계층

### Task 4: tenant-service (createTenantService)

**Files:**
- Test: `packages/blog-system/tests/tenant-service.test.ts`
- Source: `packages/blog-system/src/tenant/tenant-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-TS-01 | create: 유효 입력 → 테넌트 생성 |
| BS-TS-02 | create: 슬러그 중복 → Error throw |
| BS-TS-03 | create: DEFAULT_TENANT_SETTINGS 머지 확인 |
| BS-TS-04 | getById: 존재하는 id → 테넌트 반환 |
| BS-TS-05 | getById: 없는 id → null |
| BS-TS-06 | getBySlug: 정상 조회 |
| BS-TS-07 | getByCustomDomain: 정상 조회 |
| BS-TS-08 | update: 슬러그 변경 시 중복 체크 (자기 자신 제외) |
| BS-TS-09 | update: 슬러그 중복 → Error throw |
| BS-TS-10 | deactivate: isActive=false로 변경 |
| BS-TS-11 | listAll: 검색어 없을 때 빈 where |
| BS-TS-12 | listAll: 검색어 있을 때 OR 조건 (name + slug) |
| BS-TS-13 | listAll: 페이지네이션 계산 (skip, totalPages, total) |
| BS-TS-14 | getSettings: 존재하지 않는 테넌트 → Error |
| BS-TS-15 | updateSettings: deep merge 동작 (기존 값 보존 + 새 값 오버라이드) |
| BS-TS-16 | updateSettings: domainVerification 보존 |

- [ ] **Step 1: mock Prisma 헬퍼 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): tenant service 테스트 16건`

---

### Task 5: tenant-user-service (createTenantUserService)

**Files:**
- Test: `packages/blog-system/tests/tenant-user-service.test.ts`
- Source: `packages/blog-system/src/tenant/tenant-user-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-TU-01 | addUser: 정상 추가 |
| BS-TU-02 | addUser: 중복 추가 시 Error |
| BS-TU-03 | removeUser: 정상 제거 |
| BS-TU-04 | removeUser: 유일 OWNER 제거 차단 |
| BS-TU-05 | removeUser: 다수 OWNER 중 1명 제거 허용 |
| BS-TU-06 | updateRole: 정상 변경 |
| BS-TU-07 | updateRole: 유일 OWNER의 역할 변경 차단 |
| BS-TU-08 | hasPermission: OWNER ≥ VIEWER → true |
| BS-TU-09 | hasPermission: EDITOR < ADMIN → false |
| BS-TU-10 | hasPermission: 동일 역할 → true |
| BS-TU-11 | hasPermission: 멤버십 없음 → false |
| BS-TU-12 | listUsers: 정상 조회 |
| BS-TU-13 | getUserTenants: userId로 소속 테넌트 목록 |
| BS-TU-14 | getUserRole: 멤버십 없으면 null |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): tenant user service 테스트 14건`

---

### Task 6: tenant-resolver (createTenantResolver)

**Files:**
- Test: `packages/blog-system/tests/tenant-resolver.test.ts`
- Source: `packages/blog-system/src/tenant/tenant-resolver.ts`

| TC ID | 설명 |
|-------|------|
| BS-TR-01 | extractSubdomain: `my-blog.blog.example.com` + `blog.example.com` → `'my-blog'` |
| BS-TR-02 | extractSubdomain: 동일 도메인 → null |
| BS-TR-03 | extractSubdomain: 접미사 불일치 → null |
| BS-TR-04 | extractSubdomain: 포트 포함 호스트 → 포트 제거 후 추출 |
| BS-TR-05 | extractSubdomain: 중첩 서브도메인 (a.b.base) → null |
| BS-TR-06 | resolveFromSubdomain: mock prisma → 테넌트 반환 |
| BS-TR-07 | resolveFromCustomDomain: mock prisma → 테넌트 반환 |
| BS-TR-08 | resolve: 커스텀 도메인 우선 → 서브도메인 폴백 |
| BS-TR-09 | resolve: 둘 다 없으면 null |

- [ ] **Step 1: 테스트 파일 작성 (`extractSubdomain` 간접 테스트)**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): tenant resolver 테스트 9건`

---

### Task 7: tenant-middleware (resolveTenantFromRequest)

**Files:**
- Test: `packages/blog-system/tests/tenant-middleware.test.ts`
- Source: `packages/blog-system/src/tenant/tenant-middleware.ts`

| TC ID | 설명 |
|-------|------|
| BS-TM-01 | X-Tenant-Id 헤더 존재 → 슬러그로 조회 우선 |
| BS-TM-02 | X-Tenant-Id 헤더 없으면 → 호스트명 기반 resolve |
| BS-TM-03 | 둘 다 null → null 반환 |
| BS-TM-04 | TENANT_ID_HEADER 상수값 = 'X-Tenant-Id' |
| BS-TM-05 | TENANT_SLUG_HEADER 상수값 = 'X-Tenant-Slug' |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): tenant middleware 테스트 5건`

---

## Sprint 3 — 인증 모듈

### Task 8: auth-fetch (createAuthFetch)

**Files:**
- Test: `packages/blog-system/tests/auth-fetch.test.ts`
- Source: `packages/blog-system/src/auth/auth-fetch.ts`

| TC ID | 설명 |
|-------|------|
| BS-AF-01 | 정상 200 응답 → 그대로 반환 |
| BS-AF-02 | 401 + 갱신 성공 → 재시도 → 원래 요청 결과 반환 |
| BS-AF-03 | 401 + 갱신 실패 → 원본 401 반환 |
| BS-AF-04 | credentials: 'same-origin' 자동 설정 |
| BS-AF-05 | 비-401 에러 (500) → 그대로 반환 |

- [ ] **Step 1: globalThis.fetch mock 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): auth-fetch 테스트 5건`

---

### Task 9: role-middleware (createTenantRoleMiddleware)

**Files:**
- Test: `packages/blog-system/tests/role-middleware.test.ts`
- Source: `packages/blog-system/src/auth/role-middleware.ts`

| TC ID | 설명 |
|-------|------|
| BS-RM-01 | userId 없음 → 401 |
| BS-RM-02 | tenantId 헤더 없음 → 400 |
| BS-RM-03 | 권한 부족 → 403 |
| BS-RM-04 | 권한 충분 → next() 호출 + metadata.tenantRole 설정 |

- [ ] **Step 1: mock tenantUserService 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): role middleware 테스트 4건`

---

## Sprint 4 — 과금 모듈

### Task 10: webhook-handler (mapStripeStatus + 이벤트 라우팅)

**Files:**
- Test: `packages/blog-system/tests/webhook-handler.test.ts`
- Source: `packages/blog-system/src/billing/webhook-handler.ts`

| TC ID | 설명 |
|-------|------|
| BS-WH-01 | mapStripeStatus: 'active' → 'ACTIVE' |
| BS-WH-02 | mapStripeStatus: 'past_due' → 'PAST_DUE' |
| BS-WH-03 | mapStripeStatus: 'canceled' → 'CANCELED' |
| BS-WH-04 | mapStripeStatus: 'trialing' → 'TRIALING' |
| BS-WH-05 | mapStripeStatus: unknown → 'ACTIVE' 기본값 |
| BS-WH-06 | handleEvent: customer.subscription.created 라우팅 |
| BS-WH-07 | handleEvent: customer.subscription.updated 라우팅 |
| BS-WH-08 | handleEvent: customer.subscription.deleted 라우팅 |
| BS-WH-09 | handleEvent: invoice.payment_succeeded 라우팅 |
| BS-WH-10 | handleEvent: invoice.payment_failed 라우팅 |
| BS-WH-11 | handleEvent: 미지원 이벤트 → 에러 없이 무시 |

- [ ] **Step 1: mock Prisma + mock Stripe 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): webhook handler 테스트 11건`

---

### Task 11: plan-service (createPlanService)

**Files:**
- Test: `packages/blog-system/tests/plan-service.test.ts`
- Source: `packages/blog-system/src/billing/plan-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-PS-01 | create: Plan 생성 |
| BS-PS-02 | getById: 존재하는 id → Plan 반환 |
| BS-PS-03 | getById: 없는 id → null |
| BS-PS-04 | listActive: isActive=true만 조회, priceMonthly 오름차순 |
| BS-PS-05 | update: 필드 변경 |
| BS-PS-06 | deactivate: isActive=false |
| BS-PS-07 | getDefault: 가장 저렴한 활성 플랜 |
| BS-PS-08 | mapToPlan: stripeProductId null → undefined 변환 |
| BS-PS-09 | mapToPlan: stripePriceId null → undefined 변환 |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): plan service 테스트 9건`

---

### Task 12: billing-service 헬퍼 함수

**Files:**
- Test: `packages/blog-system/tests/billing-helpers.test.ts`
- Source: `packages/blog-system/src/billing/billing-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-BH-01 | getMonthStart: 2025-03-15 → 2025-03-01 |
| BS-BH-02 | getMonthStart: 1월 1일 → 1월 1일 |
| BS-BH-03 | getMonthStart: 시간 00:00:00 초기화 |
| BS-BH-04 | getMetricMax: 'posts' → plan.maxPosts |
| BS-BH-05 | getMetricMax: 'storage_bytes' → plan.maxStorage |
| BS-BH-06 | getMetricMax: 'api_calls' → 10000 (또는 기본값) |
| BS-BH-07 | getMetricMax: 미지원 메트릭 → 0 |
| BS-BH-08 | mapToSubscription: null 필드 → undefined |
| BS-BH-09 | mapToUsageRecord: 정상 변환 |

**참고:** 내부 함수이므로 모듈을 직접 import 후 간접 테스트하거나, `createBillingService`를 통해 `checkLimit` 등으로 간접 검증

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): billing 헬퍼 함수 테스트 9건`

---

## Sprint 5 — 온보딩 + 도메인 + 팩토리

### Task 13: onboarding-service (createOnboardingService)

**Files:**
- Test: `packages/blog-system/tests/onboarding-service.test.ts`
- Source: `packages/blog-system/src/onboarding/onboarding-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-OB-01 | 기본 카테고리 적용 (categories 미제공 시) |
| BS-OB-02 | 커스텀 카테고리 적용 |
| BS-OB-03 | 샘플 게시글 생성 (createSamplePost=true) |
| BS-OB-04 | 샘플 게시글 생성 실패 → 온보딩 성공 유지 |
| BS-OB-05 | createSamplePost=false → samplePostId 없음 |
| BS-OB-06 | ownerUserId → OWNER 역할로 추가 |
| BS-OB-07 | planId 전달 시 테넌트에 반영 |

- [ ] **Step 1: mock 서비스 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): onboarding service 테스트 7건`

---

### Task 14: domain-service 헬퍼 함수

**Files:**
- Test: `packages/blog-system/tests/domain-service.test.ts`
- Source: `packages/blog-system/src/tenant/domain-service.ts`

| TC ID | 설명 |
|-------|------|
| BS-DS-01 | getDomainVerificationData: token 없음 → null |
| BS-DS-02 | getDomainVerificationData: 유효 settings → 데이터 반환 |
| BS-DS-03 | buildVerificationResponse: TXT 레코드 name/value 형식 |
| BS-DS-04 | addCustomDomain: 존재하지 않는 테넌트 → Error |
| BS-DS-05 | addCustomDomain: 도메인 중복 → Error |
| BS-DS-06 | checkVerification: 이미 인증 → 단락 처리 |
| BS-DS-07 | checkVerification: DNS TXT 일치 → verified 상태 |
| BS-DS-08 | checkVerification: DNS TXT 불일치 → pending 유지 |
| BS-DS-09 | removeCustomDomain: 정상 제거 |
| BS-DS-10 | vercelEnabled: 3개 설정 중 하나라도 없으면 비활성 |

- [ ] **Step 1: mock Prisma + dns/promises mock 작성**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): domain service 테스트 10건`

---

### Task 15: blog-system 팩토리 (createBlogSystem)

**Files:**
- Test: `packages/blog-system/tests/blog-system-factory.test.ts`
- Source: `packages/blog-system/src/core/blog-system.ts`

| TC ID | 설명 |
|-------|------|
| BS-BF-01 | single 모드: blogService 존재, tenantService null |
| BS-BF-02 | single 모드: blogRoutes 존재, tenantRoutes null |
| BS-BF-03 | multi 모드: 모든 서비스 존재 |
| BS-BF-04 | multi 모드: billing 미설정 → billingService null |
| BS-BF-05 | multi 모드: billing 설정 → billingService 존재 |
| BS-BF-06 | multi 모드: domain 미설정 → domainService null |
| BS-BF-07 | createScopedBlogService: tenantProxy 적용 |

- [ ] **Step 1: mock 전체 의존 서비스**
- [ ] **Step 2: 테스트 파일 작성**
- [ ] **Step 3: 실행 확인**
- [ ] **Step 4: 커밋** `test(blog-system): blog-system 팩토리 테스트 7건`

---

## Sprint 6 — 라우트 헬퍼

### Task 16: blog-routes 내부 헬퍼

**Files:**
- Test: `packages/blog-system/tests/route-helpers.test.ts`
- Source: `packages/blog-system/src/routes/blog-routes.ts`

| TC ID | 설명 |
|-------|------|
| BS-RH-01 | parseSortKey: 유효 키 → 그대로 반환 |
| BS-RH-02 | parseSortKey: 무효 키 → defaultKey 반환 |
| BS-RH-03 | parseSortKey: searchParams에 sort 없음 → defaultKey |
| BS-RH-04 | validateIds: 유효 배열 → { valid: true, ids } |
| BS-RH-05 | validateIds: 빈 배열 → { valid: false } |
| BS-RH-06 | validateIds: null → { valid: false } |
| BS-RH-07 | validateIds: 비배열 → { valid: false } |
| BS-RH-08 | validateAndParse: Zod 통과 → { success: true, data } |
| BS-RH-09 | validateAndParse: Zod 실패 → { success: false, response } |

**참고:** 이 함수들은 비익스포트이므로, `createBlogRoutes` 반환 핸들러를 통해 간접 테스트하거나, 모듈 내부 접근 필요. 라우트 핸들러 통합 테스트로 대체 가능.

- [ ] **Step 1: 테스트 파일 작성 (라우트 핸들러 간접 테스트)**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): route helpers 테스트 9건`

---

### Task 17: admin-routes 헬퍼

**Files:**
- Test: `packages/blog-system/tests/admin-routes.test.ts`
- Source: `packages/blog-system/src/routes/admin-routes.ts`

| TC ID | 설명 |
|-------|------|
| BS-AR-01 | verifySuperAdmin: SUPER_ADMIN 역할 → null (통과) |
| BS-AR-02 | verifySuperAdmin: USER 역할 → 403 응답 |
| BS-AR-03 | verifySuperAdmin: role 없음 → 403 응답 |
| BS-AR-04 | safeCount: 존재하는 모델 → count 반환 |
| BS-AR-05 | safeCount: 존재하지 않는 모델 → 0 반환 |
| BS-AR-06 | users.list: 평면 PaginatedResult 구조 반환 (pagination 객체 없음) |

- [ ] **Step 1: 테스트 파일 작성**
- [ ] **Step 2: 실행 확인**
- [ ] **Step 3: 커밋** `test(blog-system): admin routes 헬퍼 테스트 5건`

---

## Definition of Done

- [ ] 모든 테스트 파일이 `packages/blog-system/tests/` 하위에 존재
- [ ] `npx vitest run --project blog-system` 전체 PASS
- [ ] 테스트 수 합계: ~148건 이상
- [ ] 각 Task 완료 후 독립 커밋 존재
- [ ] Prisma mock이 실제 서비스 시그니처와 일치
- [ ] Stripe mock이 실제 이벤트 타입과 일치
