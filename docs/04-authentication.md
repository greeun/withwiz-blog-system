# 04. 인증 (Authentication)

`createAuthService`는 `@withwiz/toolkit`의 JWT, PasswordHasher, OAuth 모듈을 조합해
완전한 인증 파이프라인을 제공한다.

## 팩토리

```ts
import { createAuthService } from '@withwiz/blog-system';

const authService = createAuthService(prisma, {
  jwtSecret: process.env.JWT_SECRET!,
  accessTokenExpiry: '15m',    // 기본 15분
  refreshTokenExpiry: '7d',    // 기본 7일
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
});
```

> `createBlogSystem`을 사용하면 `system.authService`에 이미 생성되어 있다.

## API

```ts
interface AuthService {
  register(email, password, name?): Promise<{ user, tokens }>;
  login(email, password): Promise<{ user, tokens }>;
  refreshToken(refreshToken): Promise<TokenPair>;
  getOAuthLoginUrl(provider: 'google' | 'github'): string;
  handleOAuthCallback(provider, code): Promise<{ user, tokens }>;
  changePassword(userId, oldPassword, newPassword): Promise<void>;
  getCurrentUser(accessToken): Promise<BaseUser | null>;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
```

## 회원가입 / 로그인 라우트

```ts
// app/api/auth/register/route.ts
export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  const { user, tokens } = await authService.register(email, password, name);

  const res = Response.json({ user });
  setAuthCookies(res, tokens);   // 아래 헬퍼
  return res;
}

// app/api/auth/login/route.ts
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const { user, tokens } = await authService.login(email, password);
  const res = Response.json({ user });
  setAuthCookies(res, tokens);
  return res;
}
```

### httpOnly 쿠키 헬퍼

```ts
function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.headers.append(
    'Set-Cookie',
    `access_token=${tokens.accessToken}; HttpOnly; Path=/; Secure; SameSite=Strict; Max-Age=900`,
  );
  res.headers.append(
    'Set-Cookie',
    `refresh_token=${tokens.refreshToken}; HttpOnly; Path=/api/auth/refresh; Secure; SameSite=Strict; Max-Age=604800`,
  );
}
```

> **주의**: **localStorage에 토큰을 절대 저장하지 말 것.** XSS 취약점을 그대로 인증 탈취에 연결한다.
> 항상 `HttpOnly; Secure; SameSite=Strict` 쿠키를 사용한다.

## 토큰 갱신 플로우

```
Access Token(15분) 만료 → 클라이언트 401 수신
  → POST /api/auth/refresh (refresh_token 쿠키 자동 전송)
  → 서버에서 authService.refreshToken(refreshToken) 호출
  → 새 Access + Refresh 쿠키 발급 (Refresh Token Rotation)
```

```ts
// app/api/auth/refresh/route.ts
export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  const refreshToken = parseCookie(cookie, 'refresh_token');
  if (!refreshToken) return new Response('Unauthorized', { status: 401 });

  try {
    const tokens = await authService.refreshToken(refreshToken);
    const res = Response.json({ ok: true });
    setAuthCookies(res, tokens);
    return res;
  } catch {
    return new Response('Invalid refresh token', { status: 401 });
  }
}
```

> **주의**: Refresh Token Rotation — 새 Refresh를 발급하면 이전 Refresh는 **즉시 무효화**해야 한다.
> toolkit의 refresh 레포지토리 구현이 DB에 저장된 토큰을 교체한다.

## OAuth (Google / GitHub)

### 1) 로그인 URL 리다이렉트

```ts
// app/api/auth/oauth/google/route.ts
export async function GET() {
  const url = authService.getOAuthLoginUrl('google');
  return Response.redirect(url, 302);
}
```

### 2) 콜백 처리

```ts
// app/api/auth/oauth/google/callback/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) return new Response('Missing code', { status: 400 });

  const { user, tokens } = await authService.handleOAuthCallback('google', code);
  const res = Response.redirect('/dashboard', 302);
  setAuthCookies(res, tokens);
  return res;
}
```

OAuth 프로바이더 설정:

| 플랫폼 | 콜백 URL |
|---|---|
| Google | `${NEXT_PUBLIC_APP_URL}/api/auth/oauth/google/callback` |
| GitHub | `${NEXT_PUBLIC_APP_URL}/api/auth/oauth/github/callback` |

> **주의**: `redirectUri`는 OAuth 앱 콘솔과 정확히 일치해야 한다. 프로토콜/슬래시 하나라도 다르면 거부된다.

## 현재 사용자 조회

```ts
import { cookies } from 'next/headers';

export async function getCurrentUser() {
  const token = cookies().get('access_token')?.value;
  if (!token) return null;
  return authService.getCurrentUser(token);
}
```

## 비밀번호 정책

toolkit의 `PasswordHasher`(bcrypt 기반)가 자동으로 해시/검증한다.
정책 강제(길이/복잡도)는 호스트의 Zod 스키마에서 수행하자.

```ts
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8, '8자 이상')
    .regex(/[A-Z]/, '대문자 포함')
    .regex(/[a-z]/, '소문자 포함')
    .regex(/[0-9]/, '숫자 포함'),
  name: z.string().min(1).optional(),
});
```

## 비밀번호 변경

```ts
await authService.changePassword(userId, oldPassword, newPassword);
```

토큰은 영향받지 않는다. 필요 시 강제 로그아웃(모든 refresh 무효화)은 별도 구현.

## 타이밍 공격 방어

toolkit의 `PasswordHasher.verify`는 상수 시간 비교를 사용한다.
다만 "사용자 미존재"와 "비밀번호 불일치"를 **동일한 응답**으로 돌려보내 사용자 열거(enumeration)를 방지하자.

```ts
try {
  await authService.login(email, password);
} catch {
  return Response.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
}
```

## 관련 문서

- [05-tenant-management.md](./05-tenant-management.md) — 역할 기반 권한 체크
- [10-deployment.md](./10-deployment.md) — JWT/OAuth 환경변수
