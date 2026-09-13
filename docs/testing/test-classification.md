# @withwiz/blog-system 테스트 분류 체계

> 작성일: 2026-09-13. 이 문서는 `tests/spec.md`(구현 작업 계획서)를 대신하는 현행 분류 문서이다. 모든 수치와 케이스는 기준 커밋에서 테스트를 실행하고 코드를 읽어 확인한 값만 기재했다.

## 개요

| 항목 | 내용 |
|------|------|
| 대상 | `@withwiz/blog-system` 0.2.1: 단일·멀티 테넌트 블로그 SaaS 프레임워크 |
| 범위 | `src/` 전체(core/, tenant/, auth/, billing/, onboarding/, routes/, admin/, validators/, types/)와 `tests/` 아래 테스트 파일 33개 |
| 기준 커밋 | `52d72e1` fix(routes): 상태 코드가 없는 예외를 toolkit 오류 처리기로 넘긴다 |
| 환경 | Vitest 3.2.7, Node.js 22.22.0, pnpm 11.10.0. 테스트 환경은 `node`(vitest.config.ts 에 `environment` 미지정) |
| 주요 설치본 | `@withwiz/toolkit` 0.13.0, `@withwiz/blog-core` 2.1.2, `next` 16.3.4, `react` 19.3.0, `zod` 4.6.2, `stripe` 17.7.0 |
| 수집 규칙 | `tests/**/*.test.ts` 만 수집(`.tsx` 테스트는 수집 대상이 아님), `setupFiles` 없음 |
| 렌더링 인프라 | 없음. jsdom·happy-dom·@testing-library 가 devDependencies 와 node_modules 에 존재하지 않음 |
| 목표 커버리지 | 미설정. vitest.config.ts 에 coverage 설정이 없고 `@vitest/coverage-*` 패키지도 설치되어 있지 않아 커버리지는 실측하지 못했다 |
| 실측 결과 | 파일 33개, 테스트 311개: 통과 311, 실패 0, 스킵 0 (`pnpm exec vitest run --reporter=json`, 2026-09-13) |

### 분류 기준

테스트 파일은 `tests/` 루트(21개), `tests/unit/`(5개), `tests/integration/`(7개)에 나뉘어 있지만 디렉터리 이름이 검증 성격과 일치하지 않는다. 따라서 이 문서는 파일 위치 대신 검증 대상과 검증 방식에 따라 도메인을 정한다.

- **Unit**: 서비스·검증기·헬퍼 함수를 Prisma·Stripe·toolkit 모킹으로 검증하는 파일
- **Integration**: `createBlogSystem` 이나 온보딩 서비스처럼 여러 모듈을 조립하는 경로를 검증하는 파일
- **API**: `create*Routes` 가 반환하는 핸들러를 Request 또는 컨텍스트로 직접 호출해 상태 코드·응답 본문·서비스 위임 인자를 검증하는 파일. `tests/integration/` 의 라우트 테스트 5개도 이 도메인에 속한다
- **Security**: 테넌트 데이터 격리와 역할 인가를 목적으로 하는 파일(`tenant-proxy`, `rbac-edge-cases`, `role-middleware`)

한 파일은 한 도메인에만 속한다. 파일에 기재된 기존 ID(`BS-XX-nn`, `AS-nn`, `RBAC-nn`)는 변경하지 않았으며 [기존 ID 매핑표](#기존-id-매핑표)에서 새 SC/TC ID 와 연결한다.

---

## 시나리오 목록

| ID | 시나리오 | 유형 | 우선순위 | 상태 |
|----|---------|------|---------|------|
| SC-U-001 | 블로그 설정 해석 기본값과 경로 파생 | Unit | Medium | ✅ 완료 |
| SC-U-002 | 테넌트 생성·수정 입력 스키마 검증 | Unit | High | ✅ 완료 |
| SC-U-003 | 테넌트 서비스 CRUD·목록·설정 병합 | Unit | High | ✅ 완료 |
| SC-U-004 | 테넌트 멤버십 추가·제거·역할 변경 | Unit | High | ✅ 완료 |
| SC-U-005 | 호스트명·헤더 기반 테넌트 식별 | Unit | High | ✅ 완료 |
| SC-U-006 | 이메일·비밀번호 인증과 토큰 발급 | Unit | Critical | ✅ 완료 |
| SC-U-007 | 클라이언트 401 응답 시 토큰 갱신 후 재시도 | Unit | High | ✅ 완료 |
| SC-U-008 | Stripe 웹훅 이벤트 라우팅과 구독 상태 매핑 | Unit | High | ✅ 완료 |
| SC-U-009 | 요금제(Plan) 관리 | Unit | Medium | ✅ 완료 |
| SC-U-010 | 구독·결제 세션·사용량 한도 | Unit | High | ✅ 완료 |
| SC-U-011 | 온보딩 서비스 기본값 적용 | Unit | Medium | ✅ 완료 |
| SC-U-012 | 커스텀 도메인 등록과 DNS TXT 인증 | Unit | High | ✅ 완료 |
| SC-U-013 | AuthService 생성 시점 설정 검증과 기본값 | Unit | Medium | 🔲 계획 |
| SC-U-014 | 관리자·온보딩 React 컴포넌트 동작 | Unit | High | 🔲 계획 |
| SC-U-015 | DomainService 미검증 분기(도메인 불일치·Vercel 연동·목록) | Unit | Medium | 🔲 계획 |
| SC-U-016 | BillingService·WebhookHandler 오류 분기 | Unit | High | 🔲 계획 |
| SC-I-001 | createBlogSystem 모드별 서비스·라우트 조립 | Integration | High | ✅ 완료 |
| SC-I-002 | 온보딩 서비스 연쇄 호출 | Integration | Medium | ✅ 완료 |
| SC-I-003 | single 모드 features 조합별 조립 | Integration | Medium | 🔲 계획 |
| SC-I-004 | multi 모드 미들웨어 노출 | Integration | Medium | 🔲 계획 |
| SC-I-005 | 온보딩 부분 실패 처리 | Integration | Medium | 🔲 계획 |
| SC-A-001 | 라우트 오류 상태 코드 보존과 toolkit 위임 | API | Critical | ✅ 완료 |
| SC-A-002 | 블로그 게시글 공개·관리자 라우트 | API | High | ✅ 완료 |
| SC-A-003 | 태그 라우트 | API | Medium | ✅ 완료 |
| SC-A-004 | 댓글 라우트 IP 해시와 모더레이션 | API | High | ✅ 완료 |
| SC-A-005 | 검색 라우트 파라미터 전달과 캐시 헤더 | API | Medium | ✅ 완료 |
| SC-A-006 | 인증 라우트 | API | Critical | ✅ 완료 |
| SC-A-007 | 테넌트 관리 라우트 | API | High | ✅ 완료 |
| SC-A-008 | 슈퍼 관리자 라우트 권한과 집계 | API | High | ✅ 완료 |
| SC-A-009 | 과금 라우트 | API | High | ✅ 완료 |
| SC-A-010 | 도메인 관리 라우트 | API | Medium | ✅ 완료 |
| SC-A-011 | 자체 catch 라우트의 오류 응답 일관성 | API | Critical | 🔲 계획 |
| SC-A-012 | 멀티 테넌트 블로그 라우트 테넌트 해석 | API | Critical | 🔲 계획 |
| SC-A-013 | 슈퍼 관리자 라우트 미검증 분기 | API | High | 🔲 계획 |
| SC-A-014 | 인증 라우트 입력 검증과 OAuth 분기 | API | High | 🔲 계획 |
| SC-A-015 | 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 | API | High | 🔲 계획 |
| SC-A-016 | 태그·댓글·블로그 관리자 라우트 미검증 핸들러 | API | Medium | 🔲 계획 |
| SC-E-001 | OnboardingWizard 제출과 슈퍼 관리자 온보딩 라우트 계약 | E2E | High | 🔲 계획 |
| SC-E-002 | createAuthFetch 토큰 갱신과 refresh 라우트 계약 | E2E | Medium | 🔲 계획 |
| SC-S-001 | 테넌트 프록시 tenantId 주입 | Security | Critical | ✅ 완료 |
| SC-S-002 | 역할 계층·OWNER 보호·크로스 테넌트 격리 | Security | Critical | ✅ 완료 |
| SC-S-003 | 테넌트 역할 인가 미들웨어 | Security | Critical | ✅ 완료 |
| SC-S-004 | 테넌트 프록시가 가로채지 않는 메서드 | Security | Critical | 🔲 계획 |
| SC-S-005 | X-Tenant-Id 헤더 신뢰 범위와 해석 불일치 | Security | Critical | 🔲 계획 |
| SC-S-006 | 관리자 라우트의 테넌트 소속 검사 부재 | Security | High | 🔲 계획 |
| SC-S-007 | OAuth 콜백 계정 연결과 state 검증 | Security | High | 🔲 계획 |
| SC-S-008 | 온보딩 샘플 게시글 HTML 에 입력값 삽입 | Security | High | 🔲 계획 |
| SC-P-001 | 테넌트 프록시 모델 접근 비용 | Performance | Low | 🔲 계획 |
| SC-AC-001 | 관리자 목록·폼 입력 요소 이름과 오류 알림 | Accessibility | High | 🔲 계획 |
| SC-AC-002 | 온보딩 위저드 단계·선택 상태 전달 | Accessibility | High | 🔲 계획 |
| SC-AC-003 | 대시보드·모니터 상태 표시 | Accessibility | Medium | 🔲 계획 |
| SC-SM-001 | dist exports 서브패스 해석 | Smoke | High | 🔲 계획 |
| SC-SM-002 | 클라이언트 엔트리 지시문과 스타일 산출물 | Smoke | Medium | 🔲 계획 |

---

## 1. Unit Tests (단위 테스트)

**목적:** 팩토리 함수로 분리된 서비스·검증기·헬퍼를 외부 의존성 모킹 상태에서 독립적으로 검증한다. Prisma 는 delegate 객체를 `vi.fn` 으로 만들어 주입하고, Stripe 와 toolkit 인증 모듈은 `vi.mock` 으로 대체한다.

**실행 명령:** package.json 에는 `test`, `test:watch` 스크립트만 있으므로 도메인별 실행은 파일 목록을 인자로 지정한다. 아래 명령의 실측 결과는 16개 파일, 163개 통과이다.

```bash
pnpm exec vitest run \
  tests/config.test.ts tests/tenant-validator.test.ts tests/tenant-service.test.ts \
  tests/tenant-user-service.test.ts tests/tenant-resolver.test.ts tests/tenant-middleware.test.ts \
  tests/auth-fetch.test.ts tests/unit/auth-service.test.ts \
  tests/webhook-handler.test.ts tests/unit/webhook-handler.test.ts \
  tests/plan-service.test.ts tests/unit/plan-service.test.ts \
  tests/billing-helpers.test.ts tests/unit/billing-service.test.ts \
  tests/onboarding-service.test.ts tests/domain-service.test.ts
```

---

### TC-U-001: 블로그 설정 해석 (resolveBlogConfig)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/config.test.ts` |
| **대상** | `src/core/config.ts`: `resolveBlogConfig()` |
| **우선순위** | Medium |
| **전제조건** | 없음 (순수 함수) |
| **테스트 데이터** | `makeConfig()` 가 만드는 `{ mode: 'single', auth: { jwtSecret: 'test' }, blog: { modelName: 'news' } }`, `basePath: '/news'`, `categories: { notice: { label: '공지' } }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-CF-01: `basePath` 미지정으로 호출 | `basePath === '/blog'` |
| 2 | BS-CF-02: `basePath: '/news'` 지정 | `apiBasePath === '/api/news'` |
| 3 | BS-CF-03: `adminBasePath: '/admin/news'` 지정 | `adminApiBasePath === '/api/admin/news'` |
| 4 | BS-CF-06: `modelName` 만 지정 | `adminBasePath '/admin/blog'`, `uploadEndpoint '/api/upload'`, `pageSize 12`, `categories {}` |
| 5 | BS-CF-07: `modelName: 'blogPost'` 지정 | `modelName === 'blogPost'` |

- **자동화:** 가능 ✅ | **테스트 수:** 8개 (현재)
- **비고:** BS-CF-05·08 은 `storage` 를 지정해도 반환값이 정의된다는 점만 확인한다. `resolveBlogConfig` 반환값에는 storage 가 없으며, storage 가 BlogService 로 전달되는 경로는 TC-I-004 에서 계획한다.

---

### TC-U-002: 테넌트 입력 스키마 (CreateTenantSchema, UpdateTenantSchema)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-validator.test.ts` |
| **대상** | `src/validators/tenant.validator.ts`: `CreateTenantSchema`, `UpdateTenantSchema` |
| **우선순위** | High |
| **전제조건** | 없음 (Zod `safeParse`) |
| **테스트 데이터** | `{ name: '테스트 테넌트', slug: 'test-tenant' }`, `'a'.repeat(101)`, `'a'.repeat(63)`, `'a'.repeat(64)`, `'-test'`, `'test-'`, `'Test'`, `'te_st'`, `'not-a-cuid'`, `'a'.repeat(301)` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TV-03: name 101자 | `success: false` |
| 2 | BS-TV-04·05: slug `'ab'`, `'abc'`, 63자, 64자 | 2자·64자는 실패, 3자·63자는 통과 |
| 3 | BS-TV-06~09: slug `'-test'`, `'test-'`, `'Test'`, `'te_st'` | 모두 실패 |
| 4 | BS-TV-11: planId `'not-a-cuid'` | 실패 |
| 5 | BS-TV-12·13: `settings.seo.description` 301자, `settings.theme.logo: 'invalid-url'` | 모두 실패 |
| 6 | BS-TV-15·16: UpdateTenantSchema 에 `{}`, `{ slug: 'new-slug' }` | 모두 통과, `data.slug === 'new-slug'` |

- **자동화:** 가능 ✅ | **테스트 수:** 16개 (현재)

---

### TC-U-003: 테넌트 서비스 (createTenantService)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-service.test.ts` |
| **대상** | `src/tenant/tenant-service.ts`: `create`, `getById`, `getBySlug`, `getByCustomDomain`, `update`, `deactivate`, `listAll`, `getSettings`, `updateSettings` |
| **우선순위** | High |
| **전제조건** | `prisma.tenant` delegate(findUnique, findFirst, findMany, create, update, count)를 `vi.fn` 으로 모킹 |
| **테스트 데이터** | `baseTenant = { id: 't-1', slug: 'test', settings: {}, isActive: true }`, 기존 설정 `{ blogConfig: { existing: true }, theme: { primaryColor: '#000' }, seo: { siteName: 'Old' } }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TS-02: `findUnique` 가 기존 테넌트를 반환한 상태에서 `create` | `'이미 사용 중인 슬러그'` 예외 |
| 2 | BS-TS-03: `create` 호출 인자 확인 | `data.settings` 에 `blogConfig {}`, `theme {}`, `seo {}` 포함 |
| 3 | BS-TS-08: `update('t-1', { slug: 'new-slug' })` | `findFirst` 인자 `{ where: { slug: 'new-slug', NOT: { id: 't-1' } } }` |
| 4 | BS-TS-13: count 25, `listAll({ page: 2, limit: 10 })` | `findMany` 에 `skip 10`, `take 10`, 결과 `totalPages 3`, `total 25` |
| 5 | BS-TS-15: `updateSettings` 로 theme.logo·seo.siteName 갱신 | `blogConfig` 보존, theme 에 primaryColor·logo 모두 존재, `seo.siteName 'New'` |
| 6 | BS-TS-16: 기존 `domainVerification` 이 있는 상태에서 theme 만 갱신 | `domainVerification` 원본 유지 |

- **자동화:** 가능 ✅ | **테스트 수:** 16개 (현재)

---

### TC-U-004: 테넌트 멤버십 서비스 (createTenantUserService)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-user-service.test.ts` |
| **대상** | `src/tenant/tenant-user-service.ts`: `addUser`, `removeUser`, `updateRole`, `hasPermission`, `listUsers`, `getUserTenants`, `getUserRole` |
| **우선순위** | High |
| **전제조건** | `prisma.tenantUser` delegate 를 `vi.fn` 으로 모킹 |
| **테스트 데이터** | `TENANT_ID 't-1'`, `USER_ID 'u-1'`, `TenantRole` OWNER·ADMIN·EDITOR·VIEWER, OWNER 수 1 또는 2 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TU-02: 기존 멤버십이 있는 상태에서 `addUser` | `'이미 해당 테넌트에 소속된'` 예외 |
| 2 | BS-TU-04: OWNER 1명인 테넌트에서 그 OWNER 를 `removeUser` | `'최소 1명의 소유자'` 예외 |
| 3 | BS-TU-05: OWNER 2명 중 1명 `removeUser` | `tenantUser.delete` 호출 |
| 4 | BS-TU-07: 유일 OWNER 를 EDITOR 로 `updateRole` | `'최소 1명의 소유자'` 예외 |
| 5 | BS-TU-09: EDITOR 가 ADMIN 권한 요구 | `hasPermission` 결과 `false` |
| 6 | BS-TU-13: `getUserTenants` 가 멤버십 2건 조회 | 길이 2, 첫 항목 `role === TenantRole.OWNER` |

- **자동화:** 가능 ✅ | **테스트 수:** 14개 (현재)

---

### TC-U-005: 테넌트 식별기 (createTenantResolver)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-resolver.test.ts` |
| **대상** | `src/tenant/tenant-resolver.ts`: `resolveFromSubdomain`, `resolveFromCustomDomain`, `resolve` (비공개 `extractSubdomain` 간접 검증) |
| **우선순위** | High |
| **전제조건** | `prisma.tenant.findFirst` 모킹 |
| **테스트 데이터** | baseDomain `'blog.example.com'`, 호스트 `'my-blog.blog.example.com'`, `'my-blog.blog.example.com:3000'`, `'a.b.blog.example.com'`, `'custom.com'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TR-01: `resolveFromSubdomain('my-blog.blog.example.com', 'blog.example.com')` | `findFirst({ where: { slug: 'my-blog', isActive: true } })` |
| 2 | BS-TR-02: 호스트와 baseDomain 이 같음 | `null`, `findFirst` 미호출 |
| 3 | BS-TR-04: 호스트·baseDomain 에 `:3000` 포함 | 포트를 제거하고 `slug 'my-blog'` 로 조회 |
| 4 | BS-TR-05: `'a.b.blog.example.com'` | `null` (중첩 서브도메인 거부) |
| 5 | BS-TR-08: `resolve('custom.com', ...)` 에서 커스텀 도메인 일치 | 테넌트 반환, `findFirst` 1회 호출 |
| 6 | BS-TR-09: 커스텀 도메인·서브도메인 모두 없음 | `null` |

- **자동화:** 가능 ✅ | **테스트 수:** 9개 (현재)

---

### TC-U-006: 요청 기반 테넌트 식별 (resolveTenantFromRequest)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-middleware.test.ts` |
| **대상** | `src/tenant/tenant-middleware.ts`: `resolveTenantFromRequest`, `TENANT_ID_HEADER`, `TENANT_SLUG_HEADER` |
| **우선순위** | High |
| **전제조건** | TenantResolver 4개 메서드를 `vi.fn` 으로 모킹(기본 반환 `null`) |
| **테스트 데이터** | 헤더 `X-Tenant-Id: my-blog`, URL `http://my-blog.blog.example.com/api/test`, `http://unknown.com/api/test` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TM-01: `X-Tenant-Id: my-blog` 헤더 지정 | `resolveFromSlug('my-blog')` 호출, `{ tenantId: 't-1', tenant }` 반환 |
| 2 | BS-TM-02: 헤더 없음, 서브도메인 URL | `resolve` 호출, 결과 반환 |
| 3 | BS-TM-03: 헤더·호스트 모두 식별 실패 | `null` |
| 4 | BS-TM-04·05: 상수 확인 | `'X-Tenant-Id'`, `'X-Tenant-Slug'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 헤더 값을 슬러그로 해석한다는 점만 확인한다. 같은 헤더를 `role-middleware` 가 테넌트 ID 로 해석하는 불일치는 TC-S-005 에서 계획한다.

---

### TC-U-007: 인증 서비스 (createAuthService)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/auth-service.test.ts` |
| **대상** | `src/auth/auth-service.ts`: `register`, `login`, `refreshToken`, `getCurrentUser`, `changePassword` |
| **우선순위** | Critical |
| **전제조건** | `@withwiz/toolkit/core/auth`(JWTService, PasswordHasher, OAuthManager, TokenGenerator)와 `@withwiz/toolkit/prisma/auth-adapter` 를 클래스 모킹, `prisma.user.findUnique` 모킹 |
| **테스트 데이터** | `MOCK_USER = { id: 'user-1', email: 'test@example.com', name: 'Test User' }`, `MOCK_TOKENS`, 비밀번호 `'StrongP@ss1!'`, `'NewStr0ng!'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | AS-02: `register('test@example.com', 'StrongP@ss1!', 'Test User')` | `hash('StrongP@ss1!')`, `userRepo.create({ email, password: 'hashed-pw', name })`, `createTokenPair({ ...user, role: 'USER' })` |
| 2 | AS-05: name 미전달 | `userRepo.create` 인자 `name: null` |
| 3 | AS-08: `verify` 가 `false` | `'이메일 또는 비밀번호가 올바르지 않습니다.'` 예외 |
| 4 | AS-09: 저장된 password 가 `null` | `'비밀번호가 설정되지 않은 계정입니다.'` 예외 |
| 5 | AS-13: refresh 토큰은 유효하지만 `findById` 가 `null` | `'사용자를 찾을 수 없습니다.'` 예외 |
| 6 | AS-17: `changePassword('user-1', 'old-password', 'NewStr0ng!')` | `verify('old-password', 'old-hashed')`, `hash('NewStr0ng!')`, `update('user-1', { password: 'new-hashed' })` |

- **자동화:** 가능 ✅ | **테스트 수:** 19개 (현재)
- **비고:** `getOAuthLoginUrl`, `handleOAuthCallback` 은 AS-01 에서 함수 존재 여부만 확인하며 동작은 검증하지 않는다(TC-S-007).

---

### TC-U-008: 인증 fetch 래퍼 (createAuthFetch)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/auth-fetch.test.ts` |
| **대상** | `src/auth/auth-fetch.ts`: `createAuthFetch()` |
| **우선순위** | High |
| **전제조건** | `globalThis.fetch` 를 `vi.fn` 으로 교체하고 `afterEach` 에서 복원 |
| **테스트 데이터** | `refreshEndpoint '/api/auth/refresh'`, `loginPath '/admin/login'`, 응답 상태 200·401·500 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-AF-01: 첫 응답 200 | 그대로 반환, fetch 1회 |
| 2 | BS-AF-02: 401 → refresh 200 → 재시도 200 | 200 반환, fetch 3회 |
| 3 | BS-AF-03: 401 → refresh 401 | 원본 401 반환, fetch 2회 |
| 4 | BS-AF-04: `{ method: 'POST' }` 로 호출 | fetch 인자에 `credentials: 'same-origin'` |
| 5 | BS-AF-05: 첫 응답 500 | 그대로 반환, fetch 1회 |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 테스트 환경이 `node` 이므로 갱신 실패 시 `window.location.href` 를 설정하는 분기는 실행되지 않는다.

---

### TC-U-009: Stripe 웹훅 핸들러: 상태 매핑과 이벤트 라우팅 (루트 파일)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/webhook-handler.test.ts` (import 경로 `@withwiz/blog-system/billing`) |
| **대상** | `src/billing/webhook-handler.ts`: `createWebhookHandler().handleEvent` (비공개 `mapStripeStatus` 간접 검증) |
| **우선순위** | High |
| **전제조건** | `prisma.subscription`(findFirst, update, create) 모킹, Stripe 인스턴스는 `{}` |
| **테스트 데이터** | 구독 이벤트 `{ id: 'sub_123', customer: 'cus_123', status }`, 인보이스 이벤트 `{ subscription: 'sub_123' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-WH-02~04: `customer.subscription.created` 의 status `past_due`, `canceled`, `trialing` | update `data.status` 가 각각 `PAST_DUE`, `CANCELED`, `TRIALING` |
| 2 | BS-WH-05: status `'incomplete'` | `data.status: 'ACTIVE'` (기본값) |
| 3 | BS-WH-06: `created` 이벤트 | `findFirst` where `{ stripeCustomerId: 'cus_123' }` |
| 4 | BS-WH-07: `updated` 이벤트 | `findFirst` where `{ stripeSubscriptionId: 'sub_123' }` |
| 5 | BS-WH-10: `invoice.payment_failed` | `data.status: 'PAST_DUE'` |
| 6 | BS-WH-11: `'unknown.event'` | 예외 없이 완료 |

- **자동화:** 가능 ✅ | **테스트 수:** 11개 (현재)

---

### TC-U-010: Stripe 웹훅 핸들러: 갱신 페이로드 정확 일치 (tests/unit)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/webhook-handler.test.ts` (import 경로 `../../src/billing/webhook-handler`) |
| **대상** | `src/billing/webhook-handler.ts`: `createWebhookHandler().handleEvent` |
| **우선순위** | High |
| **전제조건** | `prisma.subscription`(findFirst, update) 모킹, 이벤트에 `id`·`object`·`api_version`·`livemode` 등 Stripe 이벤트 필드 포함 |
| **테스트 데이터** | `now = Math.floor(Date.now() / 1000)` 기준 기간, DB 레코드 `{ id: 'sub-db-1' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `customer.subscription.created` (active) | update 인자가 `{ where: { id: 'sub-db-1' }, data: { stripeSubscriptionId: 'sub_123', status: 'ACTIVE', currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd: false } }` 와 정확히 일치 |
| 2 | `customer.subscription.updated` (past_due, cancel_at_period_end true) | `data` 가 `{ status: 'PAST_DUE', currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd: true }` 와 정확히 일치 (stripeSubscriptionId 없음) |
| 3 | `customer.subscription.deleted` | `data: { status: 'CANCELED', cancelAtPeriodEnd: false }` |
| 4 | `invoice.payment_succeeded` | `data: { status: 'ACTIVE' }` |
| 5 | `'unknown.event.type'` | `resolves.toBeUndefined()`, `findFirst`·`update` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)
- **비고:** TC-U-009 와 이벤트 시나리오가 겹친다. 중복 판정은 [이중 존재 파일 판정](#이중-존재-파일-판정)에 기록한다.

---

### TC-U-011: 요금제 서비스 (루트 파일)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/plan-service.test.ts` (import 경로 `@withwiz/blog-system/billing`) |
| **대상** | `src/billing/plan-service.ts`: `createPlanService()` 의 `create`, `getById`, `listActive`, `update`, `deactivate`, `getDefault` (비공개 `mapToPlan` 간접 검증) |
| **우선순위** | Medium |
| **전제조건** | `prisma.plan` delegate 모킹 |
| **테스트 데이터** | `basePlan = { id: 'plan-1', name: 'Free', maxPosts: 10, priceMonthly: 0, stripeProductId: null, stripePriceId: null, isActive: true }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-PS-03: `findUnique` 가 `null` | `getById` 결과 `null` |
| 2 | BS-PS-04: `listActive()` | `findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } })` |
| 3 | BS-PS-05: `update('plan-1', { name: 'Pro' })` | 결과 `name === 'Pro'` |
| 4 | BS-PS-07: `getDefault()` | `findFirst` 에 활성·가격 오름차순 조건 |
| 5 | BS-PS-08·09: stripeProductId·stripePriceId 가 `null` | 결과 필드가 `undefined` |

- **자동화:** 가능 ✅ | **테스트 수:** 9개 (현재)

---

### TC-U-012: 요금제 서비스 (tests/unit)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/plan-service.test.ts` (import 경로 `../../src/billing/plan-service`) |
| **대상** | `src/billing/plan-service.ts`: `create`, `listActive`, `getDefault`, `deactivate` |
| **우선순위** | Medium |
| **전제조건** | TC-U-011 과 동일한 형태의 `prisma.plan` 모킹, `beforeEach` 에서 `vi.clearAllMocks()` |
| **테스트 데이터** | `{ name: 'Pro', maxPosts: 100, maxStorage: 5000000, maxUsers: 10, priceMonthly: 2900 }`, Free·Pro 2건 목록 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `create(Pro)` | 결과 필드 6개 일치, `plan.create({ data: { ...입력, isActive: true } })` 정확 일치 |
| 2 | `listActive()` 가 2건 조회 | 길이 2, Free·Pro 순서, `findMany` 인자 일치 |
| 3 | `getDefault()` 가 최저가 플랜 조회 | `name 'Free'`, `priceMonthly 0` |
| 4 | 활성 플랜 없음 | `getDefault()` 결과 `null` |
| 5 | `deactivate('plan-1')` | `update({ where: { id: 'plan-1' }, data: { isActive: false } })` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)

---

### TC-U-013: 과금 서비스 내부 헬퍼 (billing-helpers)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/billing-helpers.test.ts` |
| **대상** | `src/billing/billing-service.ts`: 비공개 `getMonthStart`, `getMetricMax`, `mapToSubscription`, `mapToUsageRecord` (`getUsage`, `checkLimit`, `getSubscription` 경유) |
| **우선순위** | High |
| **전제조건** | `stripe` 모듈을 클래스로 모킹, `prisma`(tenant, plan, subscription, usageRecord) 모킹 |
| **테스트 데이터** | `new Date(2025, 2, 15)`, `new Date(2025, 2, 15, 14, 30, 45)`, 플랜 `{ maxPosts: 100, maxStorage: 5000, maxUsers: 10 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-BH-01: `getUsage('t-1', 2025-03-15)` | `usageRecord.findMany({ where: { tenantId: 't-1', period: new Date(2025, 2, 1) } })` |
| 2 | BS-BH-03: 14시 30분 45초 입력 | period 의 시·분·초가 모두 0 |
| 3 | BS-BH-04: metric `posts`, 사용량 50 | `max 100`, `allowed true` |
| 4 | BS-BH-06: metric `api_calls` | `max === Number.MAX_SAFE_INTEGER` |
| 5 | BS-BH-07: metric `'unknown_metric'` | `max 0` |
| 6 | BS-BH-08: stripeSubscriptionId·stripeCustomerId 가 `null` | 결과 필드가 `undefined` |

- **자동화:** 가능 ✅ | **테스트 수:** 9개 (현재)

---

### TC-U-014: 과금 서비스 (tests/unit)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/billing-service.test.ts` (import 경로 `../../src/billing/billing-service`) |
| **대상** | `createBillingService()`: `createCustomer`, `createSubscription`, `cancelSubscription`, `changePlan`, `createCheckoutSession`, `createPortalSession`, `trackUsage`, `checkLimit` |
| **우선순위** | High |
| **전제조건** | `vi.hoisted` 로 Stripe 하위 객체(customers, subscriptions, checkout.sessions, billingPortal.sessions, webhooks) 모킹, `prisma.usageRecord.upsert` 포함 |
| **테스트 데이터** | `tenant-1`, `cus_123`, `sub_123`, `price_123`, 플랜 `{ maxPosts: 100, maxStorage: 1000000 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `createCustomer('tenant-1', 'test@example.com', 'Test User')` | `customers.create({ email, name, metadata: { tenantId } })`, `tenant.update` 에 `stripeCustomerId 'cus_123'`, 반환값 `'cus_123'` |
| 2 | `createSubscription` 에서 플랜 `stripePriceId: null` | Stripe `subscriptions.create` 미호출, DB 레코드 반환 |
| 3 | `cancelSubscription('tenant-1', true)` | `subscriptions.cancel('sub_123')`, update `data: { status: 'CANCELED', cancelAtPeriodEnd: false }` |
| 4 | 활성 구독 없음 상태에서 `cancelSubscription` | `'활성 구독이 없습니다'` 예외 |
| 5 | `trackUsage('tenant-1', 'posts', 5)` | `upsert` 1회, `findFirst`·`create`·`update` 미호출, `update: { value: { increment: 5 } }` |
| 6 | `checkLimit` 사용량 100, 한도 100 | `allowed false`, `current 100`, `max 100` |

- **자동화:** 가능 ✅ | **테스트 수:** 14개 (현재)

---

### TC-U-015: 온보딩 서비스 (createOnboardingService)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/onboarding-service.test.ts` |
| **대상** | `src/onboarding/onboarding-service.ts`: `onboardTenant()` |
| **우선순위** | Medium |
| **전제조건** | TenantService·TenantUserService·BlogService 를 `vi.fn` 객체로 모킹, `createScopedBlogService` 는 모킹 BlogService 반환 |
| **테스트 데이터** | `{ tenantName: '테스트 블로그', tenantSlug: 'test-blog', ownerUserId: 'u-1' }`, categories `[{ key: 'custom', label: '커스텀' }]`, planId `'plan-1'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-OB-01: categories 미지정 | `settings.blogConfig.categories` 에 general·notice·tech |
| 2 | BS-OB-02: 사용자 정의 카테고리 1건 | `categories.custom` 이 `{ label: '커스텀' }` |
| 3 | BS-OB-03: `createSamplePost: true`, create 가 `{ id: 'post-1' }` | `createScopedBlogService('t-1')`, `samplePostId 'post-1'` |
| 4 | BS-OB-04: 샘플 게시글 create 가 reject | tenant 반환 유지, `samplePostId` 가 `undefined` |
| 5 | BS-OB-06: 기본 입력 | `addUser('t-1', 'u-1', TenantRole.OWNER)` |
| 6 | BS-OB-07: `planId: 'plan-1'` | `tenantService.create` 인자 `planId 'plan-1'` |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)

---

### TC-U-016: 커스텀 도메인 서비스 (createDomainService)

| 항목 | 내용 |
|------|------|
| **파일** | `tests/domain-service.test.ts` |
| **대상** | `src/tenant/domain-service.ts`: `addCustomDomain`, `checkVerification`, `removeCustomDomain` (비공개 `getDomainVerificationData`, `buildVerificationResponse` 간접 검증) |
| **우선순위** | High |
| **전제조건** | `dns/promises.resolveTxt` 모킹, `crypto.randomUUID` 가 `'mock-uuid-token'` 반환, `prisma.tenant` 모킹 |
| **테스트 데이터** | `customDomain 'blog.custom.com'`, `settings.domainVerification = { token: 'mock-uuid-token', status: 'pending', sslStatus: 'pending' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-DS-01: `settings {}` 상태에서 `checkVerification` | `'도메인 인증 데이터가 없습니다'` 예외 |
| 2 | BS-DS-03: resolveTxt 가 NXDOMAIN 으로 reject | `verificationRecord = { type: 'TXT', name: '_withwiz-verify.blog.custom.com', value: 'withwiz-verify=mock-uuid-token' }` |
| 3 | BS-DS-05: 다른 테넌트가 같은 도메인 사용 | `'이미 다른 테넌트에서 사용 중인 도메인'` 예외 |
| 4 | BS-DS-06: 이미 `status: 'verified'` | 결과 verified, `resolveTxt` 미호출 |
| 5 | BS-DS-07: TXT 레코드 일치 | `status 'verified'`, `tenant.update` 호출 |
| 6 | BS-DS-09: `removeCustomDomain('t-1')` | update `data.customDomain null`, settings 에 `domainVerification` 없음 |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (현재)
- **비고:** BS-DS-10 은 Vercel 설정이 일부만 있을 때 fetch 가 호출되지 않음을 확인한다. 세 설정이 모두 있을 때의 Vercel API 호출 경로는 검증하지 않는다(TC-U-023).

---

### TC-U-017: AuthService 생성 시점 설정 검증과 기본값 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/auth-service-config.test.ts` (신규) |
| **대상** | `src/auth/auth-service.ts`: `createAuthService()` 생성 분기와 토큰 페이로드 기본값 |
| **우선순위** | Medium |
| **전제조건** | TC-U-007 과 같은 toolkit 모킹, JWTService 생성자 인자를 캡처하는 모킹 클래스 |
| **테스트 데이터** | `prisma = { account: { findUnique }, $transaction }` (user delegate 없음), `config = { jwtSecret }`, role 이 없는 사용자 레코드 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `user` delegate 가 없는 prisma, `userModelName` 미지정으로 생성 | `createAuthService: Prisma 모델 "user"을(를) 찾을 수 없습니다.` 로 시작하는 예외 |
| 2 | `userModelName: 'account'` 지정 후 `login` | `prisma.account.findUnique({ where: { id }, select: { password: true } })` 호출 |
| 3 | 만료 시간 미지정으로 생성 | JWTService 생성자 인자 `{ accessTokenExpiry: '15m', refreshTokenExpiry: '7d', algorithm: 'HS256' }` |
| 4 | `oauthProviders` 미지정 상태에서 `getOAuthLoginUrl('google')` | `'OAuth가 설정되지 않았습니다.'` 예외 |
| 5 | role 이 없는 사용자로 `refreshToken` | `createTokenPair` 인자 `role: 'USER'` |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** `BlogSystemConfig.auth` 타입(`src/types/system.ts`)에는 `userModelName` 필드가 없다. `createBlogSystem` 경유로 이 값을 지정하는 방법이 타입상 막혀 있는지 함께 확인한다.

---

### 관리자·온보딩 컴포넌트 공통 전제조건 (TC-U-018 ~ TC-U-022)

현재 저장소에는 컴포넌트를 렌더링할 인프라가 없다. 다음 준비가 선행되어야 한다.

1. devDependencies 에 jsdom(또는 happy-dom), `@testing-library/react` 를 추가한다. `react`·`react-dom` 19.3.0 은 이미 devDependencies 에 있다.
2. `vitest.config.ts` 의 `include` 는 `tests/**/*.test.ts` 로 한정되어 있으므로 `tests/**/*.test.tsx` 를 추가한다.
3. 기존 테스트는 `node` 환경을 유지하고, 컴포넌트 테스트 파일 상단에 `// @vitest-environment jsdom` 을 명시한다.
4. 컴포넌트는 모두 `fetch` 를 직접 호출하므로 `globalThis.fetch` 를 `vi.fn` 으로 교체한다.

---

### TC-U-018: SuperAdminDashboard 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/components/SuperAdminDashboard.test.tsx` (신규) |
| **대상** | `src/admin/SuperAdminDashboard.tsx` (161줄): `SuperAdminDashboard({ apiBasePath })` |
| **우선순위** | High |
| **전제조건** | 공통 전제조건 1~4 |
| **테스트 데이터** | `apiBasePath '/api'`, 응답 `{ success: true, data: { stats: { totalTenants: 5, activeTenants: 4, totalUsers: 10, totalPosts: 42 }, recentTenants: [{ id: 't-1', name: 'A', slug: 'a', isActive: false, createdAt: '2026-09-01T00:00:00.000Z' }] } }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | fetch 응답 전 렌더링 | `'데이터를 불러오는 중...'` 표시 |
| 2 | 마운트 직후 fetch 인자 확인 | `('/api/admin/dashboard', { credentials: 'include' })` |
| 3 | 성공 응답 | 통계 5·4·10·42 표시, 표 행에 `'A'`, `'a'`, `'비활성'` 배지 |
| 4 | `recentTenants: []` | `'등록된 테넌트가 없습니다.'` |
| 5 | `{ success: false, error: { message: '슈퍼 관리자 권한이 필요합니다.' } }` | 해당 문구와 `'재시도'` 버튼 표시 |
| 6 | fetch reject 후 `'재시도'` 클릭 | `'네트워크 오류가 발생했습니다.'` 표시 후 fetch 2회 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** '시스템 상태' 영역의 `'API 서버: 정상'`, `'데이터베이스: 연결됨'` 은 응답과 무관한 고정 문구이다.

---

### TC-U-019: SystemMonitor 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/components/SystemMonitor.test.tsx` (신규) |
| **대상** | `src/admin/SystemMonitor.tsx` (159줄): `SystemMonitor({ apiBasePath })` |
| **우선순위** | High |
| **전제조건** | 공통 전제조건 1~4 |
| **테스트 데이터** | `stats = { totalTenants: 4, activeTenants: 3, totalUsers: 10, totalPosts: 42 }`, `{ totalTenants: 0, activeTenants: 0 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 첫 응답 전 렌더링 | `'메트릭을 불러오는 중...'` |
| 2 | 성공 응답 | `'활성: 3 / 4'`, 사용자 10, 게시글 42 표시 |
| 3 | 진행 막대 요소의 style 확인 | `width: 75%` |
| 4 | totalTenants 0, activeTenants 0 | `width: 0%` (분모를 `Math.max(total, 1)` 로 처리) |
| 5 | 통계가 표시된 상태에서 `'새로고침'` 클릭 후 응답 대기 | 버튼 disabled, 문구 `'갱신 중...'`, 기존 통계 유지 (`loading && !metrics` 조건) |
| 6 | 새로고침 응답이 `success: false` | 오류 배너 표시, 이전 통계 유지 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-U-020: TenantManager 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/components/TenantManager.test.tsx` (신규) |
| **대상** | `src/admin/TenantManager.tsx` (377줄): 목록·상세·생성 화면 전환, 검색·상태 필터, 활성 상태 변경 |
| **우선순위** | High |
| **전제조건** | 공통 전제조건 1~4, URL 과 method 에 따라 응답을 돌려주는 fetch 모킹 |
| **테스트 데이터** | 목록 `[{ id: 't-1', name: '블로그', slug: 'blog', isActive: true }, { id: 't-2', isActive: false }]`, 상세 `{ tenant, users: [], userCount: 0 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 마운트 | `fetch('/api/admin/tenants?', { credentials: 'include' })` |
| 2 | 검색 입력에 `'abc'` 입력 | 재조회 URL 에 `search=abc` |
| 3 | 상태 select 에서 `inactive` 선택 | 재조회 URL 에 `status=inactive` |
| 4 | `'새 테넌트'` 클릭 | 생성 화면 표시, 이름·슬러그가 비어 있으면 `'생성'` 버튼 disabled |
| 5 | 이름 `'블로그'`, 슬러그 `'blog'` 입력 후 `'생성'`, 응답 success | `POST /api/admin/tenants` body `{"name":"블로그","slug":"blog"}`, 목록 화면 복귀 후 재조회 |
| 6 | `'상세'` 클릭 | `GET /api/admin/tenants/t-1`, h2 에 테넌트 이름, `'소속 사용자 (0명)'` |
| 7 | 활성 행 `'비활성화'`, 비활성 행 `'활성화'` 클릭 | `PATCH /api/admin/tenants/t-1/deactivate`, `PUT /api/admin/tenants/t-2` body `{"isActive":true}` |
| 8 | 상태 변경 응답이 `success: false` | 오류 배너 미표시 (현재 코드는 응답 본문을 읽지 않고 재조회만 수행) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 8번은 현재 동작을 기록한 것이다. 실패 응답을 사용자에게 알리지 않는 동작을 유지할지 결정이 필요하다.

---

### TC-U-021: UserManager 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/components/UserManager.test.tsx` (신규) |
| **대상** | `src/admin/UserManager.tsx` (332줄): 사용자 목록·상세, 시스템 역할 변경, 비활성화 |
| **우선순위** | High |
| **전제조건** | 공통 전제조건 1~4 |
| **테스트 데이터** | 목록 `[{ id: 'u-1', email: 'a@example.com', name: null, role: 'SUPER_ADMIN', isActive: true }]`, 상세 `{ user: { id: 'u-2', role: 'USER', isActive: true }, memberships: [] }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 마운트 | `GET /api/admin/users?` |
| 2 | 목록 응답 렌더링 | 이름 칸 `'-'`, 역할 배지 class 에 `blog-system-admin-badge-warning` |
| 3 | `'상세'` 클릭, memberships 빈 배열 | `GET /api/admin/users/u-2`, `'소속된 테넌트가 없습니다.'` |
| 4 | USER 상세에서 `'SUPER_ADMIN으로 변경'` 클릭, 응답 success | `PATCH /api/admin/users/u-2/role` body `{"role":"SUPER_ADMIN"}`, 목록과 상세 재조회 |
| 5 | 역할 변경 응답 `{ success: false, error: { message: '자신의 시스템 역할은 변경할 수 없습니다.' } }` | 오류 배너에 서버 메시지 표시 |
| 6 | `isActive: false` 사용자 상세 | `'비활성화'` 버튼 미표시 |
| 7 | `'비활성화'` 클릭, 응답 success | `PATCH /api/admin/users/u-2/deactivate`, 목록 화면 복귀 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-U-022: OnboardingWizard 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/components/OnboardingWizard.test.tsx` (신규) |
| **대상** | `src/onboarding/OnboardingWizard.tsx` (346줄): 4단계 진행, 비공개 `generateSlug`, 카테고리 선택, 제출 |
| **우선순위** | High |
| **전제조건** | 공통 전제조건 1~4, `onComplete = vi.fn()` |
| **테스트 데이터** | 이름 `'My Tech Blog'`, `'나의 블로그'`, 사용자 정의 카테고리 `{ key: 'review', label: '리뷰' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 초기 렌더링 | 1단계 `'블로그 기본 정보'`, `'다음'` disabled |
| 2 | 이름 `'My Tech Blog'` 입력 | 슬러그 `'my-tech-blog'` 자동 입력 |
| 3 | 슬러그를 `'custom'` 으로 수정한 뒤 이름 변경 | 슬러그 `'custom'` 유지 |
| 4 | 슬러그를 수정하지 않고 이름 `'나의 블로그'` 입력 | 슬러그 `'나의-블로그'` (generateSlug 가 한글을 허용) |
| 5 | 2단계에서 기본 선택 `'일반'`, `'공지사항'` 을 모두 해제 | `'다음'` disabled |
| 6 | 사용자 정의 키·표시 이름 입력 후 `'추가'` | 선택 목록에 추가, 두 입력 초기화 |
| 7 | 4단계에서 `'블로그 생성'` 클릭 | `POST /api/admin/onboarding` body 에 `tenantName`, `tenantSlug`, `ownerUserId: ''`, `categories`, `createSamplePost: true` |
| 8 | 응답 success 와 실패를 각각 반환 | 성공 시 `onComplete(data.data)` 1회 호출, 실패 시 오류 배너 표시와 `onComplete` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 4번 슬러그는 `CreateTenantSchema` 의 슬러그 규칙(영소문자·숫자·하이픈)을 통과하지 못한다. 슈퍼 관리자 온보딩 라우트와 `tenantService.create` 는 스키마 검증을 수행하지 않으므로 이 값이 그대로 저장될 수 있다. 7번 `ownerUserId: ''` 가 라우트에서 거부되는 문제는 TC-E-001 에서 다룬다.

---

### TC-U-023: DomainService 미검증 분기 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/domain-service-branches.test.ts` (신규) |
| **대상** | `src/tenant/domain-service.ts`: `checkVerification` 도메인 불일치, Vercel 연동(`addVercelDomain`, `removeVercelDomain`), `verifyDomain`, `listCustomDomains` |
| **우선순위** | Medium |
| **전제조건** | TC-U-016 과 같은 dns·crypto 모킹, `globalThis.fetch` 를 `vi.fn` 으로 교체, `console.warn` spy |
| **테스트 데이터** | `vercelTeamId 'team-1'`, `vercelProjectId 'prj-1'`, `vercelApiToken 'tok'`, 도메인 `'new.custom.com'`, `'old.com'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `tenant.customDomain 'a.com'` 상태에서 `checkVerification('t-1', 'b.com')` | `'테넌트에 등록된 도메인이 아닙니다: b.com'` 예외 |
| 2 | Vercel 설정 3개 지정 후 `addCustomDomain('t-1', 'new.custom.com')` | `fetch('https://api.vercel.com/v10/projects/prj-1/domains?teamId=team-1', { method: 'POST', headers.Authorization: 'Bearer tok', body: '{"name":"new.custom.com"}' })` |
| 3 | Vercel 응답 `ok: false` | `console.warn` 호출, `addCustomDomain` 은 정상 반환 |
| 4 | Vercel 설정 3개와 TXT 일치 | `status 'verified'`, `sslStatus 'active'` (설정이 없으면 `'pending'`) |
| 5 | `verifyDomain` | checkVerification 결과가 verified 이면 `true`, pending 이면 `false` |
| 6 | `listCustomDomains({ page: 2, limit: 10 })`, count 11, domainVerification 없는 테넌트 | `findMany` 에 `skip 10`, 항목 `status 'pending'`, `createdAt` 이 tenant.createdAt, `totalPages 2` |
| 7 | Vercel 설정과 `customDomain 'old.com'` 상태에서 `removeCustomDomain` | `DELETE https://api.vercel.com/v10/projects/prj-1/domains/old.com?teamId=team-1` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-U-024: BillingService·WebhookHandler 오류 분기 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/billing-service-errors.test.ts` (신규) |
| **대상** | `src/billing/billing-service.ts`: `createSubscription`, `createCheckoutSession`, `changePlan`, `handleWebhook` / `src/billing/webhook-handler.ts`: 조기 반환 분기 |
| **우선순위** | High |
| **전제조건** | TC-U-014 와 같은 `vi.hoisted` Stripe 모킹, 3번은 `vi.useFakeTimers()` 로 현재 시각 고정 |
| **테스트 데이터** | planId `'plan-x'`, tenantId `'tenant-1'`, webhookSecret `'whsec_xxx'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `plan.findUnique` 가 `null` 인 상태에서 `createSubscription` | `'플랜을 찾을 수 없습니다: plan-x'` 예외 |
| 2 | `tenant.stripeCustomerId` 가 없음 | `'Stripe 고객이 아직 생성되지 않았습니다'` 예외 |
| 3 | 플랜 `stripePriceId` 없음, 현재 시각 고정 | `subscription.create` 의 `currentPeriodEnd` 가 `currentPeriodStart` 에서 1개월 뒤 |
| 4 | `createCheckoutSession` 에서 플랜 `stripePriceId` 없음 | `'Stripe 가격이 설정되지 않은 플랜입니다'` 예외 |
| 5 | `checkout.sessions.create` 가 `{ url: null }` 반환 | `'체크아웃 세션 URL 생성 실패'` 예외 |
| 6 | `handleWebhook('payload', 'sig')` | `webhooks.constructEvent('payload', 'sig', 'whsec_xxx')` 호출, constructEvent 가 throw 하면 예외 전파 |
| 7 | `changePlan` 에서 `retrieve` 결과 `items.data: []` | Stripe `subscriptions.update` 미호출, DB update `data: { planId, cancelAtPeriodEnd: false }` |
| 8 | `customer.subscription.created` 에서 DB 레코드 없음, `invoice.payment_failed` 에서 `subscription: null` | 두 경우 모두 `subscription.update` 미호출 (인보이스는 `findFirst` 도 미호출) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

## 2. Integration Tests (통합 테스트)

**목적:** 여러 모듈을 조립하는 경로를 검증한다. `createBlogSystem` 이 모드와 설정에 따라 어떤 서비스·라우트·미들웨어를 만드는지, 온보딩 서비스가 테넌트·멤버십·게시글 서비스를 어떤 순서와 인자로 호출하는지를 확인한다. blog-core 서비스 팩토리와 Stripe, toolkit 인증 모듈은 모킹한다.

**실행 명령:** 아래 명령의 실측 결과는 3개 파일, 15개 통과이다.

```bash
pnpm exec vitest run \
  tests/blog-system-factory.test.ts \
  tests/integration/blog-system-modes.test.ts \
  tests/integration/onboarding-flow.test.ts
```

---

### TC-I-001: createBlogSystem 팩토리

| 항목 | 내용 |
|------|------|
| **파일** | `tests/blog-system-factory.test.ts` |
| **대상** | `src/core/blog-system.ts`: `createBlogSystem()` |
| **우선순위** | High |
| **전제조건** | `@withwiz/blog-core/services`, `@withwiz/toolkit/core/auth`, `@withwiz/toolkit/prisma/auth-adapter`, toolkit wrappers·api-helpers, `@withwiz/blog-core/validators`, `stripe` 모킹. tenant·tenantUser·user·news·subscription·plan·usageRecord delegate 를 가진 mock prisma |
| **테스트 데이터** | `auth.jwtSecret` 32자 이상, `blog.modelName 'news'`, `domain.baseDomain 'blog.example.com'`, `billing = { stripeSecretKey, stripeWebhookSecret, plans: [] }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-BF-01: `mode: 'single'` | `blogService` 존재, `tenantService` null |
| 2 | BS-BF-02: `mode: 'single'` | `routes.blog` 존재, `routes.tenant` null |
| 3 | BS-BF-03: `mode: 'multi'` + domain | `tenantService`, `tenantUserService`, `onboardingService` 존재 |
| 4 | BS-BF-04: multi, billing 미지정 | `billingService`, `planService` null |
| 5 | BS-BF-06: multi, domain 미지정 | `domainService` null |
| 6 | BS-BF-07: `createScopedBlogService('tenant-123')` | 정의된 값 반환 |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)

---

### TC-I-002: 모드별 서비스·라우트 조립

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/blog-system-modes.test.ts` |
| **대상** | `src/core/blog-system.ts`: `createBlogSystem()` 반환값의 `routes`, 서비스, `createScopedBlogService` |
| **우선순위** | High |
| **전제조건** | TC-I-001 과 같은 모킹 구성 |
| **테스트 데이터** | TC-I-001 과 같음, 스코프 테넌트 `'tenant-abc'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-SM-01: single 모드 | `routes.blog`·`routes.auth` 존재, `routes.tenant`·`billing`·`domain` null |
| 2 | BS-SM-02: multi + domain | `routes.blog`·`auth`·`tenant`·`admin` 존재, `blogService` null, `createScopedBlogService` 존재 |
| 3 | BS-SM-03: multi + billing | `billingService`, `planService`, `routes.billing` 존재 |
| 4 | BS-SM-04: `createScopedBlogService('tenant-abc')` | 반환 서비스에 `create`, `listPublished` 함수 존재 |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)
- **비고:** blog-core 서비스 팩토리가 모킹되어 있어, `createScopedBlogService` 가 `createTenantProxy` 로 감싼 Prisma 를 `createBlogService` 에 전달하는지는 단언하지 않는다.

---

### TC-I-003: 온보딩 연쇄 호출

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/onboarding-flow.test.ts` |
| **대상** | `src/onboarding/onboarding-service.ts`: `onboardTenant()` 가 TenantService → TenantUserService → 스코프 BlogService 를 호출하는 순서와 인자 |
| **우선순위** | Medium |
| **전제조건** | `tenantService.create` 는 입력을 반영한 `{ id: 't-new' }` 반환, `addUser` 는 전달 인자를 반영한 멤버십 반환 |
| **테스트 데이터** | ownerUserId `'u-owner'`, 카테고리 `[{ key: 'recipe', label: '레시피' }, { key: 'review', label: '리뷰' }]` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-OB-01: `createSamplePost: true` | `tenantService.create` 에 name·slug, `addUser('t-new', 'u-owner', OWNER)`, `createScopedBlogService('t-new')`, `samplePostId 'post-sample'` |
| 2 | BS-OB-02: `createSamplePost: false` | `samplePostId` 가 `undefined`, `blogService.create` 미호출 |
| 3 | BS-OB-03: 사용자 정의 카테고리 2건 | `settings.blogConfig.categories.recipe` 가 `{ label: '레시피' }` |
| 4 | BS-OB-04: categories 미지정 | general·notice·tech 정의 |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)

---

### TC-I-004: single 모드 features 조합별 조립 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/blog-system-features.test.ts` (신규) |
| **대상** | `src/core/blog-system.ts`: `features` 분기, 비공개 `inferTableName`, `blogServiceConfig` 전달 |
| **우선순위** | Medium |
| **전제조건** | TC-I-001 모킹에 더해 `@withwiz/blog-core/routes` 의 `createSchedulerRoutes` 모킹, blog-core 팩토리 호출 인자 캡처 |
| **테스트 데이터** | `features` 조합, `storage = { deleteKeys, collectKeysFromHtml }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | single, `features` 미지정 | `routes.tag`·`routes.search` 존재, `routes.comment`·`routes.scheduler` null |
| 2 | `features.tags: false` | `tagService`, `routes.tag` null |
| 3 | `features.comments: { enabled: true, requireLogin: true, maxDepth: 3 }` | `createCommentService` 두 번째 인자에 `requireLogin: true`, `maxDepth: 3`, `routes.comment` 존재 |
| 4 | `features.scheduler: { enabled: true, cronSecret: 's' }` | `createSchedulerRoutes` 두 번째 인자 `{ cronSecret: 's' }` |
| 5 | `blog.modelName: 'blogPost'` | `createSearchService` 두 번째 인자 `{ postModelName: 'blogPost', tableName: 'blog_post' }` |
| 6 | multi 모드 + `features.comments.enabled: true` | `routes.comment`·`tag`·`search`·`scheduler` 모두 null |
| 7 | `storage` 지정 | `createBlogService` 두 번째 인자 `storage` 가 같은 객체 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-I-005: multi 모드 미들웨어 노출 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/blog-system-middleware.test.ts` (신규) |
| **대상** | `src/core/blog-system.ts`: 반환값 `middleware.resolveTenantFromRequest`, `middleware.requireTenantRole` |
| **우선순위** | Medium |
| **전제조건** | TC-I-001 모킹 구성, 실제 `createTenantResolver`·`createTenantUserService` 가 mock prisma 를 사용 |
| **테스트 데이터** | 요청 `http://my-blog.blog.example.com/`, `http://my-blog.localhost/`, 미들웨어 컨텍스트 `{ user: { id: 'u-1' }, 헤더 X-Tenant-Id: 't-1' }`, `tenantUser.findUnique` 가 `{ role: 'VIEWER' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `domain.baseDomain: 'blog.example.com'`, `resolveTenantFromRequest(req)` | `tenant.findFirst` 두 번째 호출이 `{ where: { slug: 'my-blog', isActive: true } }` |
| 2 | 같은 요청에 두 번째 인자 `'other.com'` 지정 | 서브도메인 추출 실패로 slug 조회 없음 |
| 3 | domain 미지정, `http://my-blog.localhost/` | baseDomain `'localhost'` 로 `slug 'my-blog'` 조회 |
| 4 | `requireTenantRole(TenantRole.EDITOR)` 미들웨어, 사용자 역할 VIEWER | 403 응답 |
| 5 | single 모드 | `middleware.resolveTenantFromRequest`, `requireTenantRole` null |
| 6 | 두 모드 공통 | `middleware.auth`, `adminAuth`, `tenantResolver` null |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-I-006: 온보딩 부분 실패 처리 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/onboarding-partial-failure.test.ts` (신규) |
| **대상** | `src/onboarding/onboarding-service.ts`: 단계별 실패 시 반환·전파 동작 |
| **우선순위** | Medium |
| **전제조건** | TC-I-003 과 같은 서비스 모킹 |
| **테스트 데이터** | `addUser` reject(`'이미 해당 테넌트에 소속된 사용자입니다.'`), `categories: []` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `tenantService.create` 성공 후 `addUser` reject | `onboardTenant` reject, `tenantService.create` 1회 호출, `deactivate` 등 보상 호출 없음 (생성된 테넌트가 남음) |
| 2 | `createSamplePost: true`, `createScopedBlogService` 가 동기 예외 | 예외를 무시하고 `tenant`·`tenantUser` 반환, `samplePostId` 가 `undefined` |
| 3 | `categories: []` | `settings.blogConfig.categories` 가 `{}` (빈 배열은 기본 카테고리로 대체되지 않음), 샘플 게시글 `category 'general'` |
| 4 | `tenantService.create` reject | `addUser` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 1번은 트랜잭션이 없는 현재 동작을 기록한 것이다. 고아 테넌트를 허용할지 결정이 필요하다.

---

## 3. API Tests (라우트 핸들러 계약 테스트)

**목적:** 라우트 팩토리가 반환하는 핸들러를 Request 또는 `IApiContext` 로 직접 호출하여 상태 코드, 응답 본문, 서비스 위임 인자를 검증한다. 모든 파일에서 toolkit 의 `withPublicApi`·`withAdminApi` 가 통과형으로 모킹되므로, toolkit 의 인증·오류 처리 미들웨어 자체는 이 도메인의 범위 밖이다.

라우트는 오류를 처리하는 방식에 따라 두 부류로 나뉜다.

```
[A] blog · tag · comment · search 라우트 (withPublicRoute / withAdminRoute)
서비스 예외
  → withRouteErrorHandling (src/routes/route-error.ts)
      ├─ getErrorStatus(error) 가 400~599 정수  → toErrorResponse
      │     → { success: false, error: { code?, message } } + 해당 상태 코드
      └─ 상태 코드 없음                        → 원본 예외를 그대로 다시 던짐
  → toolkit withPublicApi / withAdminApi 의 오류 처리 미들웨어가 분류 (이 패키지 테스트 범위 밖)

[B] auth · tenant · billing · domain · admin 라우트 (withPublicApi / withAdminApi 직접 사용)
서비스 예외
  → 핸들러 내부 try/catch 가 400·401·404 등 고정 상태 코드와 error.message 로 응답
  → catch 가 없는 핸들러는 예외를 그대로 전파
  (admin onboarding.create 만 isBlogErrorLike 로 BlogError 상태 코드를 보존)
```

**실행 명령:** 아래 명령의 실측 결과는 11개 파일, 91개 통과이다.

```bash
pnpm exec vitest run \
  tests/route-error.test.ts tests/route-helpers.test.ts tests/tag-routes.test.ts \
  tests/comment-routes.test.ts tests/search-routes.test.ts tests/admin-routes.test.ts \
  tests/integration/auth-routes.test.ts tests/integration/billing-routes.test.ts \
  tests/integration/blog-routes.test.ts tests/integration/domain-routes.test.ts \
  tests/integration/tenant-routes.test.ts
```

---

### TC-A-001: BlogError 상태 코드·오류 코드 보존

| 항목 | 내용 |
|------|------|
| **파일** | `tests/route-error.test.ts` (BS-ERR-01~05, BS-ERR-10) |
| **대상** | `src/routes/route-error.ts`: `withRouteErrorHandling`, `toErrorResponse` (tag·comment 라우트 경유) |
| **우선순위** | Critical |
| **전제조건** | wrappers 통과형 모킹, api-helpers 모킹, `console.error` spy |
| **테스트 데이터** | `BlogError(TAG_DUPLICATE_SLUG, …, 409)`, `BlogError(COMMENT_RATE_LIMIT_EXCEEDED, …, 429)`, 상태 코드를 생략한 `BlogError(COMMENT_HONEYPOT_TRIGGERED, …)`, `name 'BlogError'` 인 복제 클래스 `DuplicatedBlogError`, `Error + { code: FORBIDDEN, status: 403 }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-ERR-01: `tagService.create` 가 409 BlogError, `admin.list.POST` | 409, `success false`, `error.code TAG_DUPLICATE_SLUG` |
| 2 | BS-ERR-02: `commentService.create` 가 429 BlogError, `public.create.POST` | 429, `error.code COMMENT_RATE_LIMIT_EXCEEDED` |
| 3 | BS-ERR-03: statusCode 를 생략한 BlogError | 400, `error.code COMMENT_HONEYPOT_TRIGGERED` |
| 4 | BS-ERR-04: `instanceof BlogError` 가 false 인 복제 클래스 | 409, 오류 코드 보존 |
| 5 | BS-ERR-05: `statusCode` 없이 `status: 403` 만 가진 예외 | 403, `error.code FORBIDDEN` |
| 6 | BS-ERR-10: 서비스 정상 응답 | 201, `success true`, `console.error` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)

---

### TC-A-002: 상태 코드가 없는 예외의 toolkit 위임

| 항목 | 내용 |
|------|------|
| **파일** | `tests/route-error.test.ts` (BS-ERR-06~09, BS-ERR-14) |
| **대상** | `src/routes/route-error.ts`: `withRouteErrorHandling` 의 재던짐 분기 (tag·comment·search 라우트 경유) |
| **우선순위** | Critical |
| **전제조건** | TC-A-001 과 같음 |
| **테스트 데이터** | `INTERNAL_MARKER = 'connect ECONNREFUSED 10.0.0.7:5432 (db-password=hunter2)'`, `Error + { code: 'ECONNREFUSED' }`, `name 'PrismaClientValidationError'` 인 Error, `name 'PrismaClientKnownRequestError', code 'P2002'` 인 Error |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-ERR-06: tag `admin.list.POST` 에서 일반 Error | `rejects.toBe(같은 객체)`, `console.error` 미호출 |
| 2 | BS-ERR-07: comment `public.create.POST` 에서 일반 Error | 400 으로 정규화하지 않고 같은 객체로 reject |
| 3 | BS-ERR-08: `search.GET` 에서 일반 Error | 같은 객체로 reject |
| 4 | BS-ERR-09: `code` 만 있고 status 가 없는 시스템 오류 | 같은 객체로 reject |
| 5 | BS-ERR-14: Prisma 형태 오류 2종 | 각각 같은 객체로 reject (감싸거나 복제하지 않음) |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **명세 변경 이력:** 2026-09-13 커밋 `52d72e1` 이전(0.2.1)에는 래퍼가 상태 코드 없는 예외를 직접 500 과 일반 메시지로 응답했고, BS-ERR-06~09 는 500 응답과 내부 메시지(`hunter2`, `ECONNREFUSED`) 미노출을 단언했다. 현재 명세는 원본 재던짐을 단언하며, 내부 정보 은닉은 toolkit 오류 처리 미들웨어의 책임으로 옮겨졌다. BS-ERR-14 는 같은 커밋에서 추가되었다.
- **비고:** toolkit 이 재던져진 예외를 실제로 어떤 상태 코드로 분류하는지(P2002 → 409 등)는 이 파일이 검증하지 않는다. 커밋 `52d72e1` 메시지는 toolkit 0.15.0 의 분류를 근거로 들지만, 이 저장소의 devDependency 설치본은 `@withwiz/toolkit` 0.13.0 이다.

---

### TC-A-003: BlogError 구조 판별과 상태 코드 범위

| 항목 | 내용 |
|------|------|
| **파일** | `tests/route-error.test.ts` (BS-ERR-11~13) |
| **대상** | `src/routes/route-error.ts`: `isBlogErrorLike`, `toErrorResponse` (직접 호출) |
| **우선순위** | Critical |
| **전제조건** | `console.error` spy |
| **테스트 데이터** | `BlogError(TAG_NOT_FOUND, …, 404)`, `{ code: 'X', status: 409 }`, `new Error('boom')`, `{ code: 'ENOENT' }`, `{ status: 409 }`, `null`, `'409'`, status `200`·`302`·`999`·`409.5`·`NaN` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-ERR-11: BlogError 404, `{ code: 'X', status: 409 }` | `isBlogErrorLike` 결과 `true` |
| 2 | BS-ERR-12: code 또는 status 가 없는 값 5종 | 모두 `false` |
| 3 | BS-ERR-13: status 가 200·302·999·409.5·NaN | `isBlogErrorLike` 결과 `false`, `toErrorResponse` 응답 500 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)
- **비고:** `withRouteErrorHandling` 은 `getErrorStatus` 만으로 분기하므로 `{ status: 409 }` 처럼 code 가 없는 예외도 409 응답으로 변환된다. 이 조합을 래퍼 경유로 단언하는 테스트는 없다.

---

### TC-A-004: 블로그 게시글 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/blog-routes.test.ts` |
| **대상** | `src/routes/blog-routes.ts`: `createBlogRoutes(blogService, { pageSize: 12 })` (단일 테넌트 구성, `multiTenantConfig` 미지정) |
| **우선순위** | High |
| **전제조건** | wrappers 가 Request 로부터 컨텍스트를 만드는 모킹(관리자 user role ADMIN), `parsePagination`·`getSearchParam` 이 실제 URL 을 파싱하는 모킹, blog-core validators 모킹(title·slug 가 없으면 실패) |
| **테스트 데이터** | slug `'not-found'` 는 `null`, slug `'duplicate'` 는 사용 불가, `getDashboardStats = { total: 10, published: 7, unpublished: 3, byCategory: { news: 5, tech: 3, etc: 2 } }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-BR-01: `GET /api/blog?page=1&limit=12` | 200, items 1건, `listPublished` 인자에 `page 1`, `limit 12` |
| 2 | BS-BR-05: `public.detail.GET` slug `'not-found'` | 404 |
| 3 | BS-BR-09: `admin.list.POST` body `{}` | 400, `success false` |
| 4 | BS-BR-11: `admin.bulk.PATCH` ids 3개, `published: true` | 200, `data.count 3` |
| 5 | BS-BR-12: `slugCheck.GET` `?slug=new-slug`, `?slug=duplicate` | `available` 이 각각 `true`, `false` |
| 6 | BS-BR-13: `dashboard.GET` | `total 10`, `published 7`, `draft 3`, `categories` 정의 |

- **자동화:** 가능 ✅ | **테스트 수:** 13개 (현재)

---

### TC-A-005: 블로그 라우트 내부 헬퍼

| 항목 | 내용 |
|------|------|
| **파일** | `tests/route-helpers.test.ts` |
| **대상** | `src/routes/blog-routes.ts`: 비공개 `parseSortKey`, `validateIds`, `validateAndParse` (`admin.list` 의 GET·DELETE·POST 경유) |
| **우선순위** | High |
| **전제조건** | wrappers 통과형(컨텍스트 직접 전달), `getSearchParam` 은 `null` 반환, validators `safeParse` 는 기본 성공 |
| **테스트 데이터** | `sortBy=createdAt`, `sortBy=invalid`, ids `['id-1', 'id-2']`, `[]`, `null`, `'not-array'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-RH-01: `?sortBy=createdAt` | `listAll` 인자 `sortBy 'createdAt'` |
| 2 | BS-RH-02: `?sortBy=invalid` | `sortBy 'updatedAt'` (기본값) |
| 3 | BS-RH-05: DELETE `ids: []` | 400 |
| 4 | BS-RH-07: DELETE `ids: 'not-array'` | 400 |
| 5 | BS-RH-09: `safeParse` 가 1회 실패 반환 | 400 |

- **자동화:** 가능 ✅ | **테스트 수:** 9개 (현재)

---

### TC-A-006: 태그 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tag-routes.test.ts` |
| **대상** | `src/routes/tag-routes.ts`: `createTagRoutes()` |
| **우선순위** | Medium |
| **전제조건** | wrappers 통과형, `parsePagination` 은 `{ page: 1, limit: 20 }` 반환 |
| **테스트 데이터** | `{ slug: 'news', name: '뉴스' }`, params `{ slug: 'news' }`, `{ id: 't-1' }`, `{ postId: 'p-1' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TR-01: `public.list.GET` | `listAll` 호출, `success true` |
| 2 | BS-TR-03: `public.posts.GET` params slug `'news'` | 200, `getPostsByTag('news', 객체)` |
| 3 | BS-TR-04: `admin.list.POST` 유효 body | 201, `create({ slug: 'news', name: '뉴스', description: undefined })` |
| 4 | BS-TR-05: slug 누락 | 400, `create` 미호출 |
| 5 | BS-TR-06: `admin.detail.DELETE` id `'t-1'` | 204, `remove('t-1')` |

- **자동화:** 가능 ✅ | **테스트 수:** 7개 (현재)

---

### TC-A-007: 댓글 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/comment-routes.test.ts` |
| **대상** | `src/routes/comment-routes.ts`: `createCommentRoutes`, `extractClientIp`, `hashIp` |
| **우선순위** | High |
| **전제조건** | wrappers 통과형, `getSearchParam` 이 실제 URL 파싱, `hmacSecret: 'test-secret'` |
| **테스트 데이터** | `cf-connecting-ip: 1.2.3.4`, `x-real-ip: 5.6.7.8`, `x-forwarded-for: 9.9.9.9, 10.10.10.10`, `cf-connecting-ip: 203.0.113.1` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-CR-01: 세 IP 헤더를 모두 지정 | `'1.2.3.4'` (CF-Connecting-IP 우선) |
| 2 | BS-CR-03: `hashIp` 를 같은 secret 으로 2회, 다른 secret 으로 1회 | 같은 secret 결과는 동일, 다른 secret 결과는 상이, `/^[a-f0-9]{64}$/` 형식 |
| 3 | BS-CR-04: `public.list.GET` 에 postId 없음 | 400 |
| 4 | BS-CR-06: `public.create.POST` 에 CF 헤더 | 201, `create` 두 번째 인자 `ipHash` 가 64자 hex, `userId` 가 `undefined` |
| 5 | BS-CR-07: content 누락 | 400, `create` 미호출 |
| 6 | BS-CR-09: `admin.bulkUpdateStatus.PATCH` 에 status `'INVALID'` | 400, 서비스 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (현재)

---

### TC-A-008: 검색 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/search-routes.test.ts` |
| **대상** | `src/routes/search-routes.ts`: `createSearchRoutes()` |
| **우선순위** | Medium |
| **전제조건** | `parsePagination` 이 page·limit 쿼리를 파싱하는 모킹 |
| **테스트 데이터** | `?q=hello`, `?q=hello&page=2&limit=5&category=news&highlight=1` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-SR-01: `?q=hello` | `search` 인자에 `query 'hello'`, `highlight false`, items 1건 |
| 2 | BS-SR-02: q 없음 | `query ''` 로 `search` 호출 |
| 3 | BS-SR-03: 전체 파라미터 지정 | `search({ query: 'hello', page: 2, limit: 5, category: 'news', highlight: true })` 정확 일치 |
| 4 | BS-SR-04: 응답 헤더 확인 | `cache-control` 에 `s-maxage=60` |

- **자동화:** 가능 ✅ | **테스트 수:** 4개 (현재)

---

### TC-A-009: 인증 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/auth-routes.test.ts` |
| **대상** | `src/routes/auth-routes.ts`: `register`, `login`, `refresh`, `logout`, `me`, `changePassword` |
| **우선순위** | Critical |
| **전제조건** | `withPublicApi` 는 user 없는 컨텍스트, `withAdminApi` 는 `{ id: 'test-user', role: 'ADMIN', email: 'user@test.com' }` 컨텍스트를 Request 로부터 생성, AuthService 모킹(email `'duplicate@test.com'`, password `'wrong'` 이면 예외) |
| **테스트 데이터** | `{ email: 'new@test.com', password: 'password123' }`, `{ refreshToken: 'rt-xxx' }`, `{ currentPassword: 'current123', newPassword: 'newpass12345' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-AU-01: 유효한 회원가입 | 201, `tokens.accessToken` 정의 |
| 2 | BS-AU-02: 중복 이메일 | 400, `error.message` 에 `'이미 등록된'` 포함 |
| 3 | BS-AU-04: 비밀번호 `'wrong'` 로그인 | 401, `success false` |
| 4 | BS-AU-05: refresh | 200, `tokens.accessToken 'new-at-xxx'` |
| 5 | BS-AU-07: `me.GET` | `user.id 'test-user'`, `email 'user@test.com'` (컨텍스트 사용자 기준) |
| 6 | BS-AU-08: `changePassword.POST` | 200, 메시지에 `'변경'` 포함 |

- **자동화:** 가능 ✅ | **테스트 수:** 8개 (현재)
- **비고:** 입력 누락 400, refresh 실패 401, OAuth 라우트는 검증하지 않는다(TC-A-017).

---

### TC-A-010: 테넌트 관리 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/tenant-routes.test.ts` |
| **대상** | `src/routes/tenant-routes.ts`: `createTenantRoutes()` (CreateTenantSchema 검증 포함) |
| **우선순위** | High |
| **전제조건** | `withAdminApi` 가 role `'SUPER_ADMIN'` 컨텍스트 생성, `tenantService.create` 는 slug `'duplicate'` 이면 Error |
| **테스트 데이터** | `{ name: '새 테넌트', slug: 'new-tenant' }`, `{ userId: 'u-2', role: EDITOR }`, `{ userId: 'u-2', role: ADMIN }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TR-02: `create.POST` 유효 body | 201, `data.slug 'new-tenant'` |
| 2 | BS-TR-03: slug `'duplicate'` | 400 |
| 3 | BS-TR-05: `deactivate.PATCH` | 200, 메시지에 `'비활성화'`, `deactivate('t-1')` |
| 4 | BS-TR-07: `settings.PUT` | 200 |
| 5 | BS-TR-08: `users.add.POST` | 201, `data.role EDITOR` |
| 6 | BS-TR-10: `users.remove.DELETE` | 200, 메시지에 `'제거'` |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (현재)
- **비고:** 모킹 컨텍스트의 역할이 SUPER_ADMIN 이지만 `createTenantRoutes` 는 역할을 검사하지 않으므로 이 값은 결과에 영향을 주지 않는다(TC-S-006).

---

### TC-A-011: 슈퍼 관리자 라우트 권한과 집계

| 항목 | 내용 |
|------|------|
| **파일** | `tests/admin-routes.test.ts` |
| **대상** | `src/routes/admin-routes.ts`: `dashboard.GET`, `users.list.GET` (비공개 `verifySuperAdmin`, `safeCount` 간접 검증) |
| **우선순위** | High |
| **전제조건** | `withAdminApi` 통과형, `parsePagination` 은 `{ page: 1, limit: 10 }`, prisma(tenant, user, news) delegate 모킹 |
| **테스트 데이터** | `news.count 42`, `tenant.count 5`, `user.count 10` 또는 `25` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-AR-01: role `SUPER_ADMIN` | `success true` |
| 2 | BS-AR-02: role `'USER'` | 403 |
| 3 | BS-AR-03: user 없음 | 403 |
| 4 | BS-AR-04: `news.count` 42 | `stats.totalPosts 42` |
| 5 | BS-AR-05: `prisma.news` 가 `undefined` | `stats.totalPosts 0` |
| 6 | BS-AR-06: `users.list.GET`, count 25 | `data` 가 `{ page: 1, limit: 10, total: 25, totalPages: 3 }` 포함, `data.pagination` 없음 |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (현재)

---

### TC-A-012: 과금 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/billing-routes.test.ts` |
| **대상** | `src/routes/billing-routes.ts`: `plans.GET`, `checkout.POST`, `subscription.GET`, `usage.GET`, `webhook.POST` |
| **우선순위** | High |
| **전제조건** | wrappers 가 Request 로부터 컨텍스트 생성, BillingService·PlanService 모킹 |
| **테스트 데이터** | 활성 플랜 2건, checkout body `{ tenantId, planId, successUrl, cancelUrl }`, 헤더 `stripe-signature: sig_test_xxx` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-BI-01: `plans.GET` | 200, data 2건 |
| 2 | BS-BI-02: `checkout.POST` | 200, `data.url` 에 `'stripe.com'` 포함 |
| 3 | BS-BI-03: `subscription.GET ?tenantId=t-1` | 200, `data.status 'active'` |
| 4 | BS-BI-04: `usage.GET ?tenantId=t-1` | 200, `data.posts 42` |
| 5 | BS-BI-05: 서명 헤더를 포함한 `webhook.POST` | 200, `data.received true`, `handleWebhook` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 모킹 반환값은 숫자이다. 참조 스키마의 BigInt 필드가 응답 직렬화에 주는 영향은 TC-A-018 에서 계획한다.

---

### TC-A-013: 도메인 관리 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/domain-routes.test.ts` |
| **대상** | `src/routes/domain-routes.ts`: `add.POST`, `verify.POST`, `remove.DELETE`, `list.GET` |
| **우선순위** | Medium |
| **전제조건** | `withAdminApi` 가 Request 로부터 관리자 컨텍스트 생성, DomainService 모킹 |
| **테스트 데이터** | `{ tenantId: 't-1', domain: 'blog.example.com' }`, `'invalid domain!!!'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-DR-01: `add.POST` 유효 body | 201, `verificationRecord.type 'CNAME'` (모킹 반환값) |
| 2 | BS-DR-02: 도메인 `'invalid domain!!!'` | 400, 메시지에 `'유효하지 않은'` 포함 |
| 3 | BS-DR-03: `verify.POST` | 200, `data.verified true` |
| 4 | BS-DR-04: `remove.DELETE ?tenantId=t-1` | 200, 메시지에 `'제거'`, `removeCustomDomain('t-1')` |
| 5 | BS-DR-05: `list.GET` | items 1건, `domain 'blog.example.com'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** BS-DR-01 의 `CNAME` 은 모킹 값이며 실제 DomainService 는 `TXT` 레코드를 반환한다(BS-DS-03). `status.GET` 핸들러는 검증하지 않는다.

---

### TC-A-014: 자체 catch 라우트의 오류 응답 일관성 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/route-error-consistency.test.ts` (신규) |
| **대상** | [B] 부류 라우트의 catch 분기: `tenant-routes.ts`, `auth-routes.ts`, `billing-routes.ts`, `admin-routes.ts` |
| **우선순위** | Critical |
| **전제조건** | wrappers 통과형 모킹, 각 서비스가 지정한 예외를 reject 하도록 모킹 |
| **테스트 데이터** | 상태 코드를 가진 예외 `Object.assign(new Error('중복'), { code: 'TENANT_DUP', statusCode: 409 })`, Prisma 형태 `Object.assign(new Error('Unique constraint failed on the fields: (slug)'), { name: 'PrismaClientKnownRequestError', code: 'P2002' })`, DB 연결 오류 `new Error('connect ECONNREFUSED')` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | tenant `create.POST` 에서 statusCode 409 예외 | 400 (상태 코드 유실), `error.message '중복'` |
| 2 | tenant `create.POST` 에서 Prisma P2002 형태 예외 | 400, `error.message` 에 Prisma 원문 포함 |
| 3 | tenant `settings.GET` 에서 DB 연결 오류 | 404 |
| 4 | auth `login.POST` 에서 DB 연결 오류 | 401, `error.message` 에 원문 포함 |
| 5 | billing `subscription.GET` 에서 reject | 응답 없이 예외 전파 (catch 없음) |
| 6 | admin `onboarding.create.POST` 에서 BlogError 409, 일반 Error | 각각 409 + 오류 코드 보존, 400 + 원문 메시지 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** withRouteErrorHandling 은 [A] 부류 라우트에만 적용되어 있다. [B] 부류에 같은 정책(상태 코드 보존, 상태 코드 없는 예외는 toolkit 위임)을 적용할지 결정한 뒤 기대값을 확정해야 한다. 2·4번은 내부 오류 문구가 응답 본문에 노출되는 경로이다.

---

### TC-A-015: 멀티 테넌트 블로그 라우트 테넌트 해석 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/blog-routes-multi-tenant.test.ts` (신규) |
| **대상** | `src/routes/blog-routes.ts`: `createBlogRoutes(null, options, multiTenantConfig)` 의 비공개 `resolveService` |
| **우선순위** | Critical |
| **전제조건** | `multiTenantConfig = { createScopedService: vi.fn(), tenantResolver: 4개 메서드 vi.fn, baseDomain: 'blog.example.com' }`, wrappers 통과형, validators 모킹 |
| **테스트 데이터** | 테넌트 `{ id: 't-1', slug: 'my-blog' }`, user id `'u-1'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `resolve` 가 `null`, 헤더 없음, `public.list.GET` | 404 `'테넌트를 찾을 수 없습니다.'`, `createScopedService` 미호출 |
| 2 | `resolve` 가 테넌트 반환 | `createScopedService('t-1')` 1회, 스코프 서비스 `listPublished` 호출 |
| 3 | `admin.list.POST` 유효 body | 스코프 서비스 `create(data, 'u-1')`, 201 |
| 4 | 테넌트 해석 성공, `admin.slugCheck.GET` 에 slug 없음 | 400 (테넌트 해석 뒤 검사) |
| 5 | 테넌트 해석 실패, `admin.detail.DELETE` | 404, `remove` 미호출 |
| 6 | 스코프 서비스 `create` 가 BlogError 409 | 409 + 오류 코드 보존 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 현재 어떤 테스트도 `createBlogRoutes` 에 세 번째 인자를 전달하지 않는다. multi 모드에서 `createBlogSystem` 이 만드는 블로그 라우트는 이 경로만 사용한다.

---

### TC-A-016: 슈퍼 관리자 라우트 미검증 분기 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/super-admin-routes.test.ts` (신규) |
| **대상** | `src/routes/admin-routes.ts`: `tenants.*`, `users.detail`·`updateRole`·`deactivate`, `onboarding.create` |
| **우선순위** | High |
| **전제조건** | `withAdminApi` 통과형, SUPER_ADMIN 컨텍스트(user id `'admin-1'`) |
| **테스트 데이터** | 테넌트 목록 활성 1건·비활성 1건(total 2), params id `'admin-1'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `tenants.list.GET ?status=inactive` | items 에 비활성 1건만 남고 `total 2` 유지 (페이지 내 필터) |
| 2 | `tenants.detail.GET` 에서 `getById` 가 `null` | 404 `'테넌트를 찾을 수 없습니다.'` |
| 3 | `tenants.create.POST` slug 누락 | 400 `'name과 slug는 필수입니다.'` |
| 4 | `users.updateRole.PATCH` role `'ADMIN'` | 400 `'유효하지 않은 역할입니다. 허용: USER, SUPER_ADMIN'` |
| 5 | `users.updateRole.PATCH` params id `'admin-1'` | 400 `'자신의 시스템 역할은 변경할 수 없습니다.'` |
| 6 | `users.deactivate.PATCH` params id `'admin-1'` | 400 `'자신의 계정을 비활성화할 수 없습니다.'` |
| 7 | onboardingService 없이 만든 라우트의 `onboarding.create.POST` | 501 `'온보딩 서비스가 비활성화되어 있습니다.'` |
| 8 | `users.detail.GET` 에서 `findUnique` 가 `null` | 404 `'사용자를 찾을 수 없습니다.'` |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 1번에서 `total`·`totalPages` 가 필터 전 값으로 남는 동작이 의도인지 확인이 필요하다.

---

### TC-A-017: 인증 라우트 입력 검증과 OAuth 분기 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/auth-routes-branches.test.ts` (신규) |
| **대상** | `src/routes/auth-routes.ts`: 입력 누락 분기, `refresh` 실패, `changePassword` 길이 검사, `oauth.login`, `oauth.callback` |
| **우선순위** | High |
| **전제조건** | TC-A-009 와 같은 wrappers 모킹, OAuth 핸들러는 `props = { params: Promise.resolve({ provider }) }` 전달 |
| **테스트 데이터** | provider `'kakao'`, `'google'`, newPassword `'short12'`(7자) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `register.POST` 에 email 누락 | 400 `'이메일과 비밀번호는 필수입니다.'`, `register` 미호출 |
| 2 | `refresh.POST` 본문 없음 | 400, `error.code 'BAD_REQUEST'` |
| 3 | `refresh.POST` 에서 `refreshToken` reject | 401, `error.code 'UNAUTHORIZED'` |
| 4 | `changePassword.POST` newPassword 7자 | 400 `'새 비밀번호는 최소 8자 이상이어야 합니다.'` |
| 5 | `oauth.login.GET` provider `'kakao'` | 400 `'지원하지 않는 OAuth 프로바이더: kakao'` |
| 6 | `oauth.login.GET` provider `'google'` | 리다이렉트 응답, `Location` 헤더가 `getOAuthLoginUrl` 반환값 |
| 7 | `oauth.login.GET` 에서 `getOAuthLoginUrl` 이 throw | 500, 원문 메시지 |
| 8 | `oauth.callback.GET` 에 code 없음 | 400 `'OAuth 인증 코드가 없습니다.'` |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)

---

### TC-A-018: 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/billing-routes-branches.test.ts` (신규) |
| **대상** | `src/routes/billing-routes.ts`: `webhook.POST`, `checkout.POST`, `usage.GET`, `adminPlans.POST`·`PUT`, `plans.GET` |
| **우선순위** | High |
| **전제조건** | TC-A-012 와 같은 wrappers 모킹 |
| **테스트 데이터** | 원문 본문 `'{"type":"x"}'`, `?tenantId=t-1&period=2026-04-15`, `maxStorage: 1073741824n` 인 플랜 레코드 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `webhook.POST` 에 `stripe-signature` 없음 | 400 `'Stripe 서명이 없습니다.'`, `handleWebhook` 미호출 |
| 2 | `handleWebhook` 이 서명 검증 예외 | 400, 원문 메시지 |
| 3 | 서명이 있는 `webhook.POST` | `handleWebhook` 첫 인자가 `request.text()` 원문 문자열 |
| 4 | `checkout.POST` 에 cancelUrl 누락 | 400 `'필수 파라미터가 누락되었습니다.'` |
| 5 | `adminPlans.POST` 에 maxPosts 누락, `adminPlans.PUT` 에 id 누락 | 각각 400 `'플랜 정보가 불완전합니다.'`, 400 `'플랜 ID는 필수입니다.'` |
| 6 | `usage.GET ?tenantId=t-1&period=2026-04-15` | `getUsage('t-1', Date)` 호출 |
| 7 | `listActive` 가 `maxStorage` BigInt 레코드 반환, `plans.GET` | `NextResponse.json` 의 JSON 직렬화 단계에서 TypeError (현재 코드에 BigInt 변환 없음) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 7번은 참조 스키마 `src/prisma/blog-system.prisma` 가 `Plan.maxStorage`, `UsageRecord.value` 를 `BigInt` 로 정의한 데 근거한다. 호스트 스키마가 이 정의를 따르는지 확인이 필요하다.

---

### TC-A-019: 태그·댓글·블로그 관리자 라우트 미검증 핸들러 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/content-routes-branches.test.ts` (신규) |
| **대상** | `tag-routes.ts`: `admin.detail.GET`·`PUT`, `public.cloud.GET` / `comment-routes.ts`: `admin.listAll.GET`, `public.list.GET`, `admin.bulkRemove.DELETE` / `blog-routes.ts`: `admin.detail.PUT`, `admin.bulk.PATCH` |
| **우선순위** | Medium |
| **전제조건** | wrappers 통과형, `getSearchParam` 이 실제 URL 파싱 |
| **테스트 데이터** | `?limit=abc`, `?status=INVALID&postId=p-1`, `?postId=p-1&includeReplies=false`, `{ ids: ['1'], published: true, featured: true }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | tag `admin.detail.GET` 에서 `getById` 가 `null` | 404 `'Tag not found'` |
| 2 | tag `admin.detail.PUT` 본문이 JSON 아님 | 400 `'요청 본문이 올바르지 않습니다.'` |
| 3 | tag `public.cloud.GET ?limit=abc` | `getTagCloud(undefined)` |
| 4 | comment `admin.listAll.GET ?status=INVALID&postId=p-1` | `listAll` 인자 `status undefined`, `postId 'p-1'` |
| 5 | comment `public.list.GET ?postId=p-1&includeReplies=false` | `listByPost('p-1', { includeReplies: false })` |
| 6 | comment `admin.bulkRemove.DELETE` 에 `ids: []` | 400 `'ids 배열이 필요합니다.'` |
| 7 | blog `admin.detail.PUT` 검증 통과, `getById` 가 `null` | 404 `'Post not found'`, `update` 미호출 |
| 8 | blog `admin.bulk.PATCH` 에 published·featured 동시 지정 | `bulkUpdatePublished`·`bulkUpdateFeatured` 모두 호출, `data.count` 는 `bulkUpdateFeatured` 반환값 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 8번은 두 갱신 결과 중 나중 값으로 count 를 덮어쓰는 현재 동작을 기록한 것이다.

---

## 4. E2E Tests (엔드-투-엔드 테스트)

**목적:** 이 패키지는 호스트 앱을 포함하지 않으므로 브라우저 기반 사용자 여정은 범위 밖이다. 이 문서는 E2E 를 "패키지가 함께 제공하는 클라이언트 모듈과 서버 라우트 핸들러를 실제로 연결했을 때의 계약"으로 재정의한다. 현재 해당 테스트는 없다.

**실행 명령:** 계획 파일을 추가한 뒤 `pnpm exec vitest run tests/e2e` 로 실행한다. `.tsx` 파일은 `vitest.config.ts` 의 `include` 확장이 선행되어야 수집된다.

---

### TC-E-001: OnboardingWizard 제출과 슈퍼 관리자 온보딩 라우트 계약 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/onboarding-wizard-route.test.tsx` (신규) |
| **대상** | `src/onboarding/OnboardingWizard.tsx` 의 `handleSubmit` → `src/routes/admin-routes.ts` 의 `onboarding.create.POST` |
| **우선순위** | High |
| **전제조건** | 컴포넌트 공통 전제조건 1~3, `globalThis.fetch` 를 `createSuperAdminRoutes(…, onboardingService).onboarding.create.POST` 로 연결하는 어댑터(요청 body 로 컨텍스트 생성, user `{ id: 'owner-1', role: 'SUPER_ADMIN' }`), `withAdminApi` 통과형 모킹, `onboardingService.onboardTenant = vi.fn()` |
| **테스트 데이터** | 이름 `'My Blog'`, 기본 카테고리 2건, 샘플 게시글 생성 선택 |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | 1~4단계를 진행한 뒤 `'블로그 생성'` 클릭 | 어댑터가 받은 `body.ownerUserId === ''` |
| 2 | 라우트 처리 결과 | 400 `'tenantName, tenantSlug, ownerUserId는 필수입니다.'` |
| 3 | 위저드 화면 | 오류 배너에 같은 문구, `onComplete` 미호출 |
| 4 | 서비스 호출 확인 | `onboardingService.onboardTenant` 미호출 |
| 5 | 비교: 어댑터가 `body.ownerUserId` 를 `context.user.id` 로 채워 전달 | 201, `onComplete` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 위저드 코드 주석은 `ownerUserId` 를 "서버에서 현재 사용자로 설정"한다고 설명하지만 라우트는 `!body.ownerUserId` 검사로 빈 문자열을 거부한다. 호스트 어댑터가 채워야 하는 값인지 라우트 결함인지 결정이 필요하다.

---

### TC-E-002: createAuthFetch 토큰 갱신과 refresh 라우트 계약 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/e2e/auth-fetch-refresh.test.ts` (신규, 파일 상단 `// @vitest-environment jsdom`) |
| **대상** | `src/auth/auth-fetch.ts` 의 갱신 요청 → `src/routes/auth-routes.ts` 의 `refresh.POST` |
| **우선순위** | Medium |
| **전제조건** | jsdom 설치, `globalThis.fetch` 어댑터(보호 API URL 은 401, `refreshEndpoint` 는 `createAuthRoutes(authService).refresh.POST(Request)` 로 연결), `withPublicApi` 가 Request 로부터 컨텍스트를 만드는 모킹 |
| **테스트 데이터** | `refreshEndpoint '/api/auth/refresh'`, `loginPath '/admin/login'` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `authFetch('/api/data')` | 보호 API 401 후 `refreshEndpoint` 로 body 없는 POST, `credentials: 'same-origin'` |
| 2 | refresh 라우트 처리 | 400, `error.code 'BAD_REQUEST'`, `authService.refreshToken` 미호출 |
| 3 | `authFetch` 반환값 | 원본 401, 재시도 요청 없음 |
| 4 | jsdom 환경의 후속 동작 | `window.location.href` 를 `'/admin/login'` 으로 설정 시도 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** `createAuthFetch` 는 쿠키 기반 갱신을 전제로 본문 없이 요청하지만 `createAuthRoutes.refresh` 는 본문의 `refreshToken` 을 요구한다. 호스트가 별도 갱신 엔드포인트를 두어야 하는지 문서 확인이 필요하다.

---

## 5. Security Tests (보안 테스트)

**목적:** 멀티 테넌트 SaaS 의 핵심 보안 경계인 테넌트 데이터 격리와 역할 기반 인가를 검증한다. OWASP Top 10 2021 기준으로 A01 Broken Access Control 에 해당하는 영역이다.

**실행 명령:** 아래 명령의 실측 결과는 3개 파일, 42개 통과이다.

```bash
pnpm exec vitest run \
  tests/tenant-proxy.test.ts \
  tests/unit/rbac-edge-cases.test.ts \
  tests/role-middleware.test.ts
```

---

### TC-S-001: 테넌트 프록시 tenantId 주입

| 항목 | 내용 |
|------|------|
| **파일** | `tests/tenant-proxy.test.ts` |
| **대상** | `src/core/tenant-proxy.ts`: `createTenantProxy()` |
| **우선순위** | Critical |
| **전제조건** | findMany·findFirst·findUnique·count·groupBy·create·update·delete·updateMany·deleteMany 를 가진 delegate 모킹, `$transaction` 은 콜백에 tx 객체 전달 |
| **테스트 데이터** | `TENANT_ID = 'tenant-001'`, 비모델 속성 `someUtility: 'not-a-delegate'`, `$disconnect` 함수 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TP-01: `post.findMany({ where: { published: true } })` | 원본 where `{ published: true, tenantId: 'tenant-001' }` |
| 2 | BS-TP-05: `post.create({ data: { title: 'test' } })` | 원본 data `{ title: 'test', tenantId }` |
| 3 | BS-TP-08: `post.updateMany({ where, data })` | where 에 tenantId 추가, data 유지 |
| 4 | BS-TP-11: `$transaction` 콜백 안에서 `tx.post.findMany`·`create` | tx delegate 호출에도 tenantId 주입 |
| 5 | BS-TP-15·19: `findMany(undefined)`, `create(undefined)` | `{ where: { tenantId } }`, `{ data: { tenantId } }` |
| 6 | BS-TP-18: `$disconnect` 접근 | 원본 함수와 같은 참조 |

- **자동화:** 가능 ✅ | **테스트 수:** 19개 (현재)
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-002: 역할 계층·OWNER 보호·크로스 테넌트 격리

| 항목 | 내용 |
|------|------|
| **파일** | `tests/unit/rbac-edge-cases.test.ts` |
| **대상** | `src/tenant/tenant-user-service.ts`: `ROLE_LEVELS`, `hasPermission`, `removeUser`, `updateRole`, `getUserRole` |
| **우선순위** | Critical |
| **전제조건** | `prisma.tenantUser` 모킹 |
| **테스트 데이터** | `TENANT_A 'tenant-a'`, `TENANT_B 'tenant-b'`, `USER_1 'user-1'`, 역할 4종 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | RBAC-01: 보유 역할 4종 × 요구 역할 4종 | 보유 역할 수준이 요구 수준 이상이면 `true`, 미만이면 `false` |
| 2 | RBAC-06: ADMIN 이 OWNER 권한 요구 | `false` |
| 3 | RBAC-12: OWNER 를 OWNER 로 `updateRole` | `tenantUser.count` 미호출 |
| 4 | RBAC-13·14: 비소속 사용자 `removeUser`·`updateRole` | `'소속되지 않은 사용자'` 예외 |
| 5 | RBAC-15: tenant-a 는 OWNER, tenant-b 는 미소속 | tenant-a `true`, tenant-b `false` |
| 6 | RBAC-17: 테넌트별로 다른 역할 | tenant-a `OWNER`, tenant-b `VIEWER` |

- **자동화:** 가능 ✅ | **테스트 수:** 18개 (현재)
- **비고:** 크로스 테넌트 격리는 모킹 반환값 순서로 표현되며, `findUnique` 에 전달되는 복합 키 인자(`tenantId_userId`)는 단언하지 않는다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-003: 테넌트 역할 인가 미들웨어

| 항목 | 내용 |
|------|------|
| **파일** | `tests/role-middleware.test.ts` |
| **대상** | `src/auth/role-middleware.ts`: `createTenantRoleMiddleware()` |
| **우선순위** | Critical |
| **전제조건** | `{ request: { headers, url }, user, metadata }` 형태 컨텍스트, TenantUserService 모킹 |
| **테스트 데이터** | 헤더 `X-Tenant-Id: t-1`, 요구 역할 EDITOR·ADMIN, 보유 역할 VIEWER·OWNER·없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-RM-01: user 없음 | 401, `success false` |
| 2 | BS-RM-02: 헤더와 `metadata.tenantId` 모두 없음 | 400 |
| 3 | BS-RM-03: VIEWER 가 ADMIN 요구 | 403, `getUserRole` 1회, `hasPermission` 미호출 |
| 4 | BS-RM-03b: `getUserRole` 이 `null` | 403 |
| 5 | BS-RM-04: OWNER 가 EDITOR 요구 | `next()` 호출, 200, `metadata.tenantRole OWNER`, `metadata.tenantId 't-1'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-004: 테넌트 프록시가 가로채지 않는 메서드 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/tenant-proxy-bypass.test.ts` (신규) |
| **대상** | `src/core/tenant-proxy.ts`: `READ_METHODS`·`MUTATE_METHODS`·`create` 목록 밖의 메서드, 비모델 속성, `$transaction` 배열형 호출 |
| **우선순위** | Critical |
| **전제조건** | TC-S-001 delegate 모킹에 upsert·aggregate·createMany·findUniqueOrThrow·findFirstOrThrow 추가, `$queryRawUnsafe = vi.fn()` |
| **테스트 데이터** | `TENANT_ID = 'tenant-001'`, 호출자가 넘기는 `tenantId: 'other'` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `post.findMany({ where: { tenantId: 'other' } })` | 원본 where `tenantId === 'tenant-001'` (스프레드 순서로 덮어씀) |
| 2 | `post.create({ data: { tenantId: 'other' } })` | 원본 data `tenantId === 'tenant-001'` |
| 3 | `post.upsert({ where: { id: '1' }, create: { title: 'x' }, update: {} })` | 인자가 그대로 전달되어 where·create 에 tenantId 없음 |
| 4 | `post.aggregate`, `post.createMany`, `post.findUniqueOrThrow`, `post.findFirstOrThrow` 호출 | 모두 tenantId 미주입 |
| 5 | `proxy.$queryRawUnsafe('SELECT * FROM posts')` | 원본 함수가 그대로 호출되어 테넌트 조건 없음 |
| 6 | `proxy.$transaction([p1, p2])` (배열형) | 배열을 콜백으로 호출하므로 TypeError 로 reject |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 1·2번은 현재 보장되는 동작을 고정하는 회귀 테스트이고, 3~6번은 격리가 적용되지 않는 경로를 기록한다. 설치본 blog-core 2.1.2 의 `createBlogService` 는 태그 동기화 시 `$transaction` 안에서 `postTag.createMany` 와 `postTag.deleteMany` 를 호출한다. 스코프 프록시에서 `createMany` 에는 tenantId 가 주입되지 않고 `deleteMany` 에는 주입되므로, 호스트 `postTag` 모델에 tenantId 컬럼이 있는지에 따라 결과가 달라진다. 결함 여부 판단을 위해 확인이 필요하다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-005: X-Tenant-Id 헤더 신뢰 범위와 해석 불일치 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/tenant-header-trust.test.ts` (신규) |
| **대상** | `src/tenant/tenant-middleware.ts`: `resolveTenantFromRequest` / `src/routes/blog-routes.ts`: `resolveService` / `src/auth/role-middleware.ts` |
| **우선순위** | Critical |
| **전제조건** | `createBlogRoutes(null, {}, { createScopedService: vi.fn(), tenantResolver: createTenantResolver(mockPrisma), baseDomain: 'blog.example.com' })`, `tenant.findFirst` 가 where 조건에 맞는 테넌트 반환, wrappers 통과형 |
| **테스트 데이터** | 호스트 `tenant-a.blog.example.com`, 헤더 `X-Tenant-Id: tenant-b`, 테넌트 `{ id: 'id-a', slug: 'tenant-a' }`, `{ id: 'id-b', slug: 'tenant-b' }` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `admin.list.GET` 를 tenant-a 호스트와 `X-Tenant-Id: tenant-b` 로 호출 | `findFirst` 첫 호출 where `{ slug: 'tenant-b', isActive: true }`, `createScopedService('id-b')` (헤더가 호스트명보다 우선) |
| 2 | 같은 요청으로 `public.list.GET` | tenant-b 스코프 서비스의 `listPublished` 호출 |
| 3 | 헤더 슬러그에 해당하는 테넌트 없음 | 호스트명 기반 `resolve` 로 폴백하여 `createScopedService('id-a')` |
| 4 | `createTenantRoleMiddleware` 에 같은 헤더 | `getUserRole('tenant-b', userId)` 호출 (헤더 값을 테넌트 ID 로 해석) |
| 5 | 같은 헤더로 `resolveTenantFromRequest` 호출 | `resolveFromSlug('tenant-b')` 호출 (헤더 값을 슬러그로 해석) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** `tenant-middleware.ts` 주석은 이 헤더를 "신뢰할 수 있는 내부 요청용"으로 설명하지만 코드에는 요청 출처 검사가 없다. blog 관리자 라우트는 `withAdminApi` 외에 테넌트 소속을 확인하지 않으므로, 외부 요청의 헤더를 호스트가 제거하는지 문서화가 필요하다. 4·5번은 같은 헤더를 두 모듈이 서로 다른 식별자로 해석하는 현재 상태를 기록한다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-006: 관리자 라우트의 테넌트 소속 검사 부재 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/admin-route-authorization.test.ts` (신규) |
| **대상** | `src/routes/tenant-routes.ts`, `src/routes/billing-routes.ts`, `src/routes/domain-routes.ts` 의 인가 수준과 `src/routes/admin-routes.ts` 의 `verifySuperAdmin` 비교 |
| **우선순위** | High |
| **전제조건** | `withAdminApi` 가 role `'ADMIN'`(SUPER_ADMIN 아님), user id `'u-1'` 컨텍스트를 만드는 모킹 |
| **테스트 데이터** | 요청자가 소속되지 않은 테넌트 `'t-other'` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `createTenantRoutes().create.POST` 유효 body | 201 (역할 검사 없음) |
| 2 | 같은 컨텍스트로 `createSuperAdminRoutes().tenants.create.POST` | 403 `'슈퍼 관리자 권한이 필요합니다.'` |
| 3 | `createTenantRoutes().users.updateRole.PATCH` params id `'t-other'` | 요청자 소속 확인 없이 `tenantUserService.updateRole('t-other', …)` 호출 |
| 4 | `createBillingRoutes().subscription.GET ?tenantId=t-other` | 요청자 소속 확인 없이 `getSubscription('t-other')` 호출 |
| 5 | `createDomainRoutes().remove.DELETE ?tenantId=t-other` | `removeCustomDomain('t-other')` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** toolkit `withAdminApi` 가 허용하는 역할 범위와 호스트의 라우트 구성에 따라 위험도가 달라진다. 테넌트 단위 인가를 `requireTenantRole` 로 호스트에 맡기는 설계인지 확인이 필요하다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-007: OAuth 콜백 계정 연결과 state 검증 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/oauth-callback.test.ts` (신규) |
| **대상** | `src/auth/auth-service.ts`: `getOAuthLoginUrl`, `handleOAuthCallback` / `src/routes/auth-routes.ts`: `oauth.callback.GET` |
| **우선순위** | High |
| **전제조건** | TC-U-007 toolkit 모킹에 `OAuthManager.getLoginUrl`·`exchangeCodeForToken`·`getUserInfo`, `PrismaOAuthAccountRepository.findByProvider`·`create`·`update` 추가, `config.oauthProviders.google` 지정 |
| **테스트 데이터** | `userInfo = { id: 'g-1', email: 'victim@example.com', emailVerified: false }`, 기존 사용자 `{ id: 'user-victim' }` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `findByProvider` 가 `null`, `findByEmail` 이 기존 사용자 반환 | `oauthAccountRepo.create({ userId: 'user-victim', provider: 'google', providerAccountId: 'g-1', … })` 호출, 토큰 발급 (`emailVerified` 확인 없음) |
| 2 | 신규 이메일, `emailVerified: true` | `userRepo.create` 인자 `emailVerified` 가 Date |
| 3 | 기존 OAuth 계정이 있으나 `findById` 가 `null` | `'연결된 사용자를 찾을 수 없습니다.'` 예외 |
| 4 | `getOAuthLoginUrl('google')` | `TokenGenerator.generateUrlSafe(16)` 결과를 `getLoginUrl` 에 전달하고 서버에 저장하지 않음 |
| 5 | `oauth.callback.GET ?code=abc&state=forged` | `handleOAuthCallback('google', 'abc')` 호출 (state 미검증) |
| 6 | provider `'kakao'` 로 `handleOAuthCallback` | `'github'` 로 처리 (google 이외 값은 github 로 매핑, 콜백 라우트는 provider 를 검사하지 않음) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** `auth-service.ts` 주석에 state 파라미터를 "실제 구현에서 세션 기반으로 개선 필요"라고 남겨 두었다. 1번은 이메일 미인증 OAuth 계정이 기존 계정에 연결되는 경로이다.
- **관련 요구사항:** OWASP A07:2021 Identification and Authentication Failures

---

### TC-S-008: 온보딩 샘플 게시글 HTML 에 입력값 삽입 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/onboarding-sample-html.test.ts` (신규) |
| **대상** | `src/onboarding/onboarding-service.ts`: 샘플 게시글 `title`·`content`·`excerpt` 생성 |
| **우선순위** | High |
| **전제조건** | TC-U-015 서비스 모킹, `createSamplePost: true` |
| **테스트 데이터** | `tenantName = '<img src=x onerror=alert(1)>'` |

| # | 단계 | 예상 결과 (현재 코드 기준) |
|---|------|---------|
| 1 | `onboardTenant` 호출 | `blogService.create` 첫 인자 `content` 에 `<strong><img src=x onerror=alert(1)></strong>` 원문 포함 |
| 2 | 같은 입력 | `title`, `excerpt` 에도 원문 포함 |
| 3 | 슈퍼 관리자 `onboarding.create.POST` 경유 | tenantName 형식 검증 없이 `onboardTenant` 에 전달 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 설치본 blog-core 2.1.2 의 `createBlogService.create` 는 content 에 `sanitizeHtmlContent` 를 적용하되 결과가 빈 문자열이면 원문을 사용한다(`sanitize(data.content) || data.content`). 새니타이저가 `onerror` 속성을 제거하는지와 title·excerpt 출력 시 이스케이프 여부는 blog-core 와 호스트 범위이므로 확인이 필요하다.
- **관련 요구사항:** OWASP A03:2021 Injection

---

## 6. Performance Tests (성능 테스트)

**목적:** 쿼리 성능은 호스트 DB 의 책임이므로 패키지 내부에서 측정할 수 있는 비용으로 범위를 한정한다. 현재 해당 테스트는 없다.

**실행 명령:** 계획 파일을 추가한 뒤 `pnpm exec vitest run tests/performance` 로 실행한다.

---

### TC-P-001: 테넌트 프록시 모델 접근 비용 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/performance/tenant-proxy-access.test.ts` (신규) |
| **대상** | `src/core/tenant-proxy.ts`: 모델 속성 접근마다 `createDelegateProxy` 를 호출하는 `get` 트랩 |
| **우선순위** | Low |
| **전제조건** | TC-S-001 delegate 모킹, `performance.now()` |
| **테스트 데이터** | 반복 횟수는 첫 측정 후 결정 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | 같은 프록시에서 `proxy.post` 를 두 번 접근 | 서로 다른 객체 (`proxy.post !== proxy.post`), 접근마다 Proxy 신규 생성 |
| 2 | `proxy.post.findMany` 반복 호출과 원본 delegate 반복 호출의 소요 시간 비교 | 기준값 미정: 첫 측정 결과로 허용 배수를 정한다 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 환경별 편차가 크므로 CI 에서는 절대 시간 대신 원본 대비 배수로 판정하는 방식을 검토한다.

---

## 7. Accessibility Tests (접근성 테스트)

**목적:** `./admin`, `./onboarding` 서브패스로 내보내는 React 컴포넌트 5종이 WCAG 2.1 Level AA 기준의 입력 요소 이름, 상태 전달, 동적 알림 요건을 만족하는지 검증한다. 현재 해당 테스트와 렌더링 인프라가 모두 없다.

**선행 조건:** [컴포넌트 공통 전제조건](#관리자온보딩-컴포넌트-공통-전제조건-tc-u-018--tc-u-022) 1~4에 더해 axe-core 기반 검사 도구(예: vitest-axe 또는 jest-axe)를 도입해야 한다.

**실행 명령:** 계획 파일을 추가한 뒤 `pnpm exec vitest run tests/accessibility` 로 실행한다.

---

### TC-AC-001: 관리자 목록·폼 입력 요소 이름과 오류 알림 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/admin-managers.a11y.test.tsx` (신규) |
| **대상** | `src/admin/TenantManager.tsx`, `src/admin/UserManager.tsx` |
| **우선순위** | High |
| **전제조건** | 렌더링 인프라, axe-core 기반 검사 도구, fetch 모킹 |
| **테스트 데이터** | 목록 1건, 실패 응답 `{ success: false, error: { message: '오류' } }` |

| # | 단계 | 예상 결과 (현재 코드 상태) |
|---|------|---------|
| 1 | TenantManager 목록 화면 검색 input 의 접근 가능한 이름 조회 | 이름이 있어야 한다 (현재: placeholder `'이름 또는 슬러그 검색...'` 만 있고 label·aria-label 없음 → 실패 예상) |
| 2 | TenantManager 상태 select 의 이름 조회 | 이름이 있어야 한다 (현재: 없음 → 실패 예상) |
| 3 | UserManager 검색 input 의 이름 조회 | 이름이 있어야 한다 (현재: 없음 → 실패 예상) |
| 4 | TenantManager 생성 화면에서 `getByLabelText('이름')`, `getByLabelText('슬러그')` | 조회 성공 (`htmlFor` 연결 존재 → 통과 예상) |
| 5 | 실패 응답 후 오류 배너 | `role="alert"` 또는 `aria-live` 필요 (현재: className 만 존재 → 실패 예상) |
| 6 | 목록 표 axe 검사 | 위반 없음 (thead·th 구조 존재) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **관련 요구사항:** WCAG 2.1 SC 1.3.1 (Info and Relationships), SC 4.1.2 (Name, Role, Value), SC 4.1.3 (Status Messages)

---

### TC-AC-002: 온보딩 위저드 단계·선택 상태 전달 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/onboarding-wizard.a11y.test.tsx` (신규) |
| **대상** | `src/onboarding/OnboardingWizard.tsx` |
| **우선순위** | High |
| **전제조건** | 렌더링 인프라, axe-core 기반 검사 도구 |
| **테스트 데이터** | 이름 `'My Blog'` 입력 후 2~4단계 이동 |

| # | 단계 | 예상 결과 (현재 코드 상태) |
|---|------|---------|
| 1 | 단계 표시에서 현재 단계 요소 확인 | `aria-current="step"` 필요 (현재: className `active` 만 존재 → 실패 예상) |
| 2 | 2단계 카테고리 칩 버튼의 선택 상태 확인 | `aria-pressed` 로 선택 여부 전달 필요 (현재: className `selected` 만 존재 → 실패 예상) |
| 3 | 사용자 정의 카테고리 키·표시 이름 input 의 이름 조회 | 이름이 있어야 한다 (현재: placeholder 만 존재 → 실패 예상) |
| 4 | 1단계 `getByLabelText('블로그 이름')`, `getByLabelText('URL 슬러그')` | 조회 성공 (`htmlFor` 연결 존재 → 통과 예상) |
| 5 | 3단계 `getByRole('checkbox', { name: '샘플 환영 게시글 생성' })` | 조회 성공 (label 로 감싼 구조 → 통과 예상) |
| 6 | 제출 중 버튼 | disabled, 문구 `'생성 중...'` (진행 상태 알림 요소 필요 여부 확인) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **관련 요구사항:** WCAG 2.1 SC 1.3.1, SC 4.1.2

---

### TC-AC-003: 대시보드·모니터 상태 표시 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/accessibility/dashboard-monitor.a11y.test.tsx` (신규) |
| **대상** | `src/admin/SuperAdminDashboard.tsx`, `src/admin/SystemMonitor.tsx` |
| **우선순위** | Medium |
| **전제조건** | 렌더링 인프라, axe-core 기반 검사 도구, fetch 모킹 |
| **테스트 데이터** | TC-U-018·TC-U-019 성공 응답 |

| # | 단계 | 예상 결과 (현재 코드 상태) |
|---|------|---------|
| 1 | 로딩 문구 요소 확인 | `role="status"` 등 상태 알림 필요 (현재: div 만 존재 → 실패 예상) |
| 2 | SystemMonitor 진행 막대 확인 | `role="progressbar"` 와 `aria-valuenow` 필요 (현재: style width 만 존재 → 실패 예상) |
| 3 | 건강 상태 점(span) 옆 텍스트 확인 | 색상 외에 `'정상'`, `'연결됨'` 텍스트 제공 (통과 예상) |
| 4 | 제목 계층 확인 | h2 다음 h3 순서 (통과 예상) |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **관련 요구사항:** WCAG 2.1 SC 1.4.1 (Use of Color), SC 4.1.2, SC 4.1.3

---

## 8. Smoke Tests (빌드 산출물 스모크 테스트)

**목적:** 배포 산출물(`dist`)이 package.json `exports` 와 tsup 후처리 규칙대로 생성되는지 저비용으로 확인한다. 현재 모든 테스트는 vitest 별칭으로 `src` 를 import 하므로 dist 는 검증 대상이 아니다.

**선행 조건:** `pnpm run build`(tsup + `tsc --emitDeclarationOnly`)로 dist 를 생성한다.

**실행 명령:** 계획 파일을 추가한 뒤 `pnpm run build && pnpm exec vitest run tests/smoke` 로 실행한다.

---

### TC-SM-001: dist exports 서브패스 해석 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/smoke/dist-exports.test.ts` (신규) |
| **대상** | `package.json`: `exports` 11개, `typesVersions` / `tsup.config.ts` 엔트리 |
| **우선순위** | High |
| **전제조건** | dist 생성, peerDependencies(next, react, zod, @prisma/client, @withwiz/toolkit)가 devDependencies 로 설치됨 |
| **테스트 데이터** | exports 경로 `.`, `./core`, `./auth`, `./routes`, `./tenant`, `./admin`, `./onboarding`, `./validators`, `./types`, `./billing`, `./styles/admin` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | exports 11개 경로의 대상 파일 확인 | 모두 dist 에 존재 |
| 2 | `typesVersions` 의 `./dist/*` 규칙 확인 | 서브패스별 `index.d.ts` 존재 (예: `dist/core/index.d.ts`) |
| 3 | `dist/routes/index.js` export 목록 | `createTagRoutes`, `createCommentRoutes`, `withRouteErrorHandling`, `withPublicRoute`, `getErrorStatus` 포함 |
| 4 | `dist/index.js` export 목록 | `isBlogErrorLike`, `toErrorResponse`, `withRouteErrorHandling` 포함, `withPublicRoute`·`withAdminRoute`·`getErrorCode`·`getErrorStatus` 는 미포함 (`src/index.ts` 기준) |
| 5 | `dist/validators/index.js` 의 `CreateTenantSchema.safeParse({ name: 'a', slug: 'abc' })` | `success true` |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** `vitest.config.ts` 주석에 따르면 toolkit 이 확장자 없이 `next/server` 를 불러오므로, 순수 Node ESM 으로 dist 를 import 하면 해석에 실패할 수 있다. 이 경우 export 목록 확인은 파일 정적 분석으로 대체하거나 vitest 별칭과 같은 보정을 적용한다.

---

### TC-SM-002: 클라이언트 엔트리 지시문과 스타일 산출물 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/smoke/dist-client-entries.test.ts` (신규) |
| **대상** | `tsup.config.ts`: `onSuccess` 의 `addUseClientDirective()`(`admin/index`, `onboarding/index`), CSS 복사 |
| **우선순위** | Medium |
| **전제조건** | dist 생성 |
| **테스트 데이터** | `styles/blog-system-admin.css` (540줄) |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `dist/admin/index.js` 첫 줄 | `"use client";` |
| 2 | `dist/onboarding/index.js` 첫 줄 | `"use client";` |
| 3 | `dist/styles/blog-system-admin.css` | 원본 `styles/blog-system-admin.css` 와 내용 동일 |
| 4 | `dist/routes/index.js`, `dist/core/index.js` 첫 줄 | `"use client"` 없음 |
| 5 | `dist/onboarding/index.js` export 목록 | `OnboardingWizard` 와 서버용 `createOnboardingService` 가 함께 존재 |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 5번 구성에서 Next.js 서버 코드가 `@withwiz/blog-system/onboarding` 의 `createOnboardingService` 를 import 할 때 정상 동작하는지 호스트 확인이 필요하다. `src/core/blog-system.ts` 는 `../onboarding/onboarding-service` 를 직접 참조하지만 루트 `src/index.ts` 는 `./onboarding` 인덱스를 거쳐 재export 하므로 번들 결과도 함께 확인한다.

---

## 분류 요약

| 유형 | 현재 파일 수 | 현재 테스트 수 | SC 수 (완료/계획) | TC 수 (완료/계획) | 계획 신규 파일 수 |
|------|------------|-------------|-----------------|-----------------|----------------|
| **Unit** | 16개 | 163개 | 16 (12/4) | 24 (16/8) | +8개 |
| **Integration** | 3개 | 15개 | 5 (2/3) | 6 (3/3) | +3개 |
| **API** | 11개 | 91개 | 16 (10/6) | 19 (13/6) | +6개 |
| **E2E** | 0개 | 0개 | 2 (0/2) | 2 (0/2) | +2개 |
| **Security** | 3개 | 42개 | 8 (3/5) | 8 (3/5) | +5개 |
| **Performance** | 0개 | 0개 | 1 (0/1) | 1 (0/1) | +1개 |
| **Accessibility** | 0개 | 0개 | 3 (0/3) | 3 (0/3) | +3개 |
| **Smoke** | 0개 | 0개 | 2 (0/2) | 2 (0/2) | +2개 |
| **Load/Stress** | 0개 | 0개 | 0 | 0 | 없음 |
| **Chaos** | 0개 | 0개 | 0 | 0 | 없음 |
| **합계** | **33개** | **311개** | **53 (27/26)** | **65 (35/30)** | **+30개** |

- 계획 TC 의 테스트 수는 추측하지 않고 0개로 기재했다. 구현 후 실측값으로 갱신한다.
- 파일 누락 대조: `find tests -name "*.test.ts"` 결과 33개와 이 문서의 도메인별 실행 명령에 포함된 파일 33개를 비교한 결과, 누락 0개와 중복 배정 0개를 확인했다. 도메인별 실행 결과의 합(163 + 15 + 91 + 42)도 전체 실행 결과 311과 일치한다.

---

## 기존 ID 매핑표

테스트 이름에 포함된 기존 ID 는 변경하지 않았다. 새 문서에서는 파일 경로와 TC ID 로 케이스를 식별한다.

| 기존 ID | 파일 | 테스트 수 | 새 TC | 새 SC | tests/spec.md 수록 |
|---------|------|---------|-------|-------|------------------|
| BS-CF-01~08 | `tests/config.test.ts` | 8 | TC-U-001 | SC-U-001 | Task 1 |
| BS-TV-01~16 | `tests/tenant-validator.test.ts` | 16 | TC-U-002 | SC-U-002 | Task 3 |
| BS-TS-01~16 | `tests/tenant-service.test.ts` | 16 | TC-U-003 | SC-U-003 | Task 4 |
| BS-TU-01~14 | `tests/tenant-user-service.test.ts` | 14 | TC-U-004 | SC-U-004 | Task 5 |
| BS-TR-01~09 ① | `tests/tenant-resolver.test.ts` | 9 | TC-U-005 | SC-U-005 | Task 6 |
| BS-TM-01~05 | `tests/tenant-middleware.test.ts` | 5 | TC-U-006 | SC-U-005 | Task 7 |
| AS-01~19 | `tests/unit/auth-service.test.ts` | 19 | TC-U-007 | SC-U-006 | 미수록 |
| BS-AF-01~05 | `tests/auth-fetch.test.ts` | 5 | TC-U-008 | SC-U-007 | Task 8 |
| BS-WH-01~11 | `tests/webhook-handler.test.ts` | 11 | TC-U-009 | SC-U-008 | Task 10 |
| (ID 없음) describe `WebhookHandler` | `tests/unit/webhook-handler.test.ts` | 6 | TC-U-010 | SC-U-008 | 미수록 |
| BS-PS-01~09 | `tests/plan-service.test.ts` | 9 | TC-U-011 | SC-U-009 | Task 11 |
| (ID 없음) describe `PlanService` | `tests/unit/plan-service.test.ts` | 5 | TC-U-012 | SC-U-009 | 미수록 |
| BS-BH-01~09 | `tests/billing-helpers.test.ts` | 9 | TC-U-013 | SC-U-010 | Task 12 (BS-BH-06 기대값 상이) |
| (ID 없음) describe `BillingService` | `tests/unit/billing-service.test.ts` | 14 | TC-U-014 | SC-U-010 | 미수록 |
| BS-OB-01~07 ② | `tests/onboarding-service.test.ts` | 7 | TC-U-015 | SC-U-011 | Task 13 |
| BS-DS-01~10 | `tests/domain-service.test.ts` | 10 | TC-U-016 | SC-U-012 | Task 14 (BS-DS-01 설명 상이) |
| BS-BF-01~07 | `tests/blog-system-factory.test.ts` | 7 | TC-I-001 | SC-I-001 | Task 15 |
| BS-SM-01~04 | `tests/integration/blog-system-modes.test.ts` | 4 | TC-I-002 | SC-I-001 | 미수록 |
| BS-OB-01~04 ② | `tests/integration/onboarding-flow.test.ts` | 4 | TC-I-003 | SC-I-002 | 미수록 |
| BS-ERR-01~05, 10 | `tests/route-error.test.ts` | 6 | TC-A-001 | SC-A-001 | 미수록 |
| BS-ERR-06~09, 14 | `tests/route-error.test.ts` | 5 | TC-A-002 | SC-A-001 | 미수록 |
| BS-ERR-11~13 | `tests/route-error.test.ts` | 3 | TC-A-003 | SC-A-001 | 미수록 |
| BS-BR-01~13 | `tests/integration/blog-routes.test.ts` | 13 | TC-A-004 | SC-A-002 | 미수록 |
| BS-RH-01~09 | `tests/route-helpers.test.ts` | 9 | TC-A-005 | SC-A-002 | Task 16 |
| BS-TR-01~07 ① | `tests/tag-routes.test.ts` | 7 | TC-A-006 | SC-A-003 | 미수록 |
| BS-CR-01~10 | `tests/comment-routes.test.ts` | 10 | TC-A-007 | SC-A-004 | 미수록 |
| BS-SR-01~04 | `tests/search-routes.test.ts` | 4 | TC-A-008 | SC-A-005 | 미수록 |
| BS-AU-01~08 | `tests/integration/auth-routes.test.ts` | 8 | TC-A-009 | SC-A-006 | 미수록 |
| BS-TR-01~10 ① | `tests/integration/tenant-routes.test.ts` | 10 | TC-A-010 | SC-A-007 | 미수록 |
| BS-AR-01~06 | `tests/admin-routes.test.ts` | 6 | TC-A-011 | SC-A-008 | Task 17 |
| BS-BI-01~05 | `tests/integration/billing-routes.test.ts` | 5 | TC-A-012 | SC-A-009 | 미수록 |
| BS-DR-01~05 | `tests/integration/domain-routes.test.ts` | 5 | TC-A-013 | SC-A-010 | 미수록 |
| BS-TP-01~19 | `tests/tenant-proxy.test.ts` | 19 | TC-S-001 | SC-S-001 | Task 2 (01~14 만 수록) |
| RBAC-01~18 | `tests/unit/rbac-edge-cases.test.ts` | 18 | TC-S-002 | SC-S-002 | 미수록 |
| BS-RM-01, 02, 03, 03b, 04 | `tests/role-middleware.test.ts` | 5 | TC-S-003 | SC-S-003 | Task 9 (03b 미수록) |
| **합계** | 33개 파일 | **311** | 35 | 27 | |

### ID 체계 불일치 사항

- **ID 충돌 ①**: `BS-TR` 접두어가 3개 파일에서 서로 다른 대상에 쓰인다. tenant-resolver(01~09), tag-routes(01~07), integration/tenant-routes(01~10)이며, `tests/spec.md` 는 BS-TR 을 tenant-resolver 로 정의한다.
- **ID 충돌 ②**: `BS-OB-01~04` 가 onboarding-service 와 integration/onboarding-flow 에 모두 존재하며 케이스 내용이 서로 다르다.
- **ID 체계 혼재**: `BS-XX-nn`(28개 파일), `AS-nn`(auth-service), `RBAC-nn`(rbac-edge-cases) 세 체계가 공존하고, `tests/unit/` 의 billing-service·plan-service·webhook-handler 3개 파일에는 ID 가 없다.
- **파일 머리말 수치 차이**: tenant-proxy 머리말은 "(14건)"이지만 실제 19건, role-middleware 머리말은 "(4건)"이지만 실제 5건이다. spec.md Task 17 커밋 문구는 "5건"이지만 표와 실제 테스트는 6건이다.
- **기대값 차이**: spec.md 는 BS-BH-06 을 "api_calls → 10000 (또는 기본값)"으로 적었으나 테스트와 코드는 `Number.MAX_SAFE_INTEGER` 이다. spec.md 는 BS-DS-01 을 "token 없음 → null"로 적었으나 테스트는 `checkVerification` 예외를 단언한다.
- **spec.md 전제 차이**: spec.md 는 모노레포 경로(`packages/blog-system/…`), `--project blog-system`, `setupFiles` 등록을 전제로 하지만 현재 저장소는 단일 패키지이고 `vitest.config.ts` 에 projects·setupFiles 가 없다. Definition of Done 의 "~148건 이상"과 달리 실측은 311건이다.

---

## 도메인 적용성 판정

사전 조사 문서(`WITHWIZ_PACKAGES_TEST_AUDIT.md`, 2026-09-13)의 판정표에서 blog-system 열을 옮기고, 이번에 코드를 읽어 확인한 근거를 덧붙였다.

| 도메인 | 사전 조사 판정 | 근거 (코드 확인) | 현재 파일/테스트 | 이 문서의 SC |
|--------|--------------|----------------|---------------|------------|
| Unit | 적용 | 서비스·검증기·헬퍼가 `create*` 팩토리로 분리되어 Prisma delegate 모킹만으로 검증할 수 있다 | 16 / 163 | SC-U-001~016 |
| API | 적용 | 라우트 9종이 `create*Routes` 팩토리로 핸들러를 반환하므로(scheduler 라우트는 blog-core 재export) Request 기반 계약 검증이 가능하다 | 11 / 91 | SC-A-001~016 |
| Integration | 적용 | `createBlogSystem` 이 mode·billing·domain·features 설정에 따라 서비스·라우트·미들웨어를 조립하는 분기가 있다 | 3 / 15 | SC-I-001~005 |
| E2E | 제한적 | 호스트 앱이 없어 브라우저 여정은 범위 밖이며, 동봉된 클라이언트 모듈(OnboardingWizard, createAuthFetch)과 서버 라우트 사이의 계약으로 한정한다 | 0 / 0 | SC-E-001~002 |
| Security | 적용(우선) | `createTenantProxy` 의 tenantId 주입, `ROLE_LEVELS` 기반 인가, `X-Tenant-Id` 헤더 해석이 멀티 테넌트 격리의 핵심 경로이다 | 3 / 42 | SC-S-001~008 |
| Accessibility | 적용, 0건 | 관리자 컴포넌트 4종과 OnboardingWizard 를 `./admin`, `./onboarding` 으로 export 하지만 렌더링 인프라와 테스트가 모두 없다 | 0 / 0 | SC-AC-001~003 |
| Performance | 제한적 | 대량 처리 루프가 없고 쿼리 성능은 호스트 DB 책임이며, 패키지 내부에서는 프록시 접근 비용 정도만 측정할 수 있다 | 0 / 0 | SC-P-001 |
| Load/Stress | 미적용 | 부하를 가할 서버와 DB 가 패키지에 없다 (아래 재검토 후보 참조) | 0 / 0 | 없음 |
| Smoke | 적용(저비용) | package.json `exports` 11개와 tsup 후처리("use client" 추가, CSS 복사)가 있어 dist 확인 비용이 낮다 | 0 / 0 | SC-SM-001~002 |
| Chaos | 미적용 | 외부 의존(Stripe, DNS, Vercel API) 장애는 단위 테스트 모킹으로 일부 확인하며(BS-DS-02 NXDOMAIN), 장애를 주입할 인프라가 패키지에 없다 | 0 / 0 | 없음 |

### 판정 재검토 후보

- **Load/Stress**: 코드에 트랜잭션이나 잠금 없이 "확인 후 실행"하는 경로가 여러 곳 있다. `tenantService.create`(슬러그 중복 확인 후 생성), `tenantUserService.removeUser`·`updateRole`(OWNER 수 확인 후 삭제·변경), `tenantUserService.addUser`(멤버십 확인 후 생성), `domainService.addCustomDomain`(도메인 중복 확인 후 갱신)이 해당한다. 예를 들어 OWNER 2명이 서로를 동시에 제거하면 두 요청 모두 OWNER 수를 2로 읽으므로 OWNER 가 0명이 되는 상황을 코드가 막지 않는다. blog-core 에서 같은 부류의 결함이 동시 요청으로 드러난 선례가 있으므로 판정 재검토를 제안한다. 반면 `billingService.trackUsage` 는 `upsert` + `increment` 로 원자화되어 있다.

---

## 우선순위 갭

### 계획 항목 목록과 선행 조건

| 우선순위 | SC | 항목 | 선행 조건 |
|---------|----|------|---------|
| Critical | SC-A-011 | 자체 catch 라우트의 오류 응답 일관성 (TC-A-014) | [B] 부류 라우트에 적용할 오류 정책 결정 |
| Critical | SC-A-012 | 멀티 테넌트 블로그 라우트 테넌트 해석 (TC-A-015) | 없음 |
| Critical | SC-S-004 | 테넌트 프록시가 가로채지 않는 메서드 (TC-S-004) | 호스트 postTag 모델의 tenantId 컬럼 여부 확인 |
| Critical | SC-S-005 | X-Tenant-Id 헤더 신뢰 범위와 해석 불일치 (TC-S-005) | 헤더 제거 책임 소재 결정 |
| High | SC-U-014 | 관리자·온보딩 React 컴포넌트 5종 (TC-U-018~022) | jsdom·@testing-library/react 도입, `include` 에 `.tsx` 추가 |
| High | SC-U-016 | BillingService·WebhookHandler 오류 분기 (TC-U-024) | 없음 |
| High | SC-A-013 | 슈퍼 관리자 라우트 미검증 분기 (TC-A-016) | 없음 |
| High | SC-A-014 | 인증 라우트 입력 검증과 OAuth 분기 (TC-A-017) | 없음 |
| High | SC-A-015 | 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 (TC-A-018) | 호스트 스키마의 BigInt 사용 여부 확인 |
| High | SC-E-001 | OnboardingWizard 와 온보딩 라우트 계약 (TC-E-001) | 렌더링 인프라, ownerUserId 계약 결정 |
| High | SC-S-006 | 관리자 라우트의 테넌트 소속 검사 부재 (TC-S-006) | 테넌트 단위 인가 책임 소재 결정 |
| High | SC-S-007 | OAuth 콜백 계정 연결과 state 검증 (TC-S-007) | 없음 |
| High | SC-S-008 | 온보딩 샘플 게시글 HTML 입력값 삽입 (TC-S-008) | blog-core 새니타이저 동작 확인 |
| High | SC-AC-001 | 관리자 목록·폼 입력 요소 이름과 오류 알림 (TC-AC-001) | 렌더링 인프라, axe-core 기반 도구 |
| High | SC-AC-002 | 온보딩 위저드 단계·선택 상태 전달 (TC-AC-002) | 렌더링 인프라, axe-core 기반 도구 |
| High | SC-SM-001 | dist exports 서브패스 해석 (TC-SM-001) | `pnpm run build` |
| Medium | SC-U-013 | AuthService 생성 시점 설정 검증 (TC-U-017) | 없음 |
| Medium | SC-U-015 | DomainService 미검증 분기 (TC-U-023) | 없음 |
| Medium | SC-I-003 | single 모드 features 조합 (TC-I-004) | `@withwiz/blog-core/routes` 모킹 |
| Medium | SC-I-004 | multi 모드 미들웨어 노출 (TC-I-005) | 없음 |
| Medium | SC-I-005 | 온보딩 부분 실패 처리 (TC-I-006) | 고아 테넌트 허용 여부 결정 |
| Medium | SC-A-016 | 태그·댓글·블로그 관리자 라우트 미검증 핸들러 (TC-A-019) | 없음 |
| Medium | SC-E-002 | createAuthFetch 와 refresh 라우트 계약 (TC-E-002) | jsdom 도입 |
| Medium | SC-AC-003 | 대시보드·모니터 상태 표시 (TC-AC-003) | 렌더링 인프라, axe-core 기반 도구 |
| Medium | SC-SM-002 | 클라이언트 엔트리 지시문과 스타일 산출물 (TC-SM-002) | `pnpm run build` |
| Low | SC-P-001 | 테넌트 프록시 모델 접근 비용 (TC-P-001) | 기준값 측정 |

"결정" 이 선행 조건인 항목은 계획 TC 의 예상 결과를 현재 코드 동작 기준으로 적었다. 결정에 따라 코드를 수정하면 기대값도 함께 바꿔야 한다.

### 사전 조사 우선순위 4번: React 컴포넌트 5종 테스트 0건

| 컴포넌트 | 파일 | 줄 수 | export 경로 | 테스트 | 계획 TC |
|---------|------|------|-----------|-------|--------|
| SuperAdminDashboard | `src/admin/SuperAdminDashboard.tsx` | 161 | `@withwiz/blog-system/admin` | 0건 | TC-U-018, TC-AC-003 |
| SystemMonitor | `src/admin/SystemMonitor.tsx` | 159 | `@withwiz/blog-system/admin` | 0건 | TC-U-019, TC-AC-003 |
| TenantManager | `src/admin/TenantManager.tsx` | 377 | `@withwiz/blog-system/admin` | 0건 | TC-U-020, TC-AC-001 |
| UserManager | `src/admin/UserManager.tsx` | 332 | `@withwiz/blog-system/admin` | 0건 | TC-U-021, TC-AC-001 |
| OnboardingWizard | `src/onboarding/OnboardingWizard.tsx` | 346 | `@withwiz/blog-system/onboarding` | 0건 | TC-U-022, TC-AC-002, TC-E-001 |

`tests/` 전체에서 다섯 컴포넌트 이름을 검색한 결과 참조가 0건이다. 현재 인프라 상태는 다음과 같다.

- `vitest.config.ts` 에 `environment` 가 없어 기본값 `node` 로 실행된다.
- `include` 가 `tests/**/*.test.ts` 로 한정되어 `.tsx` 테스트 파일은 수집되지 않는다.
- jsdom, happy-dom, `@testing-library/react` 가 devDependencies 와 node_modules 에 없다. `pnpm-lock.yaml` 에는 vitest 의 선택적 peerDependency 선언으로만 등장한다.
- `react`, `react-dom` 19.3.0 과 `@types/react` 는 이미 devDependencies 에 있고 `tsconfig.json` 의 `jsx` 는 `react-jsx` 이다.

필요한 인프라는 jsdom(또는 happy-dom)과 `@testing-library/react` 추가, `include` 확장, 컴포넌트 테스트 파일별 `// @vitest-environment jsdom` 명시, 접근성 검사를 위한 axe-core 기반 도구 추가이다. 코드를 읽는 과정에서 테스트로 고정해야 할 동작도 확인했다.

- OnboardingWizard 는 `ownerUserId: ''` 로 제출하지만 슈퍼 관리자 온보딩 라우트는 빈 값을 400 으로 거부한다(TC-E-001).
- OnboardingWizard 의 슬러그 생성은 한글을 허용하지만 `CreateTenantSchema` 는 영소문자·숫자·하이픈만 허용하며, 온보딩 경로에는 스키마 검증이 없다(TC-U-022).
- TenantManager 의 활성 상태 변경은 응답 본문을 확인하지 않아 실패를 표시하지 않는다(TC-U-020).
- SuperAdminDashboard·SystemMonitor 의 시스템 상태 문구는 실제 점검 결과가 아닌 고정 문구이다(TC-U-018).

### 이중 존재 파일 판정

`plan-service.test.ts` 와 `webhook-handler.test.ts` 가 `tests/` 루트와 `tests/unit/` 양쪽에 있다. 두 쌍 모두 같은 소스 함수를 대상으로 하며 import 경로만 다르다. 루트 파일은 vitest 별칭 `@withwiz/blog-system/billing`(→ `src/billing/index.ts`)을, `tests/unit/` 파일은 상대 경로 `../../src/billing/*.ts` 를 사용한다.

**plan-service**

| 대상 메서드 | 루트 `tests/plan-service.test.ts` (9건) | `tests/unit/plan-service.test.ts` (5건) | 판정 |
|-----------|--------------------------------------|---------------------------------------|------|
| `create` | BS-PS-01: 결과 `name` 과 `create` 호출 여부만 확인 | 결과 6개 필드와 `create` 인자(`isActive: true` 포함) 정확 일치 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `listActive` | BS-PS-04: `findMany` 인자 확인 | `findMany` 인자와 결과 길이·순서 확인 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `getDefault` (결과 있음) | BS-PS-07: 결과 존재와 `findFirst` 인자 확인 | 결과 name·priceMonthly 와 `findFirst` 인자 확인 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `deactivate` | BS-PS-06: `update({ where, data: { isActive: false } })` | 동일한 단언 | 완전 중복 |
| `getDefault` (결과 없음) | 없음 | `null` 반환 확인 | unit 에만 존재 |
| `getById`, `update`, `mapToPlan` | BS-PS-02·03·05·08·09 | 없음 | 루트에만 존재 |

**webhook-handler**

| 이벤트 | 루트 `tests/webhook-handler.test.ts` (11건) | `tests/unit/webhook-handler.test.ts` (6건) | 판정 |
|-------|------------------------------------------|------------------------------------------|------|
| `customer.subscription.created` | BS-WH-01·06: `data.status` 부분 일치, `findFirst` where 확인 | `findFirst` 인자와 update 페이로드 전체(기간·stripeSubscriptionId 포함) 정확 일치 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `customer.subscription.updated` | BS-WH-07: `findFirst` where 만 확인 | update 페이로드 전체 정확 일치 (stripeSubscriptionId 미포함 확인) | 같은 경로, unit 쪽 단언이 더 엄격 |
| `customer.subscription.deleted` | BS-WH-08: `status 'CANCELED'` 부분 일치 | `{ status: 'CANCELED', cancelAtPeriodEnd: false }` 정확 일치 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `invoice.payment_succeeded` / `payment_failed` | BS-WH-09·10: status 부분 일치 | status 만 담은 페이로드 정확 일치 | 같은 경로, unit 쪽 단언이 더 엄격 |
| 알 수 없는 이벤트 | BS-WH-11: `resolves.not.toThrow()` | `resolves.toBeUndefined()` 와 Prisma 미호출 확인 | 같은 경로, unit 쪽 단언이 더 엄격 |
| `mapStripeStatus` 변형(past_due·canceled·trialing·기본값) | BS-WH-02~05 | 없음 | 루트에만 존재 |

**판정 결과**

- 두 쌍 모두 **부분 중복**이다. 어느 한 파일도 다른 파일의 부분집합이 아니므로 한쪽을 그대로 삭제하면 고유 케이스가 사라진다.
- plan-service 는 unit 5건 중 1건(deactivate)이 완전 중복이고, 3건은 같은 경로를 더 엄격하게 단언하며, 1건(getDefault null)만 고유하다. 루트 9건 중 5건은 고유하다.
- webhook-handler 는 unit 6건의 이벤트 시나리오가 모두 루트 파일에 있지만, unit 쪽이 페이로드 전체를 정확 일치로 단언한다. 루트는 상태 매핑 변형 4건이 고유하다.
- 통합 방향 제안: 파일별로 루트의 고유 케이스(ID 보존)와 unit 의 엄격한 단언을 한 파일에 합치고 import 경로를 하나로 정한다. 이 문서 작업에서는 파일을 수정하지 않았다.

### 추가로 확인한 유사 중복

- `tests/unit/rbac-edge-cases.test.ts` 와 `tests/tenant-user-service.test.ts`: RBAC-08 ≈ BS-TU-04, RBAC-09 ≈ BS-TU-07, RBAC-10 ≈ BS-TU-05, RBAC-05 ≈ BS-TU-11, RBAC-16 ≈ BS-TU-14 가 같은 분기를 같은 방식으로 검증한다. RBAC-03·04·06·07 은 RBAC-01 의 4×4 반복에 포함되는 조합이다.
- `tests/integration/onboarding-flow.test.ts` 와 `tests/onboarding-service.test.ts`: flow BS-OB-02 ≈ service BS-OB-05, flow BS-OB-03 ≈ service BS-OB-02, flow BS-OB-04 ≈ service BS-OB-01 이다.
- `tests/integration/blog-system-modes.test.ts` 와 `tests/blog-system-factory.test.ts`: BS-SM-01 ≈ BS-BF-01·02, BS-SM-03 ≈ BS-BF-05, BS-SM-04 ≈ BS-BF-07 이다.
- `tests/billing-helpers.test.ts` BS-BH-04 와 `tests/unit/billing-service.test.ts` 의 checkLimit 첫 케이스는 maxPosts 100, 사용량 50 이라는 같은 입력으로 `allowed true`, `max 100` 을 단언한다.

### 기타 조직 문제

- **디렉터리와 성격 불일치**: `tests/` 루트 21개 파일에 Unit·API·Integration·Security 성격이 섞여 있고, `tests/integration/` 의 라우트 테스트 5개는 루트의 tag-routes·comment-routes 와 같은 수준의 API 테스트이다.
- **import 경로 혼재**: `tests/unit/` 5개 중 billing-service·plan-service·webhook-handler 3개는 상대 경로로 소스 파일을 직접 import 한다. 이 방식은 `index.ts` 재export 를 거치지 않으므로 공개 API 경로 누락을 잡지 못한다.
- **사용되지 않는 setup 파일**: `tests/setup.ts` 는 `vitest.config.ts` 의 `setupFiles` 에 등록되어 있지 않고 어떤 테스트도 import 하지 않는다. 내용도 spec.md Task 0 의 예시와 다르다(`next/server` 모킹 없음).
- **도메인별 실행 스크립트 부재**: package.json 에 `test`, `test:watch` 만 있다.

### 확인이 필요한 사항 (테스트 범위 밖에서 발견)

- **참조 스키마와 서비스 코드의 복합 키 이름**: `src/prisma/blog-system.prisma` 의 `TenantUser` 는 `@@unique([userId, tenantId])` 로 정의되어 있어 Prisma 가 생성하는 복합 키 이름은 `userId_tenantId` 가 된다. 반면 `tenant-user-service.ts` 는 모든 조회에서 `tenantId_userId` 를 사용한다. 모든 테스트가 Prisma 를 모킹하므로 이 불일치는 드러나지 않는다. 참조 스키마 파일은 "실제 마이그레이션에 사용되지 않음"으로 표기되어 있으므로 호스트 스키마 기준으로 확인이 필요하다.
- **참조 스키마의 Subscription.tenantId `@unique`**: `createSubscription` 은 기존 구독 확인 없이 새 레코드를 만들고 `getSubscription` 은 `createdAt` 내림차순으로 최신 1건을 조회한다. 스키마대로라면 같은 테넌트의 두 번째 구독 생성은 고유 제약 위반이 된다.
- **로그인 오류 문구 차이**: 존재하지 않는 이메일과 잘못된 비밀번호는 같은 문구를 반환하지만, 비밀번호가 없는 OAuth 전용 계정은 `'비밀번호가 설정되지 않은 계정입니다. OAuth 로그인을 사용하세요.'` 를 반환하고 auth 라우트가 이 문구를 그대로 응답한다. AS-09 는 이 동작을 고정하고 있다. 계정 유형 노출을 허용할지 결정이 필요하다.

---

## 리뷰 체크리스트

- [x] 10개 도메인의 적용성을 판정하고 근거를 기록
- [x] 모든 테스트 파일(33개)을 TC 에 배정하고 누락 0개 확인
- [x] 도메인별 실행 명령의 실측 합계가 전체 실행 결과(311건)와 일치
- [x] 완료 TC 의 단계·예상 결과를 실제 `it()` 이름과 단언에서 작성
- [x] 계획 TC 의 단계·예상 결과를 대상 소스 코드 동작에 근거해 작성
- [x] 기존 ID(`BS-XX-nn`, `AS-nn`, `RBAC-nn`) 전체와 새 SC/TC ID 매핑
- [x] 오류 처리 영역(BS-ERR-01~14)을 Critical 로 분류하고 명세 변경 이력 기록
- [x] 이중 존재 파일 2쌍 비교와 판정 기록
- [x] 보안·접근성 기준 명시 (OWASP Top 10 2021, WCAG 2.1)
- [ ] 렌더링 인프라(jsdom, @testing-library/react) 도입
- [ ] 커버리지 도구 도입과 목표 커버리지 설정
- [ ] "결정" 이 선행 조건인 계획 항목의 정책 결정
- [ ] 이중 존재 파일 통합과 ID 충돌(BS-TR, BS-OB) 정리
- [ ] 계획 TC 구현 후 이 문서의 테스트 수 갱신
