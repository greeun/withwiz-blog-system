# 07. 커스텀 도메인 (Custom Domains)

멀티 테넌트 모드에서 각 테넌트가 자체 도메인(예: `www.customer.com`)을 연결하도록 지원한다.

## DomainService API

```ts
interface DomainService {
  addCustomDomain(tenantId, domain): Promise<DomainVerification>;
  checkVerification(tenantId, domain): Promise<DomainVerification>;
  verifyDomain(tenantId, domain): Promise<boolean>;
  removeCustomDomain(tenantId): Promise<void>;
  listCustomDomains({ page, limit }?): Promise<PaginatedResult<DomainInfo>>;
}
```

## DNS 인증 워크플로우

```
1. 고객이 도메인 입력: www.customer.com
2. addCustomDomain() → DB에 pending 상태로 저장 + TXT 레코드 값 생성
3. 시스템이 고객에게 TXT 추가 안내 표시
4. 고객이 DNS 프로바이더에서 TXT 레코드 추가
5. 시스템이 주기적으로(또는 "다시 확인" 버튼) checkVerification 호출
6. DNS resolveTxt로 TXT 존재 확인 → verified 상태로 전환
7. (선택) Vercel API에 도메인 등록 → SSL 자동 프로비저닝
```

## TXT 레코드 형식

- **레코드명**: `_withwiz-verify.www.customer.com`
- **값**: `withwiz-verify=<UUID>` (DB의 `verificationToken`)

예:

```
호스트:  _withwiz-verify.www
타입:    TXT
값:      withwiz-verify=4fa2c9e8-...
TTL:     3600
```

## 도메인 추가 라우트

```ts
// app/api/admin/domains/route.ts
export async function POST(req: Request) {
  const { tenantId, domain } = await req.json();
  const result = await system.domainService!.addCustomDomain(tenantId, domain);
  return Response.json({
    domain: result.domain,
    verificationRecord: {
      name: result.recordName,
      value: result.recordValue,
      type: 'TXT',
    },
  });
}
```

## 검증 확인

```ts
// app/api/admin/domains/[domain]/verify/route.ts
export async function POST(req: Request, { params }: { params: { domain: string } }) {
  const ok = await system.domainService!.verifyDomain(tenantId, params.domain);
  return Response.json({ verified: ok });
}
```

`verifyDomain`은 내부적으로 `dns.promises.resolveTxt()`를 호출해 TXT 레코드 존재와 값 일치를 확인한다.

> **주의**: DNS 전파 지연(TTL) 때문에 추가 직후 검증이 실패할 수 있다.
> UI에서 "DNS 전파에 최대 48시간 소요" 안내 + 재시도 버튼을 제공하자.

## Vercel 통합 (선택)

Vercel 배포 환경에서는 도메인 API 연동으로 **SSL을 자동 프로비저닝**할 수 있다.

### 환경변수

```bash
VERCEL_TEAM_ID=team_xxx
VERCEL_PROJECT_ID=prj_xxx
VERCEL_API_TOKEN=xxx
```

### 설정

```ts
createBlogSystem({
  mode: 'multi',
  domain: {
    baseDomain: 'blog.example.com',
    vercelTeamId: process.env.VERCEL_TEAM_ID,
    vercelProjectId: process.env.VERCEL_PROJECT_ID,
    vercelApiToken: process.env.VERCEL_API_TOKEN,
  },
});
```

DNS 검증 성공 후 `DomainService`가 Vercel Projects Domains API를 호출해 도메인을 등록한다.
Vercel이 내부적으로 Let's Encrypt SSL 인증서를 자동 발급/갱신한다.

> **주의**: Vercel API 토큰은 팀 범위 권한이 필요하다. 환경변수 유출 시 **팀 전체에 영향**을 미친다.
> GitHub Actions 같은 CI 환경에서도 평문으로 노출되지 않도록 주의하자.

## SSL 상태 추적

```ts
type DomainSslStatus = 'pending' | 'active' | 'error';
```

`DomainInfo.sslStatus`로 현재 상태를 확인한다. SSL 프로비저닝은 외부(Vercel/CloudFlare)가 수행하므로,
시스템은 상태 **추적만** 하고 실제 인증서는 관리하지 않는다.

## 자체 호스팅(non-Vercel) SSL

Vercel을 쓰지 않는 환경(직접 nginx/Traefik 등)에서는:

- DNS 검증은 그대로 동작
- SSL은 호스트가 직접 관리 (Let's Encrypt + certbot 등)
- Reverse proxy가 `Host` 헤더로 올바른 테넌트에 라우팅하도록 설정

```nginx
# nginx 예
server {
  listen 443 ssl;
  server_name www.customer.com;
  ssl_certificate /etc/letsencrypt/live/www.customer.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/www.customer.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;   # ← 테넌트 해석에 필요
  }
}
```

## 도메인 제거

```ts
await system.domainService!.removeCustomDomain(tenantId);
```

- DB에서 `tenant.customDomain` null 처리
- Vercel 연동 활성화 시 Vercel 도메인도 제거 시도

## 관련 문서

- [03-multi-tenant.md](./03-multi-tenant.md) — 커스텀 도메인 기반 테넌트 해석
- [05-tenant-management.md](./05-tenant-management.md) — 플랜별 도메인 허용 수
