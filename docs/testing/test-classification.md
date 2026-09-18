# @withwiz/blog-system 테스트 분류 체계

> 작성일: 2026-09-13. 갱신일: 2026-09-17 (브랜치 `fix/residual-defects`, 0.2.3 에 결함 수정 반영). 이 문서는 `tests/spec.md`(구현 작업 계획서)를 대신하는 현행 분류 문서이다. 모든 수치와 케이스는 기준 커밋에서 테스트를 실행하고 코드를 읽어 확인한 값만 기재했다.

## 개요

| 항목 | 내용 |
|------|------|
| 대상 | `@withwiz/blog-system` 0.2.3: 단일·멀티 테넌트 블로그 SaaS 프레임워크. 2026-09-17 판은 0.2.3 에 결함 수정 6건과 blog-core 2.1.5 의존 갱신을 더한 브랜치 `fix/residual-defects` 기준이며 버전은 올리지 않았다 |
| 범위 | `src/` 전체(core/, tenant/, auth/, billing/, onboarding/, routes/, admin/, validators/, types/)와 `tests/` 아래 테스트 파일 41개 |
| 기준 커밋 | `ae0710d` fix(routes): 관리·인증 라우트를 withAuthApi 로 감싸 역할 판정을 blog-system 인가에 맡긴다 (브랜치 `fix/residual-defects`, develop `bca172f` 에서 분기). 이전 판 기준은 `a73dbb1`(2026-09-16)·`35a6d75`(0.2.3), 초판 기준은 `52d72e1` 이다 |
| 환경 | Vitest 3.2.7, Node.js 22.22.0, pnpm 11.10.0. 테스트 환경은 `node`(vitest.config.ts 에 `environment` 미지정) |
| 의존 선언 | dependencies `@withwiz/blog-core` `^2.1.5`, devDependencies `@withwiz/toolkit` `^0.15.0`(peerDependencies 는 `>=0.11.0`). `pnpm-workspace.yaml` 의 `minimumReleaseAgeExclude` 에 `@withwiz/blog-core@2.1.5`, `@withwiz/toolkit@0.15.0` 명시 |
| 주요 설치본 | `@withwiz/toolkit` 0.15.0, `@withwiz/blog-core` 2.1.5(peer 해석으로 `@aws-sdk/client-s3` 3.1131.0 동반), `next` 16.3.4, `react` 19.3.0, `zod` 4.6.2, `stripe` 17.7.0 (`pnpm install --frozen-lockfile` 기준) |
| 수집 규칙 | `tests/**/*.test.ts` 만 수집(`.tsx` 테스트는 수집 대상이 아님), `setupFiles` 없음 |
| 렌더링 인프라 | 없음. jsdom·happy-dom·@testing-library 가 devDependencies 와 node_modules 에 존재하지 않음 |
| 목표 커버리지 | 미설정. vitest.config.ts 에 coverage 설정이 없고 `@vitest/coverage-*` 패키지도 설치되어 있지 않아 커버리지는 실측하지 못했다 |
| 실측 결과 | 파일 41개, 테스트 391개: 통과 391, 실패 0, 스킵 0 (`pnpm exec vitest run --reporter=json`, 2026-09-17). `pnpm run test` 결과도 같다 |

### 문서 갱신 이력

| 날짜 | 기준 | 실측 | 반영한 변경 |
|------|------|------|-----------|
| 2026-09-13 | `52d72e1` (package.json 버전 0.2.1) | 33개 파일, 311건 | 초판 |
| 2026-09-15 | `35a6d75` (0.2.3) | 34개 파일, 318건 | `418cf97` 0.2.2 릴리즈(버전만 변경, `52d72e1` 의 오류 처리 변경을 게시), `7b2a048` blog-core 2.1.4·toolkit 0.15.0 의존 갱신(`@aws-sdk/client-s3` 3.1130.0 → 3.1131.0 동반), `46a004a` `BlogSystemConfig.sanitizeContent` 추가와 blog-core 서비스 전달(0.2.3). 새 테스트 `tests/blog-system-sanitize-content.test.ts` 7건을 SC-I-006, TC-I-007·TC-I-008 로 추가 |
| 2026-09-16 | `a73dbb1` (브랜치 `fix/residual-defects`, 0.2.3) | 40개 파일, 381건 | `abc1010` blog-core 2.1.5 의존 갱신(범위 `^2.1.5`)과 BS-SC-08·09 추가, `bc3636e` tenant·billing·domain 라우트 인가, `cf48c45` OAuth state 검증과 미인증 이메일 연결 차단, `a32f993` 온보딩 샘플 게시글 본문 이스케이프, `2f488a5` 테넌트 프록시 누락 메서드 격리, `a73dbb1` X-Tenant-Id 헤더 불신과 테넌트 해석 단일화. 새 파일 6개(`tests/security/` 5개, `tests/api/` 1개) 61건과 기존 파일의 2건을 추가했다. 결함 확인용 TC-S-004~008 을 ✅ 완료로 전환하고 계획 TC TC-A-015 를 구현했으며, 결함 동작을 전제로 한 기존 테스트 18건의 전제·기대값·이름을 새 동작에 맞게 바꿨다 |
| 2026-09-17 | `ae0710d` (브랜치 `fix/residual-defects`, 0.2.3) | 41개 파일, 391건 | `ae0710d` 관리·인증 라우트 래퍼를 toolkit `withAdminApi` 에서 `withAuthApi` 로 교체(admin 11, tenant 11, billing 7, domain 5, auth 3). 2026-09-16 판 [확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)의 `withAdminApi` 역할 불일치를 해결로 옮겼다. 실제 toolkit 체인으로 검증하는 새 파일 `tests/integration/toolkit-wrapper-chain.test.ts` 10건을 SC-I-007, TC-I-009 로 추가했다. wrappers 목이 `withAdminApi` 만 제공하던 기존 파일 6개(TC-A-009~013, TC-S-007)의 목 이름을 `withAuthApi` 로 바꿨고 단언은 바꾸지 않았다 |

### 분류 기준

테스트 파일은 `tests/` 루트(22개), `tests/unit/`(5개), `tests/integration/`(8개), `tests/security/`(5개), `tests/api/`(1개)에 나뉘어 있다. 2026-09-16 에 추가한 `tests/security/`·`tests/api/` 와 2026-09-17 에 추가한 `tests/integration/toolkit-wrapper-chain.test.ts` 를 제외하면 디렉터리 이름이 검증 성격과 일치하지 않는다. 따라서 이 문서는 파일 위치 대신 검증 대상과 검증 방식에 따라 도메인을 정한다.

- **Unit**: 서비스·검증기·헬퍼 함수를 Prisma·Stripe·toolkit 모킹으로 검증하는 파일
- **Integration**: `createBlogSystem` 이나 온보딩 서비스처럼 여러 모듈을 조립하는 경로, 또는 실제 toolkit 미들웨어 체인과 라우트·인증 서비스를 함께 거치는 경로를 검증하는 파일
- **API**: `create*Routes` 가 반환하는 핸들러를 Request 또는 컨텍스트로 직접 호출해 상태 코드·응답 본문·서비스 위임 인자를 검증하는 파일. `tests/integration/` 의 라우트 테스트 5개와 `tests/api/` 파일도 이 도메인에 속한다
- **Security**: 테넌트 데이터 격리, 역할 인가, 인증 흐름, 저장 HTML 입력값 처리를 목적으로 하는 파일(`tenant-proxy`, `rbac-edge-cases`, `role-middleware` 와 `tests/security/` 5개)

한 파일은 한 도메인에만 속한다. 파일에 기재된 기존 ID(`BS-XX-nn`, `AS-nn`, `RBAC-nn`)는 변경하지 않았으며 [기존 ID 매핑표](#기존-id-매핑표)에서 새 SC/TC ID 와 연결한다.

결함이 수정되어 회귀 테스트가 추가된 결함 확인용 TC 는 ✅ 완료로 전환하고, TC 이름과 단계·예상 결과를 실제 테스트 기준으로 다시 쓴다. 결함 당시의 동작은 해당 TC 의 "결함 이력"에 남긴다. 2026-09-16 전환 대상은 TC-S-004~008 이며, 같은 작업에서 계획 TC 인 TC-A-015 를 구현했다. 계획 TC 없이 [확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)에만 적었던 결함을 수정할 때는 새 TC 를 ✅ 완료로 추가하고 결함 당시 동작을 "결함 이력"에 적는다. 2026-09-17 의 TC-I-009 가 해당한다.

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
| SC-I-006 | 호스트 지정 본문 새니타이저의 blog-core 서비스 전달 | Integration | High | ✅ 완료 |
| SC-I-007 | 실제 toolkit 래퍼 체인에서 관리·인증 라우트의 인증과 blog-system 역할 판정 | Integration | Critical | ✅ 완료 |
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
| SC-A-012 | 멀티 테넌트 블로그 라우트 테넌트 해석 | API | Critical | ✅ 완료 |
| SC-A-013 | 슈퍼 관리자 라우트 미검증 분기 | API | High | 🔲 계획 |
| SC-A-014 | 인증 라우트 입력 검증과 OAuth 분기 | API | High | 🔲 계획 |
| SC-A-015 | 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 | API | High | 🔲 계획 |
| SC-A-016 | 태그·댓글·블로그 관리자 라우트 미검증 핸들러 | API | Medium | 🔲 계획 |
| SC-E-001 | OnboardingWizard 제출과 슈퍼 관리자 온보딩 라우트 계약 | E2E | High | 🔲 계획 |
| SC-E-002 | createAuthFetch 토큰 갱신과 refresh 라우트 계약 | E2E | Medium | 🔲 계획 |
| SC-S-001 | 테넌트 프록시 tenantId 주입 | Security | Critical | ✅ 완료 |
| SC-S-002 | 역할 계층·OWNER 보호·크로스 테넌트 격리 | Security | Critical | ✅ 완료 |
| SC-S-003 | 테넌트 역할 인가 미들웨어 | Security | Critical | ✅ 완료 |
| SC-S-004 | 테넌트 프록시 전 메서드 격리와 격리 불가 호출 거부 | Security | Critical | ✅ 완료 |
| SC-S-005 | X-Tenant-Id 헤더 불신과 호스트명 기반 테넌트 해석 | Security | Critical | ✅ 완료 |
| SC-S-006 | 관리 라우트의 슈퍼 관리자·테넌트 소속 인가 | Security | High | ✅ 완료 |
| SC-S-007 | OAuth 콜백 state 검증과 미인증 이메일 연결 차단 | Security | High | ✅ 완료 |
| SC-S-008 | 온보딩 샘플 게시글 본문 입력값 이스케이프 | Security | High | ✅ 완료 |
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
| **테스트 데이터** | 헤더 `X-Tenant-Id: my-blog`(URL `http://localhost/api/test`), URL `http://my-blog.blog.example.com/api/test`, `http://unknown.com/api/test` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TM-01: `http://localhost/api/test` 에 `X-Tenant-Id: my-blog` 헤더 지정(`resolveFromSlug` 는 테넌트 반환) | `resolveFromSlug` 미호출, `resolve('localhost', 'blog.example.com')` 호출, `null` 반환 |
| 2 | BS-TM-02: 헤더 없음, 서브도메인 URL | `resolve` 호출, 결과 반환 |
| 3 | BS-TM-03: 호스트로 식별 실패 | `null` |
| 4 | BS-TM-04·05: 상수 확인 | `'X-Tenant-Id'`, `'X-Tenant-Slug'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 0.2.3 까지 BS-TM-01 은 `X-Tenant-Id: my-blog` 헤더 지정 시 `resolveFromSlug('my-blog')` 로 테넌트를 반환하는 동작(헤더가 호스트명보다 우선)을 고정했다. 2026-09-16 `a73dbb1` 에서 헤더를 읽지 않도록 고치면서 테스트 이름을 `X-Tenant-Id 헤더가 있어도 슬러그 조회를 하지 않고 호스트명으로 해석` 으로 바꾸고 새 동작을 단언했다(결함 이력은 TC-S-005). 두 상수는 import 호환을 위해 export 를 유지하며 `@deprecated` 로 표시했다. 함께 추가한 `createTenantResolutionMiddleware` 는 TC-S-005 가 검증한다.

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
- **비고:** `getOAuthLoginUrl`, `handleOAuthCallback` 은 AS-01 에서 함수 존재 여부만 확인한다. 두 메서드의 state 전달, 공급자 검증, 미인증 이메일 연결 차단은 TC-S-007 이 검증한다.

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

**목적:** 여러 모듈을 조립하는 경로를 검증한다. `createBlogSystem` 이 모드와 설정에 따라 어떤 서비스·라우트·미들웨어를 만드는지, 호스트 설정을 blog-core 서비스에 어떻게 전달하는지, 온보딩 서비스가 테넌트·멤버십·게시글 서비스를 어떤 순서와 인자로 호출하는지를 확인한다. blog-core 서비스 팩토리와 Stripe, toolkit 인증 모듈은 모킹한다. 단, `tests/blog-system-sanitize-content.test.ts` 는 `createBlogService` 만 실제 구현을 감싼 spy 로 두어 전달 인자와 저장값을 함께 확인한다. `tests/integration/toolkit-wrapper-chain.test.ts` 는 toolkit wrappers·인증 모듈을 모킹하지 않고 실제 미들웨어 체인과 `createAuthService` 로 발급한 JWT 를 사용하며, Prisma 와 라우트가 받는 서비스만 가짜 객체로 둔다.

**실행 명령:** 아래 명령의 실측 결과는 5개 파일, 34개 통과이다.

```bash
pnpm exec vitest run \
  tests/blog-system-factory.test.ts \
  tests/blog-system-sanitize-content.test.ts \
  tests/integration/blog-system-modes.test.ts \
  tests/integration/onboarding-flow.test.ts \
  tests/integration/toolkit-wrapper-chain.test.ts
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
- **비고:** blog-core 서비스 팩토리가 모킹되어 있어, `createScopedBlogService` 가 `createTenantProxy` 로 감싼 Prisma 를 `createBlogService` 에 전달하는지는 이 파일에서 단언하지 않는다. 0.2.3 에서 추가된 TC-I-008(BS-SC-06)이 실제 `createBlogService` 의 create·update 저장 인자에 `tenantId 'tenant-a'` 가 들어가는지 확인해 이 경로를 간접 검증한다. 스코프 프록시와 실제 `createBlogService` 의 태그 동기화 조합은 TC-S-004(BS-TX-11)가 검증한다.

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
- **비고:** 0.2.3 부터 `blogServiceConfig` 는 `modelName`, `enableTags`, `storage`, `sanitizeContent` 4개 항목으로 구성된다. 이 가운데 `sanitizeContent` 와 `modelName` 전달은 TC-I-007·TC-I-008 이 검증한다. `enableTags` 와 `storage`(7번) 전달은 여전히 테스트가 없다.

---

### TC-I-005: multi 모드 미들웨어 노출 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/blog-system-middleware.test.ts` (신규) |
| **대상** | `src/core/blog-system.ts`: 반환값 `middleware.resolveTenantFromRequest`, `middleware.requireTenantRole` |
| **우선순위** | Medium |
| **전제조건** | TC-I-001 모킹 구성, 실제 `createTenantResolver`·`createTenantUserService` 가 mock prisma 를 사용 |
| **테스트 데이터** | 요청 `http://my-blog.blog.example.com/`, `http://my-blog.localhost/`, 미들웨어 컨텍스트 `{ request: http://my-blog.blog.example.com/, user: { id: 'u-1' }, metadata: {} }`, `tenant.findFirst` 가 slug `'my-blog'` 테넌트 반환, `tenantUser.findUnique` 가 `{ role: 'VIEWER' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | `domain.baseDomain: 'blog.example.com'`, `resolveTenantFromRequest(req)` | `tenant.findFirst` 두 번째 호출이 `{ where: { slug: 'my-blog', isActive: true } }` |
| 2 | 같은 요청에 두 번째 인자 `'other.com'` 지정 | 서브도메인 추출 실패로 slug 조회 없음 |
| 3 | domain 미지정, `http://my-blog.localhost/` | baseDomain `'localhost'` 로 `slug 'my-blog'` 조회 |
| 4 | `requireTenantRole(TenantRole.EDITOR)` 미들웨어, 사용자 역할 VIEWER | 호스트명으로 테넌트를 확정한 뒤 403 응답 |
| 5 | single 모드 | `middleware.resolveTenantFromRequest`, `requireTenantRole` null |
| 6 | 두 모드 공통 | `middleware.auth`, `adminAuth`, `tenantResolver` null |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 2026-09-16 `a73dbb1` 부터 `requireTenantRole` 은 `X-Tenant-Id` 헤더 대신 호스트명으로 테넌트를 확정한 뒤 역할을 확인한다. TC-S-005(BS-TH-08)는 역할이 충분한 경로(200)와 테넌트를 찾지 못한 호스트(404)를 검증하며, 역할 부족 403 을 포함한 이 TC 의 1~6번은 여전히 계획이다.

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

### 본문 새니타이저 전달 공통 전제조건 (TC-I-007 ~ TC-I-008)

두 TC 는 같은 파일 `tests/blog-system-sanitize-content.test.ts` 에 있으며 다음 구성을 공유한다.

1. `@withwiz/blog-core/services` 를 부분 모킹한다. `createBlogService` 는 실제 구현을 감싼 `vi.fn` spy 이고, `createTagService`·`createCommentService`·`createSearchService`·`createSchedulerService` 는 `{}` 를 반환한다.
2. `@withwiz/toolkit/core/auth`, `@withwiz/toolkit/prisma/auth-adapter`, toolkit wrappers·api-helpers, `@withwiz/blog-core/validators`, `stripe` 는 TC-I-001 과 같은 방식으로 모킹한다.
3. mock prisma 는 tenant·tenantUser·user·news·subscription·plan·usageRecord delegate 를 가지며, `create`·`update` 는 전달받은 `data` 를 그대로 되돌린다. `$transaction` 은 같은 클라이언트를 콜백에 넘긴다.
4. `beforeEach` 에서 `createBlogService` spy 호출 기록을 지우고 `console.warn` 을 spy 로 막는다. 테스트 환경에는 `isomorphic-dompurify` 가 없어 blog-core 기본 새니타이저가 정규식 폴백 경고를 남기기 때문이다.
5. 기본 새니타이저 기대값은 `@withwiz/blog-core/utils` 의 실제 `sanitizeHtmlContent(RAW_CONTENT)` 로 계산한다.

---

### TC-I-007: single 모드 본문 새니타이저 전달과 저장값 적용

| 항목 | 내용 |
|------|------|
| **파일** | `tests/blog-system-sanitize-content.test.ts` (describe `single 모드`, BS-SC-01~04·08~09) |
| **대상** | `src/core/blog-system.ts`: `createBlogSystem()` 의 `blogServiceConfig.sanitizeContent` 전달 → blog-core `createBlogService().create`·`update` / `src/types/system.ts`: `BlogSystemConfig.sanitizeContent` |
| **우선순위** | High |
| **전제조건** | [공통 전제조건](#본문-새니타이저-전달-공통-전제조건-tc-i-007--tc-i-008) 1~5, `mode: 'single'`, `auth.jwtSecret` 32자 이상, `blog.modelName 'news'` |
| **테스트 데이터** | `RAW_CONTENT = '<p>hello</p><script>alert(1)</script><img src="x" onerror="alert(2)">'`, `HOST_SANITIZED = '<p>host-sanitized</p>'`, 호스트 새니타이저 `vi.fn(() => HOST_SANITIZED)`, `postInput = { title: '제목', slug: 'post-slug', category: 'notice', content: RAW_CONTENT, published: false }`, authorId `'author-1'`, `SCRIPT_ONLY = '<script>alert(1)</script>'`, 빈 값 새니타이저 `vi.fn(() => '')`·`vi.fn(() => null)` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-SC-01: `sanitizeContent` 를 지정해 single 모드 생성 | `createBlogService` 마지막 호출의 두 번째 인자 `sanitizeContent` 가 지정한 함수와 같은 참조, `modelName 'news'` |
| 2 | BS-SC-02: `blogService.create(postInput, 'author-1')` | 새니타이저가 `RAW_CONTENT` 로 호출됨, `news.create` 1회, 저장 `data.content === HOST_SANITIZED` |
| 3 | BS-SC-03: `blogService.update('post-1', { content: RAW_CONTENT })` | 새니타이저가 `RAW_CONTENT` 로 호출됨, `news.update` 1회, 저장 `data.content === HOST_SANITIZED` |
| 4 | BS-SC-04: `sanitizeContent` 미지정으로 생성한 뒤 create·update | 설정의 `sanitizeContent` 가 `undefined`, 기대값 `sanitizeHtmlContent(RAW_CONTENT)` 에 `<script` 없음, create·update 저장 `data.content` 가 모두 이 기대값과 같음 |
| 5 | BS-SC-08: 새니타이저가 `''` 반환, `create({ ...postInput, content: SCRIPT_ONLY })`·`update('post-1', { content: SCRIPT_ONLY })` | 새니타이저 2회(인자 `SCRIPT_ONLY`), create·update 저장 `data.content === ''` |
| 6 | BS-SC-09: 새니타이저가 `null` 반환, 같은 호출 | 새니타이저 2회, create·update 저장 `data.content === ''` |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (2026-09-16 실측)
- **비고:** 태그 동기화 분기(`tagIds` 지정 시 `$transaction` 안의 `postTag.createMany`)는 입력에 `tagIds` 가 없어 실행되지 않고, `enableTags`·`storage` 전달은 단언하지 않는다(TC-I-004). 5·6번은 blog-core 2.1.5 의 `sanitize(data.content) ?? ''` 동작에 의존한다. 2.1.4 의 `sanitize(data.content) || data.content` 에서는 원문 `SCRIPT_ONLY` 가 저장되어 두 테스트가 실패했다(2026-09-16 `abc1010` 에서 lockfile 을 2.1.5 로 올리기 전 실행으로 확인). 빈 값 저장 보장이 2.1.5 이상에만 있으므로 같은 커밋에서 `dependencies` 범위를 `^2.1.5` 로 올렸다.
- **관련 요구사항:** OWASP A03:2021 Injection (저장형 XSS)

---

### TC-I-008: multi 모드 테넌트 스코프 서비스의 본문 새니타이저 전달

| 항목 | 내용 |
|------|------|
| **파일** | `tests/blog-system-sanitize-content.test.ts` (describe `multi 모드`, BS-SC-05~07) |
| **대상** | `src/core/blog-system.ts`: `createScopedBlogService(tenantId)` 가 `createTenantProxy` 로 감싼 Prisma 와 `blogServiceConfig` 로 `createBlogService` 호출 |
| **우선순위** | High |
| **전제조건** | [공통 전제조건](#본문-새니타이저-전달-공통-전제조건-tc-i-007--tc-i-008) 1~5, `mode: 'multi'`(domain·billing 미지정), `auth.jwtSecret` 32자 이상, `blog.modelName 'news'` |
| **테스트 데이터** | TC-I-007 과 같은 `RAW_CONTENT`·`HOST_SANITIZED`·`postInput`, 스코프 테넌트 `'tenant-a'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-SC-05: `sanitizeContent` 를 지정해 multi 모드 생성 후 `createScopedBlogService('tenant-a')` | `createBlogService` 마지막 호출의 두 번째 인자 `sanitizeContent` 가 지정한 함수와 같은 참조, `modelName 'news'` |
| 2 | BS-SC-06: 스코프 서비스로 create 와 `update('post-1', { content: RAW_CONTENT })` | 새니타이저 2회 호출(인자 `RAW_CONTENT`), create 저장 `data.content === HOST_SANITIZED` 이고 `data.tenantId === 'tenant-a'`, update 저장 `data.content === HOST_SANITIZED` 이고 `where.tenantId === 'tenant-a'` |
| 3 | BS-SC-07: `sanitizeContent` 미지정으로 multi 모드 생성 후 스코프 서비스로 create·update | 설정의 `sanitizeContent` 가 `undefined`, create·update 저장 `data.content` 가 모두 `sanitizeHtmlContent(RAW_CONTENT)` 결과와 같음 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (현재)
- **비고:** 2번은 새니타이저 적용 뒤에도 테넌트 격리(tenantId 주입)가 유지되는지를 함께 단언하며, TC-I-002 비고의 미검증 경로를 간접 검증한다. multi 모드에서 `createBlogSystem` 이 만드는 `onboardingService` 와 블로그 라우트(`multiTenantConfig.createScopedService`)도 같은 `createScopedBlogService` 를 사용하므로 코드상 같은 새니타이저가 적용된다. 온보딩·라우트를 경유한 새니타이저 적용은 테스트하지 않는다. 온보딩 샘플 게시글 본문의 입력값 이스케이프는 TC-S-008, 멀티 테넌트 블로그 라우트의 스코프 서비스 선택은 TC-A-015 가 검증한다.
- **관련 요구사항:** OWASP A03:2021 Injection (저장형 XSS)

---

### TC-I-009: 실제 toolkit 래퍼 체인의 관리·인증 라우트 역할 판정

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/toolkit-wrapper-chain.test.ts` |
| **대상** | `src/routes/admin-routes.ts`·`tenant-routes.ts`·`billing-routes.ts`·`domain-routes.ts`·`auth-routes.ts` 의 `withAuthApi` 래퍼 → toolkit 0.15.0 `withAuthApi` 체인(`authMiddleware`, `rateLimitMiddleware.api`) → `src/routes/route-authorization.ts`: `requireSuperAdmin`·`requireTenantRole`, `admin-routes.ts`: `verifySuperAdmin` / `src/auth/auth-service.ts`: `login` 토큰 발급 |
| **우선순위** | Critical |
| **전제조건** | wrappers·`@withwiz/toolkit/core/auth` 를 모킹하지 않는다. 모듈을 불러오기 전에 `vi.hoisted` 에서 `initializeLogger({ level: 'error', fileEnabled: false, consoleEnabled: true, … })` 를 호출하고, `beforeAll` 에서 `initializeAuth({ jwtSecret, accessTokenExpiry: '15m', refreshTokenExpiry: '7d' })`(토큰 전달 방식은 기본값 hybrid)와 호출된 rate limit 종류를 기록하는 `setRateLimitAdapter` 를 호출한다. 사용자 저장소는 가짜 Prisma(`user.findUnique`·`update`·`count`·`findMany`, `tenant.count`·`findMany`)이고 비밀번호 해시는 `new PasswordHasher(4)` 로 만든다. 토큰은 실제 `createAuthService(prisma, { jwtSecret }).login` 으로 발급한다. `tenantUserService`·TenantService·BillingService·PlanService·DomainService 는 가짜 객체이다. 요청은 `NextRequest` 에 `Authorization: Bearer <token>` 헤더를 지정한다 |
| **테스트 데이터** | DB 역할 `SUPER_ADMIN`(super-1), `USER`(user-1), `null`(owner-1, 발급 토큰 역할 `USER`), `ADMIN`(toolkit-admin-1). 소속은 `t-own:owner-1 → OWNER` 이고 `t-other` 에는 소속 없음. 거부 메시지 `'슈퍼 관리자 권한이 필요합니다.'`, `'해당 테넌트에 대한 권한이 없습니다.'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-WC-01: SUPER_ADMIN 토큰으로 admin `dashboard.GET`·`tenants.list.GET` | 둘 다 200, `stats.totalTenants 2`, `listAll` 1회 |
| 2 | BS-WC-02: SUPER_ADMIN 토큰으로 tenant `list.GET`·billing `adminPlans.GET`·domain `list.GET` | 모두 200, `listAll`·`listActive`·`listCustomDomains` 각 1회 |
| 3 | BS-WC-03: USER 토큰으로 admin `dashboard.GET`·`tenants.list.GET` | 둘 다 403 `'슈퍼 관리자 권한이 필요합니다.'`, `tenant.count`·`listAll` 미호출 |
| 4 | BS-WC-04: USER 토큰과 toolkit ADMIN 토큰으로 2번 경로 | 모두 403 `'슈퍼 관리자 권한이 필요합니다.'`, 서비스 미호출 |
| 5 | BS-WC-05: owner-1 토큰으로 `t-own` 의 tenant `detail.GET`·`users.list.GET`, billing `subscription.GET`, domain `status.GET` | 모두 200, `getUserRole('t-own', 'owner-1')`, `listUsers('t-own', …)`, `getSubscription('t-own')`, `checkVerification('t-own', 'blog.own.com')` |
| 6 | BS-WC-06: 같은 토큰으로 `t-other` 의 같은 작업 | 모두 403 `'해당 테넌트에 대한 권한이 없습니다.'`, 서비스 미호출 |
| 7 | BS-WC-07: 토큰 없이 admin `dashboard.GET`, tenant `list.GET`·`detail.GET`, billing `subscription.GET`, domain `list.GET`, auth `me.GET`·`logout.POST` | 모두 401·`success false`, 서비스와 `getUserRole` 미호출 |
| 8 | BS-WC-08: USER 토큰으로 auth `me.GET`·`logout.POST`·`changePassword.POST` | `me` 200·`user { id: 'user-1', email: 'user@test.com', role: 'USER' }`, `logout` 200, `changePassword` 200·`user.update` where `{ id: 'user-1' }` |
| 9 | BS-WC-09: owner-1(DB 역할 없음) 토큰으로 `me.GET` | 200, `role 'USER'` |
| 10 | BS-WC-10: SUPER_ADMIN 의 `dashboard.GET`, owner-1 의 tenant `detail.GET`, USER 의 `me.GET` | 모두 200, 기록된 rate limit 종류 `['api', 'api', 'api']` |

- **자동화:** 가능 ✅ | **테스트 수:** 10개 (2026-09-17 실측)
- **비고:** 3·4·6번은 응답 메시지로 거부 주체를 구분한다. toolkit 역할 미들웨어는 오류 코드 40304 와 `'Access denied.'` 로 응답하고, blog-system 인가 헬퍼는 오류 코드 없이 위 메시지로 응답한다. 4번의 toolkit ADMIN 토큰은 래퍼를 바꾼 뒤에도 슈퍼 관리자 권한이 넓어지지 않았음을 확인한다. 7번의 401 은 toolkit `authMiddleware` 가 핸들러 전에 반환한다(오류 코드 40101). 따라서 목 기반 테스트의 사용자 없음 분기(BS-AR-03 의 403, BS-AZ-03 의 401)는 실제 요청에서 도달하지 않는다. `withAuthApi` 는 인증만 확인하므로 관리 핸들러는 `verifySuperAdmin`·`requireSuperAdmin`·`requireTenantRole` 을 먼저 호출해야 하며, 래퍼를 바꾼 관리 핸들러 34개가 모두 호출함을 코드에서 확인했다. 인가보다 먼저 입력 검증 400(billing `checkout`·`portal`, domain `add`·`verify`·`status`·`remove`)이나 사용자 관리 비활성 501(tenant `users.*`)을 반환하는 핸들러가 있어, 소속이 없는 로그인 사용자도 이 응답은 받는다. rate limit 은 `withAdminApi` 의 `admin` 종류(toolkit 주석 기준 분당 200회)에서 `withAuthApi` 의 `api` 종류(분당 120회)로 바뀌었다. 실제 한도는 호스트가 `setRateLimitAdapter` 로 지정한 값이다. `changePassword` 성공 경로는 auth-service 가 bcrypt 비용 12 로 새 해시를 만들어 이 파일 실행 시간의 대부분을 차지한다.
- **결함 이력:** 2026-09-16 판에서는 계획 TC 없이 [확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)에만 기록했다. `ae0710d` 이전에는 admin 11개, tenant 11개, billing 7개(checkout·portal·subscription·usage·adminPlans GET/POST/PUT), domain 5개, auth 3개(logout·me·changePassword) 핸들러는 toolkit `withAdminApi` 로 감싸져 있었다. 이 체인은 `authMiddleware` 뒤에 `adminMiddleware = createRoleMiddleware(ROLE_DEFAULTS.ADMIN_ROLE)`(`'ADMIN'` 고정 상수)를 두어 JWT 역할이 `'ADMIN'` 인 요청만 통과시킨다. blog-system 시스템 역할은 `USER`·`SUPER_ADMIN` 이고 auth-service 는 `user.role ?? 'USER'` 로 토큰을 만든다. 그래서 SUPER_ADMIN 은 슈퍼 관리자·플랫폼 수준 라우트에, 시스템 역할이 USER 인 테넌트 소유자는 자기 테넌트 관리 라우트에, 로그인 사용자는 me·logout·changePassword 에 도달하지 못했다. 테넌트 작업에는 DB 역할이 `'ADMIN'` 인 사용자만 도달했는데, 슈퍼 관리자 `users.updateRole` 은 `USER`·`SUPER_ADMIN` 만 부여할 수 있다. 라우트 테스트가 wrappers 를 통과형으로 모킹해 드러나지 않았다. 2026-09-17 `ae0710d` 에서 37개 핸들러의 래퍼를 `withAuthApi` 로 바꿨다. 수정 전 실행에서 9건이 실패했다. 성공을 기대한 경로(1·2·5·8·9·10번)는 toolkit 403(오류 코드 40304, `'Access denied.'`)이었고, 거부를 기대한 경로(3·4·6번)도 blog-system 메시지 대신 같은 toolkit 403 이었다. 7번 1건은 인증 미들웨어가 역할 미들웨어보다 앞에 있어 통과했다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

## 3. API Tests (라우트 핸들러 계약 테스트)

**목적:** 라우트 팩토리가 반환하는 핸들러를 Request 또는 `IApiContext` 로 직접 호출하여 상태 코드, 응답 본문, 서비스 위임 인자를 검증한다. 모든 파일에서 toolkit 의 `withPublicApi`·`withAuthApi`·`withAdminApi` 가 통과형으로 모킹되므로, toolkit 의 인증·오류 처리 미들웨어 자체는 이 도메인의 범위 밖이다. 실제 toolkit 체인을 거친 인증·역할 판정은 TC-I-009 가 검증한다.

라우트는 오류를 처리하는 방식에 따라 두 부류로 나뉜다.

```
[A] blog · tag · comment · search 라우트 (withPublicRoute / withAdminRoute)
서비스 예외
  → withRouteErrorHandling (src/routes/route-error.ts)
      ├─ getErrorStatus(error) 가 400~599 정수  → toErrorResponse
      │     → { success: false, error: { code?, message } } + 해당 상태 코드
      └─ 상태 코드 없음                        → 원본 예외를 그대로 다시 던짐
  → toolkit withPublicApi / withAdminApi 의 오류 처리 미들웨어가 분류 (이 패키지 테스트 범위 밖)

[B] auth · tenant · billing · domain · admin 라우트 (withPublicApi / withAuthApi 직접 사용)
서비스 예외
  → 핸들러 내부 try/catch 가 400·401·404 등 고정 상태 코드와 error.message 로 응답
  → catch 가 없는 핸들러는 예외를 그대로 전파
  (admin onboarding.create 만 isBlogErrorLike 로 BlogError 상태 코드를 보존)
```

2026-09-16 `bc3636e` 부터 [B] 부류 가운데 tenant·billing·domain 라우트는 핸들러 앞부분에서 `src/routes/route-authorization.ts` 의 `requireSuperAdmin`·`requireTenantRole` 로 인가를 확인한다. 거부 경로는 TC-S-006 이 검증하고, 이 도메인의 라우트 테스트는 요청자가 권한을 가진 전제로 작성한다. 2026-09-17 `ae0710d` 부터 [B] 부류의 인증 필요 경로는 toolkit `withAdminApi` 대신 `withAuthApi` 로 감싸며, 역할 판정은 toolkit 이 아니라 위 인가 헬퍼와 admin 라우트의 `verifySuperAdmin` 이 맡는다. 이에 맞춰 TC-A-009~013 파일의 wrappers 목 이름을 `withAuthApi` 로 바꿨고, 목이 만드는 컨텍스트와 단언은 바꾸지 않았다.

**실행 명령:** 아래 명령의 실측 결과는 12개 파일, 97개 통과이다.

```bash
pnpm exec vitest run \
  tests/route-error.test.ts tests/route-helpers.test.ts tests/tag-routes.test.ts \
  tests/comment-routes.test.ts tests/search-routes.test.ts tests/admin-routes.test.ts \
  tests/integration/auth-routes.test.ts tests/integration/billing-routes.test.ts \
  tests/integration/blog-routes.test.ts tests/integration/domain-routes.test.ts \
  tests/integration/tenant-routes.test.ts tests/api/blog-routes-multi-tenant.test.ts
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
- **명세 변경 이력:** 2026-09-13 커밋 `52d72e1` 이전(0.2.1)에는 래퍼가 상태 코드 없는 예외를 직접 500 과 일반 메시지로 응답했고, BS-ERR-06~09 는 500 응답과 내부 메시지(`hunter2`, `ECONNREFUSED`) 미노출을 단언했다. 현재 명세는 원본 재던짐을 단언하며, 내부 정보 은닉은 toolkit 오류 처리 미들웨어의 책임으로 옮겨졌다. BS-ERR-14 는 같은 커밋에서 추가되었다. 이 변경은 0.2.2(`418cf97`)로 게시되었다.
- **비고:** toolkit 이 재던져진 예외를 실제로 어떤 상태 코드로 분류하는지(P2002 → 409 등)는 이 파일이 검증하지 않는다(wrappers 가 통과형으로 모킹됨). 커밋 `52d72e1` 메시지는 toolkit 0.15.0 의 분류를 근거로 들며, `7b2a048` 이후 이 저장소의 devDependency 설치본도 `@withwiz/toolkit` 0.15.0 이다. 설치본 dist 의 Prisma 오류 매핑에 `P2002` → 상태 409 가 있는 것은 확인했으나 테스트로 고정되지는 않았다.

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
| **전제조건** | `withPublicApi` 는 user 없는 컨텍스트, `withAuthApi` 는 `{ id: 'test-user', role: 'ADMIN', email: 'user@test.com' }` 컨텍스트를 Request 로부터 생성, AuthService 모킹(email `'duplicate@test.com'`, password `'wrong'` 이면 예외) |
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
- **비고:** 입력 누락 400, refresh 실패 401, OAuth 라우트는 검증하지 않는다(TC-A-017). 2026-09-17 `ae0710d` 부터 `logout`·`me`·`changePassword` 는 `withAdminApi` 대신 `withAuthApi` 로 감싸므로 목 이름만 바꿨다. 목 컨텍스트 역할 `'ADMIN'` 과 단언은 그대로이며, 실제 체인에서 USER 토큰이 세 경로에 도달하는지는 TC-I-009 가 검증한다.

---

### TC-A-010: 테넌트 관리 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/tenant-routes.test.ts` |
| **대상** | `src/routes/tenant-routes.ts`: `createTenantRoutes()` (CreateTenantSchema 검증 포함) |
| **우선순위** | High |
| **전제조건** | `withAuthApi` 가 role `'SUPER_ADMIN'`, id `'admin-1'` 컨텍스트 생성, `tenantUserService.getUserRole` 은 t-1 에서 `admin-1` 을 OWNER, `u-2` 를 EDITOR 로 반환, `tenantService.create` 는 slug `'duplicate'` 이면 Error |
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
- **비고:** 2026-09-15 판까지 `createTenantRoutes` 는 역할·소속을 검사하지 않아 컨텍스트 역할이 결과에 영향을 주지 않았다. 2026-09-16 `bc3636e` 부터 목록·생성·비활성화는 SUPER_ADMIN, 나머지는 t-1 에 ADMIN 이상으로 소속된 사용자여야 하므로 BS-TR-04·06~10 에 멤버십 모킹을 추가했다. 단언은 바뀌지 않았다. 거부 경로는 TC-S-006 이 검증한다. 2026-09-17 `ae0710d` 에서 래퍼가 `withAuthApi` 로 바뀌어 목 이름만 바꿨다.

---

### TC-A-011: 슈퍼 관리자 라우트 권한과 집계

| 항목 | 내용 |
|------|------|
| **파일** | `tests/admin-routes.test.ts` |
| **대상** | `src/routes/admin-routes.ts`: `dashboard.GET`, `users.list.GET` (비공개 `verifySuperAdmin`, `safeCount` 간접 검증) |
| **우선순위** | High |
| **전제조건** | `withAuthApi` 통과형, `parsePagination` 은 `{ page: 1, limit: 10 }`, prisma(tenant, user, news) delegate 모킹 |
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
- **비고:** 2026-09-17 `ae0710d` 에서 11개 핸들러의 래퍼가 `withAuthApi` 로 바뀌어 목 이름만 바꿨다. 모든 핸들러는 먼저 `verifySuperAdmin` 을 호출한다. BS-AR-03 의 사용자 없음 403 은 목 컨텍스트에서만 나타나며, 실제 체인에서는 toolkit 인증 미들웨어가 401 을 먼저 반환한다(TC-I-009 7번).

---

### TC-A-012: 과금 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/billing-routes.test.ts` |
| **대상** | `src/routes/billing-routes.ts`: `plans.GET`, `checkout.POST`, `subscription.GET`, `usage.GET`, `webhook.POST` |
| **우선순위** | High |
| **전제조건** | wrappers 가 Request 로부터 컨텍스트 생성(`withAuthApi` 는 id `'admin-1'`, role `'ADMIN'`), BillingService·PlanService 모킹, 세 번째 인자 `tenantUserService.getUserRole` 은 t-1 의 `admin-1` 에 `'ADMIN'` 반환 |
| **테스트 데이터** | 활성 플랜 2건, checkout body `{ tenantId, planId, successUrl, cancelUrl }`, 헤더 `stripe-signature: sig_test_xxx` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-BI-01: `plans.GET` | 200, data 2건 |
| 2 | BS-BI-02: `checkout.POST` | 200, `data.url` 에 `'stripe.com'` 포함 |
| 3 | BS-BI-03: `subscription.GET ?tenantId=t-1` | 200, `data.status 'active'` |
| 4 | BS-BI-04: `usage.GET ?tenantId=t-1` | 200, `data.posts 42` |
| 5 | BS-BI-05: 서명 헤더를 포함한 `webhook.POST` | 200, `data.received true`, `handleWebhook` 호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 모킹 반환값은 숫자이다. 참조 스키마의 BigInt 필드가 응답 직렬화에 주는 영향은 TC-A-018 에서 계획한다. 2026-09-16 `bc3636e` 부터 checkout·subscription·usage 는 대상 테넌트에 ADMIN 이상으로 소속된 사용자만 호출할 수 있어 BS-BI-02~04 에 멤버십 모킹을 추가했다. 단언은 바뀌지 않았다. 2026-09-17 `ae0710d` 에서 인증 필요 경로의 래퍼가 `withAuthApi` 로 바뀌어 목 이름만 바꿨다.

---

### TC-A-013: 도메인 관리 라우트

| 항목 | 내용 |
|------|------|
| **파일** | `tests/integration/domain-routes.test.ts` |
| **대상** | `src/routes/domain-routes.ts`: `add.POST`, `verify.POST`, `remove.DELETE`, `list.GET` |
| **우선순위** | Medium |
| **전제조건** | `withAuthApi` 가 Request 로부터 컨텍스트 생성(id `'admin-1'`, role 은 `'ADMIN'` 이고 BS-DR-05 만 `'SUPER_ADMIN'`), DomainService 모킹, 두 번째 인자 `tenantUserService.getUserRole` 은 t-1 의 `admin-1` 에 `'ADMIN'` 반환 |
| **테스트 데이터** | `{ tenantId: 't-1', domain: 'blog.example.com' }`, `'invalid domain!!!'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-DR-01: `add.POST` 유효 body | 201, `verificationRecord.type 'CNAME'` (모킹 반환값) |
| 2 | BS-DR-02: 도메인 `'invalid domain!!!'` | 400, 메시지에 `'유효하지 않은'` 포함 |
| 3 | BS-DR-03: `verify.POST` | 200, `data.verified true` |
| 4 | BS-DR-04: `remove.DELETE ?tenantId=t-1` | 200, 메시지에 `'제거'`, `removeCustomDomain('t-1')` |
| 5 | BS-DR-05: `list.GET` | items 1건, `domain 'blog.example.com'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** BS-DR-01 의 `CNAME` 은 모킹 값이며 실제 DomainService 는 `TXT` 레코드를 반환한다(BS-DS-03). `status.GET` 핸들러의 성공 경로는 검증하지 않는다. 2026-09-16 `bc3636e` 부터 add·verify·remove 는 대상 테넌트의 ADMIN 이상 구성원, list 는 SUPER_ADMIN 만 호출할 수 있어 BS-DR-01·03~05 에 멤버십·역할 전제를 추가했다. 단언은 바뀌지 않았다. 2026-09-17 `ae0710d` 에서 래퍼가 `withAuthApi` 로 바뀌어 목 이름만 바꿨다.

---

### TC-A-014: 자체 catch 라우트의 오류 응답 일관성 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/route-error-consistency.test.ts` (신규) |
| **대상** | [B] 부류 라우트의 catch 분기: `tenant-routes.ts`, `auth-routes.ts`, `billing-routes.ts`, `admin-routes.ts` |
| **우선순위** | Critical |
| **전제조건** | wrappers 통과형 모킹, 각 서비스가 지정한 예외를 reject 하도록 모킹. 2026-09-16 인가 추가에 따라 tenant 는 SUPER_ADMIN 이면서 대상 테넌트 ADMIN 이상 구성원, billing 은 대상 테넌트 구성원인 컨텍스트와 `tenantUserService` 모킹이 필요하다 |
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

### TC-A-015: 멀티 테넌트 블로그 라우트 테넌트 해석

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/blog-routes-multi-tenant.test.ts` |
| **대상** | `src/routes/blog-routes.ts`: `createBlogRoutes(null, options, multiTenantConfig)` 의 비공개 `resolveService` → `src/tenant/tenant-middleware.ts`: `resolveTenantFromRequest` |
| **우선순위** | Critical |
| **전제조건** | `multiTenantConfig = { createScopedService: vi.fn(), tenantResolver: 4개 메서드 vi.fn, baseDomain: 'blog.example.com' }`, `withPublicApi` 는 사용자 없는 컨텍스트, `withAdminApi` 는 사용자 `{ id: 'u-1', role: 'ADMIN' }` 컨텍스트, api-helpers·blog-core validators 통과형 모킹 |
| **테스트 데이터** | 테넌트 `{ id: 't-1', slug: 'my-blog' }`, 요청 호스트 `my-blog.blog.example.com`, BlogError 형태 예외 `Object.assign(new Error('이미 사용 중인 슬러그입니다.'), { code: 'DUPLICATE_SLUG', statusCode: 409 })` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-MT-01: `resolve` 가 `null`, `public.list.GET` | 404 `'테넌트를 찾을 수 없습니다.'`, `createScopedService` 미호출 |
| 2 | BS-MT-02: `resolve` 가 테넌트 반환, `public.list.GET` | `resolve('my-blog.blog.example.com', 'blog.example.com')`, `createScopedService('t-1')` 1회, 스코프 서비스 `listPublished` 1회 |
| 3 | BS-MT-03: `admin.list.POST` 유효 body | 201, 스코프 서비스 `create(body, 'u-1')` |
| 4 | BS-MT-04: 테넌트 해석 성공, `admin.slugCheck.GET` 에 slug 없음 | 400, `createScopedService('t-1')` 호출 뒤 `checkSlugAvailable` 미호출 (테넌트 해석 뒤 검사) |
| 5 | BS-MT-05: 테넌트 해석 실패, `admin.detail.DELETE` | 404, `remove` 미호출 |
| 6 | BS-MT-06: 스코프 서비스 `create` 가 `statusCode 409` 예외 | 409, `success false`, `error.code 'DUPLICATE_SLUG'` |

- **자동화:** 가능 ✅ | **테스트 수:** 6개 (2026-09-16 실측)
- **비고:** 2026-09-16 에 계획 TC 를 계획 당시 파일 경로와 단계대로 구현했다. `X-Tenant-Id` 헤더를 사용하지 않는 계약이므로 6건 모두 `a73dbb1` 수정 전 코드에서도 통과했다. 테넌트 해석이 헤더를 무시하는지는 TC-S-005 가 실제 `createTenantResolver` 로 검증한다. multi 모드에서 `createBlogSystem` 이 만드는 블로그 라우트는 이 경로만 사용한다. 이 경로의 관리자 라우트는 `withAdminApi` 인증 외에 테넌트 소속을 확인하지 않는다([확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)).

---

### TC-A-016: 슈퍼 관리자 라우트 미검증 분기 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/super-admin-routes.test.ts` (신규) |
| **대상** | `src/routes/admin-routes.ts`: `tenants.*`, `users.detail`·`updateRole`·`deactivate`, `onboarding.create` |
| **우선순위** | High |
| **전제조건** | `withAuthApi` 통과형, SUPER_ADMIN 컨텍스트(user id `'admin-1'`) |
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
| 6 | `oauth.login.GET` provider `'google'` | 리다이렉트 응답, `Location` 헤더가 `getOAuthLoginUrl` 반환값, `oauth_state` 쿠키 설정 |
| 7 | `oauth.login.GET` 에서 `getOAuthLoginUrl` 이 throw | 500, 원문 메시지 |
| 8 | `oauth.callback.GET` 에 code 없음 | 400 `'OAuth 인증 코드가 없습니다.'` |

- **자동화:** 가능 ✅ | **테스트 수:** 0개 (계획)
- **비고:** 2026-09-16 `cf48c45` 에서 OAuth 라우트에 state 발급·대조와 콜백 공급자 검사를 추가했다. 6번의 리다이렉트·쿠키와 콜백의 state·공급자 거부는 TC-S-007(BS-OA-07~11)이 검증하므로, 이 TC 에는 1~5·7·8번이 남는다. 8번은 공급자 검사를 통과한 뒤의 분기이다.

---

### TC-A-018: 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 🔲 계획

| 항목 | 내용 |
|------|------|
| **파일** | `tests/api/billing-routes-branches.test.ts` (신규) |
| **대상** | `src/routes/billing-routes.ts`: `webhook.POST`, `checkout.POST`, `usage.GET`, `adminPlans.POST`·`PUT`, `plans.GET` |
| **우선순위** | High |
| **전제조건** | TC-A-012 와 같은 wrappers·멤버십 모킹. 2026-09-16 인가 추가에 따라 `adminPlans` 는 SUPER_ADMIN 컨텍스트, checkout·usage 는 대상 테넌트 ADMIN 이상 구성원 컨텍스트가 필요하다 |
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
| **전제조건** | 컴포넌트 공통 전제조건 1~3, `globalThis.fetch` 를 `createSuperAdminRoutes(…, onboardingService).onboarding.create.POST` 로 연결하는 어댑터(요청 body 로 컨텍스트 생성, user `{ id: 'owner-1', role: 'SUPER_ADMIN' }`), `withAuthApi` 통과형 모킹, `onboardingService.onboardTenant = vi.fn()` |
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

**목적:** 멀티 테넌트 SaaS 의 핵심 보안 경계인 테넌트 데이터 격리와 역할 기반 인가를 검증한다. OWASP Top 10 2021 기준으로 주로 A01 Broken Access Control 에 해당하며, OAuth 계정 연결(A07)과 저장 HTML 입력값 삽입(A03)을 포함한다.

**실행 명령:** 아래 명령의 실측 결과는 8개 파일, 97개 통과이다.

```bash
pnpm exec vitest run \
  tests/tenant-proxy.test.ts \
  tests/unit/rbac-edge-cases.test.ts \
  tests/role-middleware.test.ts \
  tests/security/tenant-proxy-bypass.test.ts \
  tests/security/tenant-header-trust.test.ts \
  tests/security/admin-route-authorization.test.ts \
  tests/security/oauth-callback.test.ts \
  tests/security/onboarding-sample-html.test.ts
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
- **비고:** 이 파일의 delegate 모킹은 10개 메서드만 가진다. 2026-09-16 에 확장한 메서드 격리, 테넌트 이동 거부, 원시 쿼리·배열형 트랜잭션 거부는 TC-S-004 가 검증한다. 콜백형 `$transaction` 은 옵션 인자를 원본에 함께 전달하도록 바뀌었지만 BS-TP-11 의 단언에는 영향이 없다.
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
| **전제조건** | `{ request: { headers, url }, user, metadata }` 형태 컨텍스트(테넌트는 `metadata.tenantId` 로 전달), TenantUserService 모킹 |
| **테스트 데이터** | `metadata.tenantId: 't-1'`, 요구 역할 EDITOR·ADMIN, 보유 역할 VIEWER·OWNER·없음 |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-RM-01: user 없음 | 401, `success false` |
| 2 | BS-RM-02: `metadata.tenantId` 없음 | 400 |
| 3 | BS-RM-03: VIEWER 가 ADMIN 요구 | 403, `getUserRole` 1회, `hasPermission` 미호출 |
| 4 | BS-RM-03b: `getUserRole` 이 `null` | 403 |
| 5 | BS-RM-04: OWNER 가 EDITOR 요구 | `next()` 호출, 200, `metadata.tenantRole OWNER`, `metadata.tenantId 't-1'` |

- **자동화:** 가능 ✅ | **테스트 수:** 5개 (현재)
- **비고:** 0.2.3 까지 미들웨어는 `X-Tenant-Id` 헤더를 `metadata.tenantId` 보다 먼저 읽었고, BS-RM-03·03b·04 는 헤더로 테넌트를 전달했다. 2026-09-16 `a73dbb1` 에서 헤더를 읽지 않도록 고치면서 세 테스트의 컨텍스트를 `metadata.tenantId` 로 바꾸고, BS-RM-02 의 이름을 `tenantId 헤더 없음 → 400` 에서 `확정된 metadata.tenantId 없음 → 400` 으로 바꿨다. 파일 머리말의 건수도 실제 5건으로 고쳤다. 헤더를 무시하는지는 TC-S-005 가 검증한다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-004: 테넌트 프록시 전 메서드 격리와 격리 불가 호출 거부

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/tenant-proxy-bypass.test.ts` |
| **대상** | `src/core/tenant-proxy.ts`: `createTenantProxy()` 의 메서드 분류(`WHERE_READ_METHODS`·`WHERE_DELETE_METHODS`·`WHERE_UPDATE_METHODS`·`CREATE_METHODS`·`upsert`), `assertNoTenantChange`, `REJECTED_CLIENT_METHODS`, `$transaction` 처리 / blog-core `createBlogService` 태그 동기화 |
| **우선순위** | Critical |
| **전제조건** | Prisma delegate 메서드 17종(findMany·findFirst·findFirstOrThrow·findUnique·findUniqueOrThrow·count·aggregate·groupBy·create·createMany·createManyAndReturn·upsert·update·updateMany·updateManyAndReturn·delete·deleteMany)을 가진 모킹, 클라이언트 함수 `$queryRaw`·`$queryRawUnsafe`·`$executeRaw`·`$executeRawUnsafe`·`$extends`·`$disconnect`, 콜백에 tx 를 넘기는 `$transaction`. 11번은 실제 blog-core `createBlogService(createTenantProxy(prisma, TENANT_ID), { modelName: 'news', enableTags: true })` 를 사용한다 |
| **테스트 데이터** | `TENANT_ID = 'tenant-001'`, 호출자가 넘기는 `tenantId: 'other'`, `tenant: { connect: { id: 'other' } }`, 트랜잭션 옵션 `{ isolationLevel: 'Serializable' }`, `tagIds ['tag-1']`·`['tag-2']` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TX-01: `findMany({ where: { tenantId: 'other' } })`, `create({ data: { title: 'x', tenantId: 'other' } })` | 원본 where·data 의 `tenantId === 'tenant-001'` (스프레드 순서로 덮어씀) |
| 2 | BS-TX-02: `createMany({ data: [2건], skipDuplicates: true })`, `createManyAndReturn({ data: 단일 객체 })` | 모든 항목에 `tenantId 'tenant-001'`, `skipDuplicates` 유지 |
| 3 | BS-TX-03: `upsert({ where: { id: '1' }, create, update })` | where·create 에 `tenantId`, update 는 그대로 |
| 4 | BS-TX-04: `aggregate`, `findUniqueOrThrow`, `findFirstOrThrow(undefined)`, `updateManyAndReturn` | 모두 `where.tenantId` 주입 |
| 5 | BS-TX-05: `update`·`updateMany`·`upsert.update` 의 data 가 `tenantId: 'other'` | 동기 예외(메시지에 `테넌트`), 원본 미호출 |
| 6 | BS-TX-06: `update` data 에 `tenant: { connect }` / data 에 스코프와 같은 `tenantId` | 전자는 예외와 원본 미호출, 후자는 그대로 전달 |
| 7 | BS-TX-07: 목록에 없는 모델 메서드 `findManyUnscoped` 호출 | 예외(메시지에 `격리`), 원본 미호출 |
| 8 | BS-TX-08: `$queryRaw`·`$queryRawUnsafe`·`$executeRaw`·`$executeRawUnsafe`·`$extends` 호출 | 모두 예외(`격리`), 원본 미호출. `$disconnect` 는 원본과 같은 참조 |
| 9 | BS-TX-09: `$transaction([promise])` (배열형) | 예외(메시지에 `콜백`), 원본 `$transaction` 미호출 |
| 10 | BS-TX-10: 콜백형 `$transaction(fn, options)` | 원본 두 번째 인자가 `options`, tx 의 `createMany` 에 `tenantId` 주입, tx 의 `$queryRawUnsafe` 는 예외 |
| 11 | BS-TX-11: 스코프 서비스 `create(…, tagIds ['tag-1'])` 후 `update('post-1', { tagIds: ['tag-2'] })` | `news.create` data, `postTag.createMany` 두 번의 모든 항목, `postTag.deleteMany` where 에 `tenantId 'tenant-001'` |

- **자동화:** 가능 ✅ | **테스트 수:** 11개 (2026-09-16 실측)
- **비고:** 스코프 클라이언트로 접근하는 모든 모델을 `tenantId` 컬럼이 있는 테넌트 소유 모델로 취급한다. blog-core 참조 스키마(`prisma/blog.prisma`)의 `PostTag` 에는 `tenantId` 가 없으므로, multi 모드에서 태그를 쓰는 호스트는 `postTag` 모델에 `tenantId` 를 추가해야 한다. 0.2.3 에서도 update 경로의 `postTag.deleteMany` 에 tenantId 가 주입되어 같은 조건이 필요했다. 격리는 최상위 `where`·`data`·`create` 에만 적용하며, 관계 필드의 중첩 쓰기와 `include` 로 읽는 관계 모델은 대상이 아니다([확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)). 거부는 원본을 호출하기 전에 동기 예외로 일어난다. 거부 대상 클라이언트 함수는 원본 클라이언트에 함수로 존재할 때만 거부 함수로 바뀌고, 없으면 `undefined` 를 그대로 돌려준다.
- **결함 이력:** 2026-09-13·09-15 판에서는 결함 확인용 🔲 계획 TC 였다. 0.2.3 의 프록시는 `READ_METHODS`(findMany·findFirst·findUnique·count·groupBy), `create`, `MUTATE_METHODS`(update·delete·updateMany·deleteMany)만 가로채고 나머지 함수는 `original.bind(del)` 로 그대로 호출했다. 그래서 `upsert` 의 where·create 와 `aggregate`·`createMany`·`findUniqueOrThrow`·`findFirstOrThrow` 에 tenantId 가 주입되지 않았고, `$queryRawUnsafe` 는 원본이 그대로 호출되었으며, 배열형 `$transaction` 은 배열을 콜백으로 호출해 TypeError 로 reject 되었다. blog-core 태그 동기화에서는 `postTag.deleteMany` 에만 tenantId 가 주입되고 `postTag.createMany` 에는 주입되지 않았다. update 계열 data 의 `tenantId` 변경도 막지 않았고, 콜백형 `$transaction` 의 옵션은 원본에 전달되지 않았다. 2026-09-16 `2f488a5` 에서 메서드 분류를 확장하고 격리할 수 없는 호출을 거부하도록 고쳤다. 수정 전 실행에서 1번을 제외한 10건이 실패했고, 1번은 기존에 보장되던 동작을 확인하는 테스트라 통과했다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-005: X-Tenant-Id 헤더 불신과 호스트명 기반 테넌트 해석

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/tenant-header-trust.test.ts` |
| **대상** | `src/tenant/tenant-middleware.ts`: `resolveTenantFromRequest`, `createTenantResolutionMiddleware` / `src/routes/blog-routes.ts`: 비공개 `resolveService` / `src/auth/role-middleware.ts`: `createTenantRoleMiddleware` / `src/core/blog-system.ts`: multi 모드 `middleware.requireTenantRole` |
| **우선순위** | Critical |
| **전제조건** | 실제 `createTenantResolver(mockPrisma)` 사용, `tenant.findFirst` 가 where 의 slug·customDomain 에 맞는 테넌트 반환, wrappers 통과형(`withAdminApi` 사용자 `{ id: 'u-1', role: 'ADMIN' }`). 8번은 실제 `createBlogSystem({ mode: 'multi', domain: { baseDomain } })` 과 `tenantUser.findUnique` 가 `{ role: 'OWNER' }` 반환 |
| **테스트 데이터** | baseDomain `blog.example.com`, 호스트 `tenant-a.blog.example.com`·`unknown.example.com`, 헤더 `X-Tenant-Id: tenant-b`(또는 `id-b`)·`X-Tenant-Slug: tenant-b`, 테넌트 `{ id: 'id-a', slug: 'tenant-a' }`, `{ id: 'id-b', slug: 'tenant-b' }` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-TH-01: tenant-a 호스트와 `X-Tenant-Id: tenant-b` 로 `admin.list.GET` | 200, `createScopedService('id-a')` 1회, `findFirst` 에 slug `'tenant-b'` 조회 없음 |
| 2 | BS-TH-02: 같은 호스트에 두 헤더를 지정해 `public.list.GET` | `createScopedService('id-a')`, 스코프 서비스 `listPublished` 1회 |
| 3 | BS-TH-03: `unknown.example.com` 호스트와 헤더 | 404, `createScopedService` 미호출 |
| 4 | BS-TH-04: `resolveTenantFromRequest` 에 헤더 지정(모킹 `resolveFromSlug` 는 tenant-b 반환) | `{ tenantId: 'id-a', tenant }`, `resolveFromSlug` 미호출, `resolve('tenant-a.blog.example.com', 'blog.example.com')` |
| 5 | BS-TH-05: `createTenantRoleMiddleware` 에 헤더만 있고 `metadata.tenantId` 없음 | 400, `getUserRole`·`next` 미호출 |
| 6 | BS-TH-06: 헤더 `id-b`, `metadata.tenantId 'id-a'` | `getUserRole('id-a', 'u-1')`, `next` 호출 |
| 7 | BS-TH-07: `createTenantResolutionMiddleware` 에 tenant-a 호스트와 헤더 / unknown 호스트 | 전자는 `metadata.tenantId 'id-a'`·`metadata.tenant` 기록 후 `next` 1회, 후자는 404·`metadata.tenantId` 미기록·`next` 미호출 |
| 8 | BS-TH-08: multi 모드 `requireTenantRole(ADMIN)` 에 tenant-a 호스트와 헤더 `id-b` / unknown 호스트 | 전자는 200, `tenantUser.findUnique` where `{ tenantId_userId: { tenantId: 'id-a', userId: 'u-1' } }`, 후자는 404 이고 역할 조회 추가 없음 |

- **자동화:** 가능 ✅ | **테스트 수:** 8개 (2026-09-16 실측)
- **비고:** 테넌트 해석은 `resolveTenantFromRequest` 한 곳에서 호스트명(커스텀 도메인 → 서브도메인)으로만 한다. 역할 미들웨어는 앞선 서버 측 미들웨어가 기록한 `metadata.tenantId` 만 신뢰한다. 따라서 `createTenantRoleMiddleware` 를 직접 쓰는 호스트는 2026-09-16 에 추가한 `createTenantResolutionMiddleware` 나 자체 미들웨어를 앞에 두어야 한다. multi 모드 `middleware.requireTenantRole` 은 두 미들웨어를 조합하며, 인증 정보가 없으면 테넌트를 해석하지 않고 역할 미들웨어가 401 로 응답한다. `TENANT_ID_HEADER`·`TENANT_SLUG_HEADER` 상수는 import 호환을 위해 export 를 유지하고 `@deprecated` 로 표시했다. 헤더로 테넌트를 고르는 경로는 막았지만, multi 모드 블로그 관리자 라우트가 테넌트 소속을 확인하지 않는 문제는 남아 있다([확인이 필요한 사항](#확인이-필요한-사항-테스트-범위-밖에서-발견)).
- **결함 이력:** 2026-09-13·09-15 판에서는 결함 확인용 🔲 계획 TC 였다. 0.2.3 의 `resolveTenantFromRequest` 는 `X-Tenant-Id` 헤더가 있으면 그 값을 `resolveFromSlug` 로 조회해 호스트명보다 우선했고, 해당 슬러그가 없을 때만 호스트명으로 폴백했다. `createTenantRoleMiddleware` 는 같은 헤더를 `metadata.tenantId` 보다 먼저 읽어 테넌트 ID 로 해석했다. 그 결과 tenant-a 호스트로 온 요청이 헤더만으로 tenant-b 스코프의 블로그 라우트를 사용했고, 두 모듈이 같은 헤더 값을 서로 다른 식별자(슬러그·ID)로 읽었다. 코드 주석은 이 헤더를 "신뢰할 수 있는 내부 요청용"으로 설명했지만 요청 출처 검사는 없었다. multi 모드 `requireTenantRole` 은 헤더와 metadata 가 모두 없으면 400 이었다. 2026-09-16 `a73dbb1` 에서 헤더를 읽지 않도록 고치고 해석을 한 곳으로 모았다. 수정 전 실행에서 8건이 모두 실패했다. 헤더 동작을 고정하던 BS-TM-01(TC-U-006)과 BS-RM-02~04(TC-S-003)는 새 동작으로 바꿨다.
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-006: 관리 라우트의 슈퍼 관리자·테넌트 소속 인가

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/admin-route-authorization.test.ts` |
| **대상** | `src/routes/route-authorization.ts`: `requireAuthenticatedUser`, `requireSuperAdmin`, `requireTenantRole`, `hasRoleLevel` / `src/routes/tenant-routes.ts`, `src/routes/billing-routes.ts`, `src/routes/domain-routes.ts` 의 인가 적용 / `src/routes/admin-routes.ts`: `verifySuperAdmin`(공통 `isSuperAdmin` 사용) / `src/core/blog-system.ts`: multi 모드의 `tenantUserService` 전달 |
| **우선순위** | High |
| **전제조건** | wrappers 가 `vi.hoisted` 로 바꿀 수 있는 사용자로 컨텍스트 생성(기본 `{ id: 'u-1', role: 'ADMIN' }`), `tenantUserService.getUserRole` 은 `'테넌트:사용자' → 역할` 표로 응답, 각 서비스는 `vi.fn` 모킹. 22번은 실제 `createBlogSystem({ mode: 'multi', billing, domain })` 과 `stripe` 모킹을 사용한다 |
| **테스트 데이터** | `SUPER_ADMIN = { id: 'super-1', role: 'SUPER_ADMIN' }`, 테넌트 `'t-1'`·`'t-other'`, 구성원 역할 OWNER·ADMIN·EDITOR, 제한 필드 `customDomain`·`planId`·`isActive` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-AZ-01: ADMIN(SUPER_ADMIN 아님)의 tenant `create.POST` | 403, `tenantService.create` 미호출 |
| 2 | BS-AZ-02: t-1 OWNER 이지만 SUPER_ADMIN 이 아닌 사용자의 `list.GET`·`deactivate.PATCH` | 둘 다 403, `listAll`·`deactivate` 미호출 |
| 3 | BS-AZ-03: 인증 정보 없이 `create.POST`·`settings.GET` | 둘 다 401, 서비스와 `getUserRole` 미호출 |
| 4 | BS-AZ-04: 같은 ADMIN 컨텍스트로 `createSuperAdminRoutes().tenants.create.POST` | 403 (두 라우트의 정책 일치 확인) |
| 5 | BS-AZ-05: t-1 OWNER 가 `t-other` 의 `users.updateRole.PATCH` | 403, `getUserRole('t-other', 'u-1')`, `updateRole` 미호출 |
| 6 | BS-AZ-06: EDITOR 구성원의 `settings.PUT` | 403, `updateSettings` 미호출 |
| 7 | BS-AZ-07: ADMIN 구성원의 `detail.GET`·`settings.GET`·`settings.PUT`·`users.list.GET` | 모두 200, `updateSettings('t-1', body)`, `listUsers('t-1', …)` |
| 8 | BS-AZ-08: 소속이 없는 SUPER_ADMIN 의 `settings.GET` | 403 (시스템 역할은 멤버십을 대신하지 않음) |
| 9 | BS-AZ-09: `tenantUserService` 없이 만든 tenant 라우트의 `detail.GET`·`settings.PUT` | 둘 다 403, 서비스 미호출 |
| 10 | BS-AZ-10: ADMIN 구성원이 `users.add.POST` 로 OWNER 부여 / OWNER 구성원이 부여 | 403·`addUser` 미호출 / 201, `addUser('t-1', 'u-3', OWNER)` |
| 11 | BS-AZ-11: ADMIN 구성원이 OWNER 구성원을 `updateRole`·`remove` / EDITOR 구성원을 `remove` | 403·403 / 200, `removeUser('t-1', 'editor-1')` |
| 12 | BS-AZ-12: OWNER 구성원의 `detail.PUT` 에 `customDomain`·`planId`·`isActive` 를 각각 지정 / `name` 만 지정 | 모두 403·`update` 미호출 / 200, `update('t-1', { name })` |
| 13 | BS-AZ-13: `t-other` 비소속 사용자의 billing `subscription.GET`·`usage.GET` | 둘 다 403, 조회 미호출 |
| 14 | BS-AZ-14: 비소속 사용자의 `checkout.POST`·`portal.POST` | 둘 다 403, 세션 미생성 |
| 15 | BS-AZ-15: t-1 ADMIN 구성원의 `subscription.GET` | 200, `getSubscription('t-1')` |
| 16 | BS-AZ-16: SUPER_ADMIN 이 아닌 사용자의 `adminPlans.GET`·`POST`·`PUT` / SUPER_ADMIN 의 `POST` | 모두 403 / 201, `planService.create(plan)` |
| 17 | BS-AZ-17: `tenantUserService` 없이 만든 billing 라우트의 `subscription.GET` / `plans.GET`·`webhook.POST` | 403 / 둘 다 200, `handleWebhook('{}', 'sig')` (공개 경로 유지) |
| 18 | BS-AZ-18: `t-other` 비소속 사용자의 domain `remove.DELETE` | 403, `removeCustomDomain` 미호출 |
| 19 | BS-AZ-19: body·query `tenantId: 't-other'` 로 `add.POST`·`verify.POST`·`status.GET` | 모두 403, 서비스 미호출 |
| 20 | BS-AZ-20: 경로 파라미터 `id: 't-1'` ADMIN 구성원의 `add.POST` | 201, `addCustomDomain('t-1', 'blog.example.com')` |
| 21 | BS-AZ-21: SUPER_ADMIN 이 아닌 사용자 / SUPER_ADMIN 의 domain `list.GET` | 403·`listCustomDomains` 미호출 / 200 |
| 22 | BS-AZ-22: multi 모드 시스템의 `routes.domain.remove.DELETE`·`routes.billing.subscription.GET`(비소속 `t-other`) | 둘 다 403, `tenantUser.findUnique` where `{ tenantId_userId: { tenantId: 't-other', userId: 'u-1' } }`, `tenant.findUnique`·`subscription.findFirst` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 22개 (2026-09-16 실측)
- **비고:** 인가 규칙은 다음과 같다. 플랫폼 수준 작업(tenant `list`·`create`·`deactivate`, billing `adminPlans`, domain `list`)은 SUPER_ADMIN 만 허용한다. 테넌트 수준 작업은 대상 테넌트(경로 파라미터 `id` 또는 body·query 의 `tenantId`)에 ADMIN 이상 역할로 소속된 사용자만 허용한다. 요청자는 자신보다 높은 역할을 부여하거나 그런 구성원을 변경·제거할 수 없다. 인증 정보가 없으면 401, 멤버십 서비스나 tenantId 가 없거나 권한이 없으면 403 이다. `createBillingRoutes`·`createDomainRoutes` 에 선택 인자 `tenantUserService` 를 추가했고, 이 인자 없이 만든 라우트의 테넌트 수준 작업은 403 이다. `createSuperAdminRoutes` 의 응답 동작은 바뀌지 않았다(BS-AR-03 은 여전히 사용자 없음 → 403). 이 파일의 wrappers 목은 `withAdminApi`·`withAuthApi`·`withPublicApi` 를 모두 제공하므로 2026-09-17 래퍼 교체 뒤에도 수정하지 않았고, 파일 머리말의 래퍼 이름만 `withAuthApi` 로 고쳤다. 2026-09-16 판에 별도로 남겼던 문제, 즉 실제 toolkit `withAdminApi` 가 JWT 역할 `'ADMIN'` 만 통과시켜 SUPER_ADMIN·USER 토큰이 핸들러에 도달하지 못하던 문제는 2026-09-17 `ae0710d` 에서 래퍼를 `withAuthApi` 로 바꿔 해결했고, 실제 체인은 TC-I-009 가 검증한다.
- **결함 이력:** 2026-09-13·09-15 판에서는 결함 확인용 🔲 계획 TC 였다. 0.2.3 의 `createTenantRoutes`·`createBillingRoutes`·`createDomainRoutes` 는 `withAdminApi` 인증만 거치고 역할·소속을 확인하지 않았다. role `'ADMIN'` 컨텍스트로 tenant `create.POST` 는 201 이었고, `users.updateRole.PATCH`(t-other)는 요청자 소속 확인 없이 `updateRole('t-other', …)` 를, billing `subscription.GET ?tenantId=t-other` 는 `getSubscription('t-other')` 를, domain `remove.DELETE ?tenantId=t-other` 는 `removeCustomDomain('t-other')` 를 호출했다. 같은 컨텍스트에 `createSuperAdminRoutes` 는 403 을 반환했다. 테넌트 구성원도 `detail.PUT` 으로 `customDomain`(도메인 중복 확인·DNS 인증 우회)·`planId`·`isActive` 를 바꿀 수 있었다. 2026-09-16 `bc3636e` 에서 공통 인가 헬퍼를 추가해 세 라우트에 적용했다. 수정 전 실행에서 18건이 실패했고, 4·7·15·20번 4건은 기존에도 거부되거나 권한이 있는 경로라 통과했다. 권한 확인 없이 성공하던 동작을 전제로 한 기존 라우트 테스트 13건(BS-TR-04·06~10, BS-BI-02~04, BS-DR-01·03~05)에는 멤버십·SUPER_ADMIN 전제를 추가했다(TC-A-010·TC-A-012·TC-A-013).
- **관련 요구사항:** OWASP A01:2021 Broken Access Control

---

### TC-S-007: OAuth 콜백 state 검증과 미인증 이메일 연결 차단

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/oauth-callback.test.ts` |
| **대상** | `src/auth/auth-service.ts`: `getOAuthLoginUrl(provider, state?)`, `handleOAuthCallback` / `src/routes/auth-routes.ts`: `oauth.login.GET`, `oauth.callback.GET` (toolkit `@withwiz/toolkit/core/auth/oauth/state-cookie` 사용) |
| **우선순위** | High |
| **전제조건** | 1~6번은 `@withwiz/toolkit/core/auth`(JWTService·PasswordHasher·OAuthManager 의 `getLoginUrl`·`exchangeCodeForToken`·`getUserInfo`·TokenGenerator)와 `@withwiz/toolkit/prisma/auth-adapter`(사용자·OAuth 계정 저장소)를 클래스 모킹하고 `oauthProviders.google`·`github` 를 지정한다. 7~11번은 AuthService 를 모킹하고 wrappers 를 통과형으로 두며, 요청은 `NextRequest`(쿠키 헤더 `oauth_state=…`)로 만든다 |
| **테스트 데이터** | 기존 사용자 `{ id: 'user-victim', email: 'victim@example.com' }`, 공급자 사용자 정보의 `emailVerified` false·누락·true, 로그인 요청 `https://app.example.com/api/auth/oauth/google`, 쿠키 state `'real-state'`, 쿼리 state `'forged'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-OA-01: 기존 OAuth 계정 없음, 같은 이메일 사용자 존재, `emailVerified: false` | 메시지에 `'이메일 인증'` 이 포함된 예외, OAuth 계정 생성·토큰 발급·로그인 시각 갱신 없음 |
| 2 | BS-OA-02: `emailVerified` 누락(github) | 같은 예외, OAuth 계정 생성 없음 |
| 3 | BS-OA-03: `emailVerified: true` | `oauthAccountRepo.create({ userId: 'user-victim', provider: 'google', providerAccountId: 'g-1', accessToken })`, 토큰 반환 |
| 4 | BS-OA-04: 새 이메일, `emailVerified: false` | `userRepo.create` 인자 `emailVerified: null`, 새 사용자 `user-new` 로 OAuth 계정 생성 |
| 5 | BS-OA-05: `handleOAuthCallback('kakao', 'code')` | `'지원하지 않는 OAuth 프로바이더'` 예외, 코드 교환 없음 |
| 6 | BS-OA-06: `getOAuthLoginUrl('google', 's-1')` | `getLoginUrl('google', 's-1')` 의 결과 반환 |
| 7 | BS-OA-07: HTTPS 요청으로 `oauth.login.GET` (provider google) | 302 또는 307, `getOAuthLoginUrl('google', state)` 의 state 는 16자 이상, `Location` 에 같은 state, `Set-Cookie` 에 `oauth_state=<state>`·HttpOnly·SameSite=lax·Path=/·Secure |
| 8 | BS-OA-08: 쿠키 `real-state`, 쿼리 `forged` 로 콜백 | 400, `handleOAuthCallback` 미호출, `oauth_state` 쿠키를 빈 값으로 설정 |
| 9 | BS-OA-09: 쿠키 없이 쿼리 state 만 / 쿠키만 있고 쿼리 state 없음 | 둘 다 400, `handleOAuthCallback` 미호출 |
| 10 | BS-OA-10: 쿠키와 쿼리 state 일치 | 200, `handleOAuthCallback('google', 'abc')`, 쿠키 삭제(`Max-Age=0`) |
| 11 | BS-OA-11: 콜백 provider `'kakao'` | 400 `'지원하지 않는 OAuth 프로바이더: kakao'`, `handleOAuthCallback` 미호출 |

- **자동화:** 가능 ✅ | **테스트 수:** 11개 (2026-09-16 실측)
- **비고:** state 는 toolkit `generateOAuthState()`(UUID)로 발급하고 `setOAuthStateCookie` 로 `oauth_state` 쿠키(HttpOnly, SameSite=lax, Path=/, Max-Age 600초, HTTPS 요청이면 Secure)에 저장한다. 쿠키 서명 비밀값 같은 새 설정은 필요하지 않다. 콜백은 공급자와 code 를 확인한 뒤 `validateOAuthState` 로 쿠키와 쿼리를 대조하고, 모든 응답에서 쿠키를 지운다. state 대조는 요청 쿠키에 접근하는 라우트 계층의 책임이므로, `AuthService.handleOAuthCallback` 을 직접 호출하는 호스트는 같은 대조를 직접 해야 한다. `getOAuthLoginUrl` 의 state 를 생략하면 임의 값을 만들지만 호출자가 알 수 없으므로 이 콜백 라우트의 대조에 실패한다. 미인증 이메일 차단은 toolkit `OAuthCallbackService` 와 같은 규칙(`emailVerified !== true` 이면 기존 계정에 연결하지 않음)이다. toolkit 0.15.0 공급자는 google 이 `verified_email`, github 이 이메일 존재 여부로 이 값을 채운다. 호스트 dts-ballet-homepage 는 blog-system 인증 라우트를 사용하지 않는다. 2026-09-17 `ae0710d` 에서 `createAuthRoutes` 의 인증 필요 경로가 `withAuthApi` 로 바뀌어 이 파일 wrappers 목의 `withAdminApi` 를 `withAuthApi` 로 바꿨다. 단언은 그대로이다.
- **결함 이력:** 2026-09-13·09-15 판에서는 결함 확인용 🔲 계획 TC 였다. 0.2.3 의 `getOAuthLoginUrl` 은 `TokenGenerator.generateUrlSafe(16)` 로 state 를 만들어 URL 에만 넣고 서버에 저장하지 않았으며(주석 "실제 구현에서 세션 기반으로 개선 필요"), `oauth.callback.GET ?code=abc&state=forged` 는 state 를 읽지 않고 `handleOAuthCallback('google', 'abc')` 를 호출했다. `handleOAuthCallback` 은 `emailVerified` 를 확인하지 않고 같은 이메일의 기존 사용자에게 OAuth 계정을 연결해 토큰을 발급했고, google 이외의 provider 는 github 로 바꿔 처리했으며 콜백 라우트도 provider 를 검사하지 않았다. 2026-09-16 `cf48c45` 에서 고쳤다. 수정 전 실행에서 9건이 실패했고, 3·4번은 기존 동작을 확인하는 테스트라 통과했다.
- **관련 요구사항:** OWASP A07:2021 Identification and Authentication Failures

---

### TC-S-008: 온보딩 샘플 게시글 본문 입력값 이스케이프

| 항목 | 내용 |
|------|------|
| **파일** | `tests/security/onboarding-sample-html.test.ts` |
| **대상** | `src/onboarding/onboarding-service.ts`: 샘플 게시글 `content`·`title`·`excerpt` 생성과 비공개 `escapeHtml` |
| **우선순위** | High |
| **전제조건** | TenantService·TenantUserService·BlogService 를 `vi.fn` 객체로 모킹, `createScopedBlogService` 는 모킹 BlogService 반환, `createSamplePost: true` |
| **테스트 데이터** | `tenantName` `'<img src=x onerror=alert(1)>'`, `` `Tom & "Jerry" 's` ``, `'Tom & Jerry'` |

| # | 단계 | 예상 결과 |
|---|------|---------|
| 1 | BS-OH-01: 태그가 포함된 이름으로 `onboardTenant` | `blogService.create` 첫 인자 `content` 에 `<strong>&lt;img src=x onerror=alert(1)&gt;</strong>` 포함, `<img` 없음 |
| 2 | BS-OH-02: `& " '` 가 포함된 이름 | `content` 에 `<strong>Tom &amp; &quot;Jerry&quot; &#39;s</strong>` 포함 |
| 3 | BS-OH-03: `'Tom & Jerry'` | `title`·`excerpt` 는 원문 그대로, `content` 는 `<h2>안녕하세요!</h2><p><strong>` 로 시작 |

- **자동화:** 가능 ✅ | **테스트 수:** 3개 (2026-09-16 실측)
- **비고:** HTML 인 `content` 에 삽입하는 값만 이스케이프한다. `title`·`excerpt` 는 텍스트 필드이고 blog-core 2.1.5 컴포넌트는 `content` 만 `dangerouslySetInnerHTML` 로 출력하므로 원문을 유지한다. 저장 시점에 이스케이프하면 제목이 `Tom &amp; Jerry` 처럼 표시된다. 호스트가 제목·요약을 HTML 로 출력한다면 출력 시 이스케이프해야 하며, 이는 관리자 API 로 만든 일반 게시글과 같은 조건이다. 이스케이프한 본문에도 blog-core 새니타이저(`config.sanitizeContent ?? sanitizeHtmlContent`)가 저장 전에 적용된다. 슈퍼 관리자 온보딩 라우트는 여전히 `tenantName` 형식을 검증하지 않는다.
- **결함 이력:** 2026-09-13·09-15 판에서는 결함 확인용 🔲 계획 TC 였다. 0.2.3 은 `tenantName` 을 content 템플릿 `<p><strong>${data.tenantName}</strong> …` 에 그대로 넣어, `<img src=x onerror=alert(1)>` 가 저장 HTML 의 요소가 되었고 방어는 blog-core 새니타이저에만 의존했다. 2026-09-16 `a32f993` 에서 content 에 삽입하는 값을 이스케이프했다. 수정 전 실행에서 1·2번 2건이 실패했고, 3번은 기존 동작을 확인하는 테스트라 통과했다. 계획 단계 2번은 title·excerpt 에도 원문이 들어간다는 점을 기록했으나, 두 필드는 텍스트 필드이므로 이스케이프 대상에서 제외했다.
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
| **Integration** | 5개 | 34개 | 7 (4/3) | 9 (6/3) | +3개 |
| **API** | 12개 | 97개 | 16 (11/5) | 19 (14/5) | +5개 |
| **E2E** | 0개 | 0개 | 2 (0/2) | 2 (0/2) | +2개 |
| **Security** | 8개 | 97개 | 8 (8/0) | 8 (8/0) | 없음 |
| **Performance** | 0개 | 0개 | 1 (0/1) | 1 (0/1) | +1개 |
| **Accessibility** | 0개 | 0개 | 3 (0/3) | 3 (0/3) | +3개 |
| **Smoke** | 0개 | 0개 | 2 (0/2) | 2 (0/2) | +2개 |
| **Load/Stress** | 0개 | 0개 | 0 | 0 | 없음 |
| **Chaos** | 0개 | 0개 | 0 | 0 | 없음 |
| **합계** | **41개** | **391개** | **55 (35/20)** | **68 (44/24)** | **+24개** |

- 계획 TC 의 테스트 수는 추측하지 않고 0개로 기재했다. 구현 후 실측값으로 갱신한다.
- 파일 누락 대조: `find tests -name "*.test.ts"` 결과 41개와 이 문서의 도메인별 실행 명령에 포함된 파일 41개를 비교한 결과, 누락 0개와 중복 배정 0개를 확인했다. 도메인별 실행 결과의 합(163 + 34 + 97 + 97)도 전체 실행 결과 391과 일치한다(2026-09-17 실측).
- 2026-09-15 갱신에서 🔲 계획 TC 가운데 새 테스트로 완료된 항목은 없다. `tests/blog-system-sanitize-content.test.ts` 는 기존 계획 TC 의 단계와 겹치지 않아 SC-I-006, TC-I-007·TC-I-008 을 새로 추가했다. 완료 TC 35개는 모두 실제 테스트 파일과 기존 ID 가 존재하고 테스트 수가 실측과 일치함을 다시 대조했다.
- 2026-09-16 갱신에서 결함 확인용 TC-S-004~008 을 ✅ 완료로 전환하고 계획 TC 인 TC-A-015 를 구현했다. 새 파일 6개(61건)와 기존 파일에 추가한 BS-SC-08·09(2건)는 모두 기존 SC·TC 에 배정했으며 새 SC·TC 는 없다. 완료 TC 43개의 테스트 수를 실측과 다시 대조했다.
- 2026-09-17 갱신에서 `withAdminApi` 역할 불일치 수정의 회귀 테스트 파일 1개(10건)를 새 SC-I-007, TC-I-009 로 추가했다. 기존 계획 TC 가운데 이 파일로 완료된 항목은 없다. 래퍼 교체로 목 이름만 바꾼 기존 파일 6개는 테스트 수가 바뀌지 않았다. 완료 TC 44개의 테스트 수를 실측과 다시 대조했다.

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
| BS-SC-01~04, 08~09 ③ | `tests/blog-system-sanitize-content.test.ts` (describe `single 모드`) | 6 | TC-I-007 | SC-I-006 | 미수록 |
| BS-SC-05~07 ③ | `tests/blog-system-sanitize-content.test.ts` (describe `multi 모드`) | 3 | TC-I-008 | SC-I-006 | 미수록 |
| BS-WC-01~10 | `tests/integration/toolkit-wrapper-chain.test.ts` | 10 | TC-I-009 | SC-I-007 | 미수록 |
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
| BS-MT-01~06 | `tests/api/blog-routes-multi-tenant.test.ts` | 6 | TC-A-015 | SC-A-012 | 미수록 |
| BS-TP-01~19 | `tests/tenant-proxy.test.ts` | 19 | TC-S-001 | SC-S-001 | Task 2 (01~14 만 수록) |
| RBAC-01~18 | `tests/unit/rbac-edge-cases.test.ts` | 18 | TC-S-002 | SC-S-002 | 미수록 |
| BS-RM-01, 02, 03, 03b, 04 | `tests/role-middleware.test.ts` | 5 | TC-S-003 | SC-S-003 | Task 9 (03b 미수록) |
| BS-TX-01~11 | `tests/security/tenant-proxy-bypass.test.ts` | 11 | TC-S-004 | SC-S-004 | 미수록 |
| BS-TH-01~08 | `tests/security/tenant-header-trust.test.ts` | 8 | TC-S-005 | SC-S-005 | 미수록 |
| BS-AZ-01~22 | `tests/security/admin-route-authorization.test.ts` | 22 | TC-S-006 | SC-S-006 | 미수록 |
| BS-OA-01~11 | `tests/security/oauth-callback.test.ts` | 11 | TC-S-007 | SC-S-007 | 미수록 |
| BS-OH-01~03 | `tests/security/onboarding-sample-html.test.ts` | 3 | TC-S-008 | SC-S-008 | 미수록 |
| **합계** | 41개 파일 | **391** | 44 | 35 | |

### ID 체계 불일치 사항

- **ID 충돌 ①**: `BS-TR` 접두어가 3개 파일에서 서로 다른 대상에 쓰인다. tenant-resolver(01~09), tag-routes(01~07), integration/tenant-routes(01~10)이며, `tests/spec.md` 는 BS-TR 을 tenant-resolver 로 정의한다.
- **ID 충돌 ②**: `BS-OB-01~04` 가 onboarding-service 와 integration/onboarding-flow 에 모두 존재하며 케이스 내용이 서로 다르다.
- **표기 유사 ③**: `BS-SC-01~09`(0.2.3 에 01~07, 2026-09-16 에 08·09 추가)는 다른 파일과 충돌하지 않지만, 이 문서의 시나리오 ID(`SC-U-…`, `SC-I-…` 등)와 표기가 비슷하다. `BS-SC-nn` 은 테스트 이름의 기존 ID 이고 이 문서의 시나리오는 SC-I-006 이다.
- **ID 체계 혼재**: `BS-XX-nn`(36개 파일), `AS-nn`(auth-service), `RBAC-nn`(rbac-edge-cases) 세 체계가 공존하고, `tests/unit/` 의 billing-service·plan-service·webhook-handler 3개 파일에는 ID 가 없다.
- **파일 머리말 수치 차이**: tenant-proxy 머리말은 "(14건)"이지만 실제 19건이다. role-middleware 머리말의 "(4건)"은 2026-09-16 에 실제 건수인 "(5건)"으로 고쳤다. spec.md Task 17 커밋 문구는 "5건"이지만 표와 실제 테스트는 6건이다.
- **기대값 차이**: spec.md 는 BS-BH-06 을 "api_calls → 10000 (또는 기본값)"으로 적었으나 테스트와 코드는 `Number.MAX_SAFE_INTEGER` 이다. spec.md 는 BS-DS-01 을 "token 없음 → null"로 적었으나 테스트는 `checkVerification` 예외를 단언한다.
- **spec.md 전제 차이**: spec.md 는 모노레포 경로(`packages/blog-system/…`), `--project blog-system`, `setupFiles` 등록을 전제로 하지만 현재 저장소는 단일 패키지이고 `vitest.config.ts` 에 projects·setupFiles 가 없다. Definition of Done 의 "~148건 이상"과 달리 실측은 391건이다(초판 기준 311건).

---

## 도메인 적용성 판정

사전 조사 문서(`WITHWIZ_PACKAGES_TEST_AUDIT.md`, 2026-09-13)의 판정표에서 blog-system 열을 옮기고, 이번에 코드를 읽어 확인한 근거를 덧붙였다.

| 도메인 | 사전 조사 판정 | 근거 (코드 확인) | 현재 파일/테스트 | 이 문서의 SC |
|--------|--------------|----------------|---------------|------------|
| Unit | 적용 | 서비스·검증기·헬퍼가 `create*` 팩토리로 분리되어 Prisma delegate 모킹만으로 검증할 수 있다 | 16 / 163 | SC-U-001~016 |
| API | 적용 | 라우트 9종이 `create*Routes` 팩토리로 핸들러를 반환하므로(scheduler 라우트는 blog-core 재export) Request 기반 계약 검증이 가능하다 | 12 / 97 | SC-A-001~016 |
| Integration | 적용 | `createBlogSystem` 이 mode·billing·domain·features 설정에 따라 서비스·라우트·미들웨어를 조립하는 분기가 있고, `storage`·`sanitizeContent` 같은 호스트 설정을 blog-core 서비스에 전달한다. 라우트는 toolkit 미들웨어 체인과 blog-system 인가 헬퍼를 함께 거치므로 두 계층의 역할 체계가 맞는지는 조립 상태에서만 확인할 수 있다 | 5 / 34 | SC-I-001~007 |
| E2E | 제한적 | 호스트 앱이 없어 브라우저 여정은 범위 밖이며, 동봉된 클라이언트 모듈(OnboardingWizard, createAuthFetch)과 서버 라우트 사이의 계약으로 한정한다 | 0 / 0 | SC-E-001~002 |
| Security | 적용(우선) | `createTenantProxy` 의 tenantId 주입과 격리 불가 호출 거부, `ROLE_LEVELS` 기반 인가, 관리 라우트의 슈퍼 관리자·테넌트 소속 인가, 호스트명 기반 테넌트 해석이 멀티 테넌트 격리의 핵심 경로이다 | 8 / 97 | SC-S-001~008 |
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
| High | SC-U-014 | 관리자·온보딩 React 컴포넌트 5종 (TC-U-018~022) | jsdom·@testing-library/react 도입, `include` 에 `.tsx` 추가 |
| High | SC-U-016 | BillingService·WebhookHandler 오류 분기 (TC-U-024) | 없음 |
| High | SC-A-013 | 슈퍼 관리자 라우트 미검증 분기 (TC-A-016) | 없음 |
| High | SC-A-014 | 인증 라우트 입력 검증과 OAuth 분기 (TC-A-017) | 없음 |
| High | SC-A-015 | 과금 라우트 웹훅 서명·관리자 요금제·BigInt 직렬화 (TC-A-018) | 호스트 스키마의 BigInt 사용 여부 확인 |
| High | SC-E-001 | OnboardingWizard 와 온보딩 라우트 계약 (TC-E-001) | 렌더링 인프라, ownerUserId 계약 결정 |
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

2026-09-16 에 SC-A-012, SC-S-004~008 을 완료해 표에서 뺐다. 이 가운데 SC-S-004~006 의 선행 조건이던 결정은 다음과 같이 정했다. 스코프 클라이언트로 접근하는 모든 모델을 테넌트 소유로 취급한다(호스트 `postTag` 에도 `tenantId` 필요). 요청 헤더는 신뢰하지 않고 호스트명으로만 테넌트를 해석한다. 테넌트 단위 인가는 호스트에 맡기지 않고 패키지 라우트가 직접 확인한다. 2026-09-17 에는 관리·인증 라우트의 역할 판정을 toolkit 래퍼의 고정 역할이 아닌 blog-system 인가 헬퍼에 맡기기로 정하고, 래퍼를 인증만 확인하는 `withAuthApi` 로 바꿨다(TC-I-009).

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

- OnboardingWizard 는 `ownerUserId: ''` 로 제출하지만 슈퍼 관리자 온보딩 라우트는 빈 값을 400 으로 거부한다(TC-E-001). 2026-09-16 에 위저드와 같은 본문으로 `onboarding.create.POST` 를 임시 테스트로 다시 실행해 400 `'tenantName, tenantSlug, ownerUserId는 필수입니다.'` 와 `onboardTenant` 미호출을 확인했다(수정하지 않음).
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

- **디렉터리와 성격 불일치**: `tests/` 루트 22개 파일에 Unit·API·Integration·Security 성격이 섞여 있고, `tests/integration/` 의 라우트 테스트 5개는 루트의 tag-routes·comment-routes 와 같은 수준의 API 테스트이다. 2026-09-16 에 추가한 파일은 계획 경로대로 `tests/security/`·`tests/api/` 에 두어 도메인과 디렉터리를 맞췄고, 2026-09-17 에 추가한 `tests/integration/toolkit-wrapper-chain.test.ts` 도 Integration 도메인과 디렉터리가 일치한다.
- **import 경로 혼재**: `tests/unit/` 5개 중 billing-service·plan-service·webhook-handler 3개는 상대 경로로 소스 파일을 직접 import 한다. 이 방식은 `index.ts` 재export 를 거치지 않으므로 공개 API 경로 누락을 잡지 못한다.
- **사용되지 않는 setup 파일**: `tests/setup.ts` 는 `vitest.config.ts` 의 `setupFiles` 에 등록되어 있지 않고 어떤 테스트도 import 하지 않는다. 내용도 spec.md Task 0 의 예시와 다르다(`next/server` 모킹 없음).
- **도메인별 실행 스크립트 부재**: package.json 에 `test`, `test:watch` 만 있다.

### 확인이 필요한 사항 (테스트 범위 밖에서 발견)

- **참조 스키마와 서비스 코드의 복합 키 이름**: `src/prisma/blog-system.prisma` 의 `TenantUser` 는 `@@unique([userId, tenantId])` 로 정의되어 있어 Prisma 가 생성하는 복합 키 이름은 `userId_tenantId` 가 된다. 반면 `tenant-user-service.ts` 는 모든 조회에서 `tenantId_userId` 를 사용한다. 모든 테스트가 Prisma 를 모킹하므로 이 불일치는 드러나지 않는다. 참조 스키마 파일은 "실제 마이그레이션에 사용되지 않음"으로 표기되어 있으므로 호스트 스키마 기준으로 확인이 필요하다. 2026-09-16 에 다시 확인한 결과 불일치가 그대로 남아 있다.
- **참조 스키마의 Subscription.tenantId `@unique`**: `createSubscription` 은 기존 구독 확인 없이 새 레코드를 만들고 `getSubscription` 은 `createdAt` 내림차순으로 최신 1건을 조회한다. 스키마대로라면 같은 테넌트의 두 번째 구독 생성은 고유 제약 위반이 된다. 2026-09-16 재확인에서도 `createSubscription` 은 `subscription.create` 를 그대로 호출한다.
- **로그인 오류 문구 차이**: 존재하지 않는 이메일과 잘못된 비밀번호는 같은 문구를 반환하지만, 비밀번호가 없는 OAuth 전용 계정은 `'비밀번호가 설정되지 않은 계정입니다. OAuth 로그인을 사용하세요.'` 를 반환하고 auth 라우트가 이 문구를 그대로 응답한다. AS-09 는 이 동작을 고정하고 있다. 계정 유형 노출을 허용할지 결정이 필요하다. 2026-09-16 재확인에서도 문구가 같다.
- **새니타이저가 빈 값을 반환할 때 원문 저장 (해결)**: blog-core 2.1.4 의 `createBlogService` 는 `create`·`update` 에서 `sanitize(data.content) || data.content` 로 저장값을 정해, 새니타이저가 `''` 또는 `null` 을 반환하면(예: `<script>alert(1)</script>` 만 있는 본문) 원문이 저장되었다. blog-core 2.1.5(`b47b2f7`)가 `sanitize(data.content) ?? ''` 로 고쳤다. 2026-09-16 `abc1010` 에서 이 저장소의 개발 lockfile 을 2.1.5 로 올리고 `dependencies` 범위를 `^2.1.5` 로 올렸으며, BS-SC-08·09 로 빈 값 저장을 검증했다(TC-I-007). 두 테스트는 2.1.4 에서 실패했다.
- **toolkit `withAdminApi` 역할과 blog-system 역할의 불일치 (해결)**: 2026-09-16 에 코드를 읽어 확인한 항목이다. toolkit 0.15.0 의 `withAdminApi` 체인은 `adminMiddleware = createRoleMiddleware('ADMIN')` 을 사용해 JWT 역할이 `'ADMIN'` 인 요청만 통과시킨다. blog-system 의 시스템 역할은 `USER`·`SUPER_ADMIN` 이고 `createAuthService` 는 사용자 `role` 로 토큰을 만든다. 그래서 실제 체인에서는 SUPER_ADMIN 토큰이 슈퍼 관리자 라우트 핸들러에 도달하기 전에 403 이 되었고, 시스템 역할이 USER 인 테넌트 구성원은 테넌트 관리 라우트에, 로그인 사용자는 auth `logout`·`me`·`changePassword` 에 도달하지 못했다. 2026-09-17 `ae0710d` 에서 admin·tenant·billing·domain·auth 라우트의 37개 핸들러를 `withAuthApi` 로 감싸 역할 판정을 blog-system 인가 헬퍼에 맡겼고, 실제 toolkit 체인으로 TC-I-009 에서 검증했다. 공개 타입의 `ReturnType<typeof withAdminApi>` 는 `withAuthApi` 로 바꿨으며 두 래퍼의 반환 시그니처는 같다. 이 라우트들의 rate limit 종류는 `admin` 에서 `api` 로 바뀌었다.


다음 항목은 2026-09-16·09-17 결함 수정 중에 코드를 읽어 확인했으며 이번에는 고치지 않았다.

- **multi 모드 블로그 관리자 라우트의 테넌트 소속 검사 부재**: `createBlogRoutes` 의 multiTenantConfig 경로는 호스트명으로 테넌트를 해석한 뒤 `withAdminApi` 인증만 확인한다. 헤더로 테넌트를 고르는 경로는 막았지만(TC-S-005), 관리자 토큰이 있으면 다른 테넌트의 호스트로 요청해 그 테넌트의 게시글을 변경할 수 있다. 콘텐츠 작업별 필요 역할(EDITOR·ADMIN)을 정해야 하므로 고치지 않았다.
- **블로그·태그·댓글 관리자 라우트에 남은 `withAdminApi` 고정 역할**: 2026-09-17 래퍼 교체는 admin·tenant·billing·domain·auth 라우트만 대상으로 했다. `createBlogRoutes`(두 모드)·`createTagRoutes`·`createCommentRoutes`(single 모드 전용)의 관리자 경로와 `withAdminRoute` 는 여전히 `withAdminApi` 이므로 JWT 역할이 `'ADMIN'` 이어야 한다. multi 모드의 슈퍼 관리자 `users.updateRole` 은 `USER`·`SUPER_ADMIN` 만 부여하므로, DB 역할을 직접 `'ADMIN'` 으로 두지 않는 한 blog-system 토큰으로 블로그 관리자 라우트에 도달할 수 없다. single 모드 호스트(dts-ballet-homepage)는 `Role` enum 에 `ADMIN` 이 있고 blog·tag·comment 관리자 라우트를 `'ADMIN'` 역할 토큰으로 사용하므로 그대로 두었다. multi 모드에서 `withAuthApi` 로 바꾸려면 위 항목의 테넌트 소속 검사를 먼저 추가해야 한다. 그렇지 않으면 로그인한 모든 사용자에게 열린다.
- **인가보다 앞선 입력 검증·비활성 응답**: billing `checkout`·`portal`, domain `add`·`verify`·`status`·`remove` 는 필수 입력을 검사해 400 을 반환한 뒤에 `requireTenantRole` 을 호출하고, tenant `users.*` 는 `tenantUserService` 가 없으면 501 을 먼저 반환한다. 2026-09-17 래퍼 교체 뒤에는 소속이 없는 로그인 사용자도 이 응답을 받는다. 데이터는 노출되지 않지만 인가를 입력 검증보다 앞에 둘지 결정이 필요하다.
- **커스텀 도메인 인증 전 활성화**: `domainService.addCustomDomain` 은 DNS TXT 인증 전에 `tenant.customDomain` 을 설정하고, `createTenantResolver.resolveFromCustomDomain` 은 인증 상태를 확인하지 않는다. `tenant settings.PUT` 은 본문의 `domainVerification` 을 그대로 저장한다(`updateSettings` 가 지정값을 우선). 2026-09-16 에 테넌트 구성원의 `detail.PUT` 으로 `customDomain` 을 바꾸는 경로는 막았지만 인증 흐름은 바꾸지 않았다.
- **슈퍼 관리자 `tenants.update.PUT` 입력 검증 없음**: `createSuperAdminRoutes` 는 본문을 스키마 검증 없이 `tenantService.update` 에 넘기므로, 다른 테넌트와의 중복 확인 없이 `customDomain` 을 설정할 수 있다.
- **스코프 프록시의 중첩 쓰기**: `createTenantProxy` 는 최상위 `where`·`data`·`create` 에만 tenantId 를 적용한다. 관계 필드의 중첩 `create`·`connect` 와 `include` 로 읽는 관계 모델에는 적용하지 않는다. blog-core 서비스는 태그를 `postTag.createMany` 로 따로 쓰므로 현재 경로에는 해당하지 않는다(TC-S-004).

---

## 리뷰 체크리스트

- [x] 10개 도메인의 적용성을 판정하고 근거를 기록
- [x] 모든 테스트 파일(41개)을 TC 에 배정하고 누락 0개 확인
- [x] 도메인별 실행 명령의 실측 합계가 전체 실행 결과(391건)와 일치
- [x] 0.2.2~0.2.3 변경(의존 갱신, `sanitizeContent` 전달)을 반영하고 새 테스트를 SC-I-006, TC-I-007·TC-I-008 로 배정
- [x] 2026-09-16 결함 수정 5건과 blog-core 2.1.5 갱신을 반영하고, 결함 확인용 TC-S-004~008 을 ✅ 완료로 전환해 결함 당시 동작을 "결함 이력"에 기록
- [x] 결함 동작을 전제로 한 기존 테스트 18건(BS-TR-04·06~10, BS-BI-02~04, BS-DR-01·03~05, BS-TM-01, BS-RM-02~04)의 변경 내용을 해당 TC 비고에 기록
- [x] 2026-09-17 `withAdminApi` 역할 불일치 수정을 반영해 새 TC-I-009 에 결함 이력을 기록하고, wrappers 목 이름만 바꾼 기존 파일 6개를 해당 TC 비고에 기록
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
