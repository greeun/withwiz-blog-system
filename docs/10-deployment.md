# 10. 배포 (Deployment)

## 환경변수

### 필수 (공통)

```bash
# 데이터베이스
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
DIRECT_URL=postgresql://user:pass@host:5432/db  # 마이그레이션용 (Supabase PgBouncer 바이패스)

# JWT
JWT_SECRET=<openssl rand -base64 48>          # 최소 32자
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 사이트 URL
NEXT_PUBLIC_SITE_URL=https://your-blog.example.com
NEXT_PUBLIC_APP_URL=https://your-blog.example.com
```

### OAuth (선택)

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-blog.example.com/api/auth/oauth/google/callback

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=https://your-blog.example.com/api/auth/oauth/github/callback
```

### 예약 발행 Cron (선택)

```bash
CRON_SECRET=<openssl rand -hex 32>            # Cron HTTP 트리거 인증
```

### Stripe — 멀티 테넌트 과금 (선택)

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 커스텀 도메인 (선택, Vercel 배포 시)

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
# 1. 스키마 적용
npx prisma migrate deploy

# 2. (선택) FTS 마이그레이션 — packages/blog-core/prisma/migrations/fulltext-search.sql
psql "$DATABASE_URL" -f packages/blog-core/prisma/migrations/fulltext-search.sql

# 3. 초기 슈퍼 어드민 생성 (멀티 모드)
psql "$DATABASE_URL" -c "UPDATE users SET system_role='SUPER_ADMIN' WHERE email='ops@example.com';"
```

### Supabase 사용 시

`unaccent` 확장은 SQL Editor에서 활성화.

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

## Stripe 웹훅 설정

1. Stripe Dashboard → Webhooks → **Add endpoint**
2. URL: `https://your-domain.com/api/webhooks/stripe`
3. 이벤트 선택:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. 발급된 **Signing secret**을 `STRIPE_WEBHOOK_SECRET`에 설정

### 로컬 테스트

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# → whsec_로 시작하는 secret 출력 → .env.local에 복사
```

## Cron 설정 (크로스 플랫폼)

예약 발행 cron은 어떤 플랫폼에서도 구동 가능하다. 자세한 예는
[../../blog-core/docs/07-scheduler.md](../../blog-core/docs/07-scheduler.md) 참조.

### 추천 조합

| 호스팅 | 추천 Cron |
|---|---|
| Vercel | Vercel Cron (`vercel.json`) |
| AWS ECS/Fargate | EventBridge → Lambda → HTTP 호출 |
| GCP Cloud Run | Cloud Scheduler → HTTP |
| 자체 서버 | crontab + curl |
| GitHub Pages/Actions | GitHub Actions scheduled workflow |

> **주의**: 이 프로젝트(`your-blog-homepage`)는 **Vercel을 사용하지 않는다.**
> 따라서 `vercel.json`을 생성하지 말 것.

## 보안 체크리스트

### 시크릿 관리
- [ ] `JWT_SECRET` 최소 32자 랜덤 (`openssl rand -base64 48`)
- [ ] `CRON_SECRET` 최소 32자 랜덤
- [ ] `.env*` 파일은 `.gitignore`에 포함
- [ ] 프로덕션 시크릿은 GitHub Secrets / AWS SSM / Vercel Env 등 보안 저장소에만

### 쿠키
- [ ] 모든 auth 쿠키는 `HttpOnly; Secure; SameSite=Strict`
- [ ] Access Token 만료 ≤ 15분
- [ ] Refresh Token Rotation 구현 (발급 시 이전 토큰 무효화)
- [ ] localStorage에 토큰 저장 금지

### HTTP 헤더
- [ ] `Content-Security-Policy` 설정 (최소 `default-src 'self'`)
- [ ] `Strict-Transport-Security` (HTTPS 강제)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` (불필요 권한 차단)

### 입력 검증
- [ ] 모든 입력을 Zod 스키마로 검증
- [ ] HTML 컨텐츠는 `sanitizeContent`로 새니타이즈
- [ ] SQL injection: Prisma 매개변수화 쿼리 사용, raw SQL 사용 시 식별자 정규식 검증

### 인증/권한
- [ ] 관리자 라우트는 미들웨어로 `requireAdmin` 체크
- [ ] 멀티 모드에서는 **모든 API**에서 테넌트 해석 수행
- [ ] `tenantProxy`를 통해서만 테넌트 데이터 접근

### 웹훅
- [ ] Stripe 웹훅은 `stripe-signature` 검증 필수
- [ ] Cron 라우트는 `Authorization: Bearer` 검증 필수

### 로그/감사
- [ ] 슈퍼 어드민 작업은 `AuditLog`에 기록
- [ ] 비밀번호/토큰을 로그에 남기지 않음
- [ ] 프로덕션 로그 레벨은 `info` 또는 `warn` (debug 금지)

### 레이트 리밋
- [ ] 로그인 엔드포인트 레이트 리밋 (예: IP당 10회/분)
- [ ] 댓글 작성 레이트 리밋 (`CommentService.rateLimit`)
- [ ] 회원가입/OAuth 콜백 레이트 리밋

### 에러 처리
- [ ] 프로덕션에서는 스택 트레이스를 응답에 노출하지 않음
- [ ] 사용자 열거 방지: "이메일 없음" / "비밀번호 틀림"을 구분하지 않음

## 빌드 & 배포

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버
npm start

# 또는 Docker
docker build -t my-blog .
docker run -p 3000:3000 --env-file .env.production my-blog
```

## 헬스 체크 엔드포인트

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

로드 밸런서/Kubernetes liveness probe에 사용.

## 모니터링 권장

- **APM**: Sentry, New Relic, Datadog APM
- **로그 집계**: Loki + Grafana, CloudWatch Logs, BetterStack
- **업타임**: UptimeRobot, Pingdom (health 엔드포인트 모니터링)
- **에러 알림**: Sentry → Slack/Discord 연동

## 관련 문서

- [01-getting-started.md](./01-getting-started.md)
- [04-authentication.md](./04-authentication.md)
- [06-billing-stripe.md](./06-billing-stripe.md)
