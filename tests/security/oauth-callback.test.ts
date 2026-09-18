/**
 * OAuth 로그인 CSRF(state) 검증과 계정 연결 보안 테스트
 *
 * - oauth.login 은 state 를 발급해 httpOnly 쿠키에 저장하고 같은 값으로 공급자 로그인 URL 을 만든다.
 * - oauth.callback 은 쿼리 state 와 쿠키 state 가 일치할 때만 인증을 진행하고, 사용한 쿠키는 지운다.
 * - 공급자가 이메일 인증을 확인하지 않은 OAuth 계정은 같은 이메일의 기존 계정에 자동으로 연결하지 않는다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── toolkit 인증 모킹 (서비스 단위 테스트용) ──

const oauth = vi.hoisted(() => ({
  getLoginUrl: vi.fn(),
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
}));

const repos = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateLastLoginAt: vi.fn(),
  findByProvider: vi.fn(),
  oauthCreate: vi.fn(),
  oauthUpdate: vi.fn(),
  createTokenPair: vi.fn(),
}));

vi.mock('@withwiz/toolkit/core/auth', () => {
  class MockJWTService {
    createTokenPair = repos.createTokenPair;
    verifyAccessToken = vi.fn();
    verifyRefreshToken = vi.fn();
  }
  class MockPasswordHasher {
    hash = vi.fn();
    verify = vi.fn();
  }
  class MockOAuthManager {
    getLoginUrl = oauth.getLoginUrl;
    exchangeCodeForToken = oauth.exchangeCodeForToken;
    getUserInfo = oauth.getUserInfo;
  }
  return {
    JWTService: MockJWTService,
    PasswordHasher: MockPasswordHasher,
    OAuthManager: MockOAuthManager,
    TokenGenerator: { generateUrlSafe: vi.fn().mockReturnValue('generated-state') },
  };
});

vi.mock('@withwiz/toolkit/prisma/auth-adapter', () => {
  class MockPrismaUserRepository {
    findByEmail = repos.findByEmail;
    findById = repos.findById;
    create = repos.create;
    updateLastLoginAt = repos.updateLastLoginAt;
    update = vi.fn();
  }
  class MockPrismaOAuthAccountRepository {
    findByProvider = repos.findByProvider;
    create = repos.oauthCreate;
    update = repos.oauthUpdate;
  }
  return {
    PrismaUserRepository: MockPrismaUserRepository,
    PrismaOAuthAccountRepository: MockPrismaOAuthAccountRepository,
  };
});

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => {
  const wrap = (handler: any) => (req: Request, props?: unknown) =>
    handler({ request: req, user: undefined, metadata: {} }, props);
  return { withPublicApi: vi.fn(wrap), withAuthApi: vi.fn(wrap) };
});

import { createAuthService } from '@withwiz/blog-system/auth';
import { createAuthRoutes } from '@withwiz/blog-system/routes';

const OAUTH_CONFIG = {
  jwtSecret: 'test-jwt-secret-key-for-unit-testing-minimum-32-chars',
  oauthProviders: {
    google: { clientId: 'g-id', clientSecret: 'g-secret', redirectUri: 'https://app.example.com/cb/google' },
    github: { clientId: 'h-id', clientSecret: 'h-secret', redirectUri: 'https://app.example.com/cb/github' },
  },
};

const TOKENS = { accessToken: 'at', refreshToken: 'rt' };
const VICTIM = { id: 'user-victim', email: 'victim@example.com', name: 'Victim' };

function createPrisma() {
  return { user: { findUnique: vi.fn() }, $transaction: vi.fn(), $queryRawUnsafe: vi.fn() } as any;
}

// ── 서비스: 계정 연결 ──

describe('AuthService.handleOAuthCallback — 기존 계정 연결', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oauth.exchangeCodeForToken.mockResolvedValue('provider-access-token');
    repos.findByProvider.mockResolvedValue(null);
    repos.createTokenPair.mockResolvedValue(TOKENS);
  });

  it('BS-OA-01: 이메일 미인증(emailVerified false) OAuth 계정은 같은 이메일의 기존 계정에 연결하지 않는다', async () => {
    oauth.getUserInfo.mockResolvedValue({ id: 'g-1', email: VICTIM.email, name: 'Attacker', image: null, emailVerified: false });
    repos.findByEmail.mockResolvedValue(VICTIM);
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    await expect(service.handleOAuthCallback('google', 'code')).rejects.toThrow('이메일 인증');

    expect(repos.oauthCreate).not.toHaveBeenCalled();
    expect(repos.createTokenPair).not.toHaveBeenCalled();
    expect(repos.updateLastLoginAt).not.toHaveBeenCalled();
  });

  it('BS-OA-02: 공급자가 emailVerified 를 주지 않아도 기존 계정에 연결하지 않는다', async () => {
    oauth.getUserInfo.mockResolvedValue({ id: 'h-1', email: VICTIM.email, name: null, image: null });
    repos.findByEmail.mockResolvedValue(VICTIM);
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    await expect(service.handleOAuthCallback('github', 'code')).rejects.toThrow('이메일 인증');
    expect(repos.oauthCreate).not.toHaveBeenCalled();
  });

  it('BS-OA-03: 이메일 인증이 확인된 OAuth 계정은 기존 계정에 연결하고 토큰을 발급한다', async () => {
    oauth.getUserInfo.mockResolvedValue({ id: 'g-1', email: VICTIM.email, name: 'Victim', image: null, emailVerified: true });
    repos.findByEmail.mockResolvedValue(VICTIM);
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    const result = await service.handleOAuthCallback('google', 'code');

    expect(repos.oauthCreate).toHaveBeenCalledWith({
      userId: 'user-victim',
      provider: 'google',
      providerAccountId: 'g-1',
      accessToken: 'provider-access-token',
    });
    expect(result.tokens).toEqual(TOKENS);
  });

  it('BS-OA-04: 새 이메일은 인증 여부와 관계없이 새 사용자로 만들고 인증 시각은 확인된 경우에만 기록한다', async () => {
    oauth.getUserInfo.mockResolvedValue({ id: 'g-2', email: 'new@example.com', name: 'New', image: null, emailVerified: false });
    repos.findByEmail.mockResolvedValue(null);
    repos.create.mockResolvedValue({ id: 'user-new', email: 'new@example.com' });
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    await service.handleOAuthCallback('google', 'code');

    expect(repos.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', emailVerified: null }));
    expect(repos.oauthCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-new' }));
  });

  it('BS-OA-05: 지원하지 않는 공급자는 github 로 바꿔 처리하지 않고 거부한다', async () => {
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    await expect(service.handleOAuthCallback('kakao', 'code')).rejects.toThrow('지원하지 않는 OAuth 프로바이더');
    expect(oauth.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it('BS-OA-06: getOAuthLoginUrl 은 전달받은 state 로 로그인 URL 을 만든다', () => {
    oauth.getLoginUrl.mockReturnValue('https://accounts.google.com/auth?state=s-1');
    const service = createAuthService(createPrisma(), OAUTH_CONFIG);

    expect(service.getOAuthLoginUrl('google', 's-1')).toBe('https://accounts.google.com/auth?state=s-1');
    expect(oauth.getLoginUrl).toHaveBeenCalledWith('google', 's-1');
  });
});

// ── 라우트: state 발급과 대조 ──

function createMockAuthService() {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refreshToken: vi.fn(),
    getOAuthLoginUrl: vi.fn((_provider: string, state?: string) => `https://accounts.google.com/auth?state=${state}`),
    handleOAuthCallback: vi.fn().mockResolvedValue({ user: { id: 'u-1', email: 'u@example.com' }, tokens: TOKENS }),
    changePassword: vi.fn(),
    getCurrentUser: vi.fn(),
  } as any;
}

const providerParams = (provider: string) => ({ params: Promise.resolve({ provider }) });

function callbackRequest(query: string, stateCookie?: string) {
  return new NextRequest(`https://app.example.com/api/auth/oauth/google/callback?${query}`, {
    headers: stateCookie !== undefined ? { cookie: `oauth_state=${stateCookie}` } : {},
  });
}

function stateCookieOf(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/oauth_state=([^;]*)/);
  return match ? match[1] : null;
}

describe('oauth 라우트 — state 검증', () => {
  let authService: ReturnType<typeof createMockAuthService>;
  let routes: ReturnType<typeof createAuthRoutes>;

  beforeEach(() => {
    authService = createMockAuthService();
    routes = createAuthRoutes(authService);
  });

  it('BS-OA-07: oauth.login 은 state 를 httpOnly 쿠키에 저장하고 같은 state 로 로그인 URL 을 만든다', async () => {
    const res = await routes.oauth.login.GET(
      new NextRequest('https://app.example.com/api/auth/oauth/google'),
      providerParams('google'),
    );

    expect([302, 307]).toContain(res.status);
    const [provider, state] = authService.getOAuthLoginUrl.mock.calls[0];
    expect(provider).toBe('google');
    expect(typeof state).toBe('string');
    expect(state.length).toBeGreaterThanOrEqual(16);
    expect(res.headers.get('location')).toBe(`https://accounts.google.com/auth?state=${state}`);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(stateCookieOf(res)).toBe(state);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Secure/i);
  });

  it('BS-OA-08: 쿼리 state 가 쿠키 state 와 다르면 400 으로 거부하고 인증을 진행하지 않는다', async () => {
    const res = await routes.oauth.callback.GET(callbackRequest('code=abc&state=forged', 'real-state'), providerParams('google'));

    expect(res.status).toBe(400);
    expect((await res.json()).success).toBe(false);
    expect(authService.handleOAuthCallback).not.toHaveBeenCalled();
    expect(stateCookieOf(res)).toBe('');
  });

  it('BS-OA-09: state 쿠키가 없거나 쿼리 state 가 없으면 400 으로 거부한다', async () => {
    const withoutCookie = await routes.oauth.callback.GET(callbackRequest('code=abc&state=forged'), providerParams('google'));
    const withoutQuery = await routes.oauth.callback.GET(callbackRequest('code=abc', 'real-state'), providerParams('google'));

    expect(withoutCookie.status).toBe(400);
    expect(withoutQuery.status).toBe(400);
    expect(authService.handleOAuthCallback).not.toHaveBeenCalled();
  });

  it('BS-OA-10: state 가 일치하면 인증을 진행하고 사용한 state 쿠키를 지운다', async () => {
    const res = await routes.oauth.callback.GET(callbackRequest('code=abc&state=real-state', 'real-state'), providerParams('google'));

    expect(res.status).toBe(200);
    expect(authService.handleOAuthCallback).toHaveBeenCalledWith('google', 'abc');
    expect(stateCookieOf(res)).toBe('');
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
  });

  it('BS-OA-11: 콜백의 지원하지 않는 공급자는 400 으로 거부한다', async () => {
    const res = await routes.oauth.callback.GET(callbackRequest('code=abc&state=s', 's'), providerParams('kakao'));

    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toContain('지원하지 않는 OAuth 프로바이더');
    expect(authService.handleOAuthCallback).not.toHaveBeenCalled();
  });
});
