/**
 * 인증 라우트 핸들러 통합 테스트 (8건)
 *
 * createAuthRoutes()로 생성된 핸들러를 실제 Request 객체로 호출하여
 * Response 상태 코드와 JSON 응답을 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── 미들웨어 모킹 ──

vi.mock('@withwiz/toolkit/middleware/wrappers', () => ({
  withPublicApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = { request: req, user: undefined, metadata: {} };
      return handler(context, props);
    };
  }),
  withAdminApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = {
        request: req,
        user: { id: 'test-user', role: 'ADMIN', email: 'user@test.com' },
        metadata: {},
      };
      return handler(context, props);
    };
  }),
}));

import { createAuthRoutes } from '@withwiz/blog-system/routes';

// ── Mock AuthService 팩토리 ──

function createMockAuthService() {
  return {
    register: vi.fn().mockImplementation(async (email: string) => {
      if (email === 'duplicate@test.com') {
        throw new Error('이미 등록된 이메일입니다.');
      }
      return {
        user: { id: 'u-1', email, name: '테스트' },
        tokens: { accessToken: 'at-xxx', refreshToken: 'rt-xxx' },
      };
    }),
    login: vi.fn().mockImplementation(async (email: string, password: string) => {
      if (password === 'wrong') {
        throw new Error('비밀번호가 일치하지 않습니다.');
      }
      return {
        user: { id: 'u-1', email },
        tokens: { accessToken: 'at-xxx', refreshToken: 'rt-xxx' },
      };
    }),
    refreshToken: vi.fn().mockResolvedValue({
      accessToken: 'new-at-xxx',
      refreshToken: 'new-rt-xxx',
    }),
    getOAuthLoginUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
    handleOAuthCallback: vi.fn().mockResolvedValue({
      user: { id: 'u-1', email: 'oauth@test.com' },
      tokens: { accessToken: 'at-xxx', refreshToken: 'rt-xxx' },
    }),
    changePassword: vi.fn().mockImplementation(
      async (_userId: string, currentPassword: string) => {
        if (currentPassword === 'wrong-current') {
          throw new Error('현재 비밀번호가 일치하지 않습니다.');
        }
      },
    ),
    getCurrentUser: vi.fn().mockResolvedValue({
      id: 'u-1',
      email: 'user@test.com',
    }),
  } as any;
}

describe('인증 라우트 핸들러', () => {
  let authService: ReturnType<typeof createMockAuthService>;
  let routes: ReturnType<typeof createAuthRoutes>;

  beforeEach(() => {
    authService = createMockAuthService();
    routes = createAuthRoutes(authService);
  });

  // ── 회원가입 ──

  it('BS-AU-01: 회원가입 — POST 유효 → 201 + 토큰 반환', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'password123',
        name: '새 사용자',
      }),
    });
    const res = await routes.register.POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBeDefined();
  });

  it('BS-AU-02: 회원가입 — POST 중복 이메일 → 400 (서비스 에러)', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'duplicate@test.com',
        password: 'password123',
      }),
    });
    const res = await routes.register.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('이미 등록된');
  });

  // ── 로그인 ──

  it('BS-AU-03: 로그인 — POST 유효 → 200 + 토큰 반환', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@test.com',
        password: 'correct',
      }),
    });
    const res = await routes.login.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('user@test.com');
    expect(body.data.tokens).toBeDefined();
  });

  it('BS-AU-04: 로그인 — POST 잘못된 비밀번호 → 401', async () => {
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@test.com',
        password: 'wrong',
      }),
    });
    const res = await routes.login.POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── 토큰 갱신 ──

  it('BS-AU-05: 토큰 갱신 — POST → 새 access token', async () => {
    const req = new Request('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'rt-xxx' }),
    });
    const res = await routes.refresh.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.tokens.accessToken).toBe('new-at-xxx');
  });

  // ── 로그아웃 ──

  it('BS-AU-06: 로그아웃 — POST → 200 + 메시지', async () => {
    const req = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    });
    const res = await routes.logout.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('로그아웃');
  });

  // ── 현재 사용자 정보 ──

  it('BS-AU-07: 현재 사용자 — GET with auth → user info', async () => {
    const req = new Request('http://localhost/api/auth/me');
    const res = await routes.me.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBe('test-user');
    expect(body.data.user.email).toBe('user@test.com');
  });

  // ── 비밀번호 변경 ──

  it('BS-AU-08: 비밀번호 변경 — POST → 성공', async () => {
    const req = new Request('http://localhost/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'current123',
        newPassword: 'newpass12345',
      }),
    });
    const res = await routes.changePassword.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('변경');
  });
});
