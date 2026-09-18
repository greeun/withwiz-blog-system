import {
  JWTService,
  PasswordHasher,
  OAuthManager,
  TokenGenerator,
} from '@withwiz/toolkit/core/auth';
import type {
  TokenPair,
  BaseUser,
  OAuthConfig,
  Logger,
} from '@withwiz/toolkit/core/auth';
import {
  PrismaUserRepository,
  PrismaOAuthAccountRepository,
} from '@withwiz/toolkit/prisma/auth-adapter';
import type { PrismaClientLike } from '../types/system';

export interface AuthService {
  register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ user: BaseUser; tokens: TokenPair }>;

  login(
    email: string,
    password: string,
  ): Promise<{ user: BaseUser; tokens: TokenPair }>;

  refreshToken(refreshToken: string): Promise<TokenPair>;

  /**
   * 공급자 로그인 URL 을 만든다.
   * `state` 는 CSRF 방어용 값이며, 호출자가 같은 값을 httpOnly 쿠키 등에 저장하고 콜백에서 대조해야 한다.
   * 생략하면 임의 값을 만들지만 호출자가 알 수 없으므로 콜백 대조에 실패한다(`createAuthRoutes` 는 항상 전달한다).
   */
  getOAuthLoginUrl(provider: 'google' | 'github', state?: string): string;

  /**
   * 공급자 인증 코드를 교환해 로그인한다.
   * state 대조는 요청 쿠키에 접근하는 라우트 계층의 책임이다(`createAuthRoutes` 의 oauth.callback).
   * 공급자가 이메일 인증을 확인하지 않은 계정은 같은 이메일의 기존 계정에 연결하지 않는다.
   */

  handleOAuthCallback(
    provider: string,
    code: string,
  ): Promise<{ user: BaseUser; tokens: TokenPair }>;

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void>;

  getCurrentUser(accessToken: string): Promise<BaseUser | null>;
}

export interface AuthServiceConfig {
  jwtSecret: string;
  accessTokenExpiry?: string;
  refreshTokenExpiry?: string;
  /**
   * Prisma 사용자 모델의 delegate 키 (default: `'user'`).
   * 호스트 스키마가 `User` 외 다른 이름이면 명시적으로 지정해야 한다.
   */
  userModelName?: string;
  oauthProviders?: {
    google?: { clientId: string; clientSecret: string; redirectUri: string };
    github?: { clientId: string; clientSecret: string; redirectUri: string };
  };
}

/**
 * 인증 흐름에서 password 컬럼을 직접 조회하기 위한 최소 delegate 형태.
 * `as any` 캐스트 대신 이 타입으로 prisma[modelName] 접근을 좁힌다.
 */
interface UserPasswordDelegate {
  findUnique(args: {
    where: { id: string };
    select: { password: true };
  }): Promise<{ password: string | null } | null>;
}

const SUPPORTED_OAUTH_PROVIDERS = ['google', 'github'] as const;
type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

function toSupportedProvider(provider: string): SupportedOAuthProvider {
  if (!(SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`지원하지 않는 OAuth 프로바이더: ${provider}`);
  }
  return provider as SupportedOAuthProvider;
}

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createAuthService(
  prisma: PrismaClientLike,
  config: AuthServiceConfig,
): AuthService {
  const jwtService = new JWTService({
    secret: config.jwtSecret,
    accessTokenExpiry: config.accessTokenExpiry ?? '15m',
    refreshTokenExpiry: config.refreshTokenExpiry ?? '7d',
    algorithm: 'HS256',
  });

  const passwordHasher = new PasswordHasher();
  const userRepo = new PrismaUserRepository(prisma);

  const userModelName = config.userModelName ?? 'user';
  const userDelegate = (prisma as unknown as Record<string, UserPasswordDelegate>)[userModelName];
  if (!userDelegate || typeof userDelegate.findUnique !== 'function') {
    throw new Error(
      `createAuthService: Prisma 모델 "${userModelName}"을(를) 찾을 수 없습니다. ` +
        'AuthServiceConfig.userModelName 설정을 확인하세요.',
    );
  }

  let oauthManager: OAuthManager | null = null;
  let oauthAccountRepo: PrismaOAuthAccountRepository | null = null;

  if (config.oauthProviders) {
    const providers: Record<string, { clientId: string; clientSecret: string; redirectUri: string }> = {};
    if (config.oauthProviders.google) {
      providers['google'] = config.oauthProviders.google;
    }
    if (config.oauthProviders.github) {
      providers['github'] = config.oauthProviders.github;
    }
    const oauthConfig: OAuthConfig = { providers };
    oauthManager = new OAuthManager(oauthConfig, noopLogger);
    oauthAccountRepo = new PrismaOAuthAccountRepository(prisma);
  }

  return {
    async register(email, password, name) {
      const hashedPassword = await passwordHasher.hash(password);
      const user = await userRepo.create({
        email,
        password: hashedPassword,
        name: name ?? null,
      });
      const tokens = await jwtService.createTokenPair({ ...user, role: user.role ?? 'USER' });
      return { user, tokens };
    },

    async login(email, password) {
      const user = await userRepo.findByEmail(email);
      if (!user) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      // password 필드를 직접 조회 (userRepo는 BaseUser만 반환하므로 prisma 직접 접근)
      const userWithPassword = await userDelegate.findUnique({
        where: { id: user.id },
        select: { password: true },
      });

      if (!userWithPassword?.password) {
        throw new Error('비밀번호가 설정되지 않은 계정입니다. OAuth 로그인을 사용하세요.');
      }

      const isValid = await passwordHasher.verify(password, userWithPassword.password);
      if (!isValid) {
        throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
      }

      await userRepo.updateLastLoginAt(user.id);
      const tokens = await jwtService.createTokenPair({ ...user, role: user.role ?? 'USER' });
      return { user, tokens };
    },

    async refreshToken(refreshToken) {
      const { userId } = await jwtService.verifyRefreshToken(refreshToken);
      const user = await userRepo.findById(userId);
      if (!user) {
        throw new Error('사용자를 찾을 수 없습니다.');
      }
      return jwtService.createTokenPair({ ...user, role: user.role ?? 'USER' });
    },

    getOAuthLoginUrl(provider, state) {
      if (!oauthManager) {
        throw new Error('OAuth가 설정되지 않았습니다.');
      }
      const oauthProvider = toSupportedProvider(provider);
      return oauthManager.getLoginUrl(
        oauthProvider,
        state || TokenGenerator.generateUrlSafe(16),
      );
    },

    async handleOAuthCallback(provider, code) {
      if (!oauthManager || !oauthAccountRepo) {
        throw new Error('OAuth가 설정되지 않았습니다.');
      }

      const oauthProvider = toSupportedProvider(provider);

      const oauthAccessToken = await oauthManager.exchangeCodeForToken(
        oauthProvider,
        code,
      );
      const userInfo = await oauthManager.getUserInfo(
        oauthProvider,
        oauthAccessToken,
      );

      const existingAccount = await oauthAccountRepo.findByProvider(
        oauthProvider,
        userInfo.id,
      );

      let user: BaseUser;

      if (existingAccount) {
        const foundUser = await userRepo.findById(existingAccount.userId);
        if (!foundUser) {
          throw new Error('연결된 사용자를 찾을 수 없습니다.');
        }
        await oauthAccountRepo.update(existingAccount.id, {
          accessToken: oauthAccessToken,
        });
        user = foundUser;
      } else {
        const existingUser = await userRepo.findByEmail(userInfo.email);
        if (existingUser) {
          // 공급자가 이메일 소유를 확인하지 않았다면 같은 이메일로 만든 공급자 계정이
          // 기존 계정을 차지할 수 있으므로 자동 연결하지 않는다.
          if (userInfo.emailVerified !== true) {
            throw new Error(
              '공급자가 이메일 인증을 확인하지 않은 OAuth 계정은 기존 계정에 연결할 수 없습니다.',
            );
          }
          user = existingUser;
        } else {
          user = await userRepo.create({
            email: userInfo.email,
            name: userInfo.name,
            image: userInfo.image,
            emailVerified: userInfo.emailVerified ? new Date() : null,
          });
        }
        await oauthAccountRepo.create({
          userId: user.id,
          provider: oauthProvider,
          providerAccountId: userInfo.id,
          accessToken: oauthAccessToken,
        });
      }

      await userRepo.updateLastLoginAt(user.id);
      const tokens = await jwtService.createTokenPair({ ...user, role: user.role ?? 'USER' });
      return { user, tokens };
    },

    async changePassword(userId, oldPassword, newPassword) {
      const userWithPassword = await userDelegate.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!userWithPassword?.password) {
        throw new Error('비밀번호가 설정되지 않은 계정입니다.');
      }

      const isValid = await passwordHasher.verify(oldPassword, userWithPassword.password);
      if (!isValid) {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }

      const hashedPassword = await passwordHasher.hash(newPassword);
      await userRepo.update(userId, { password: hashedPassword });
    },

    async getCurrentUser(accessToken) {
      const payload = await jwtService.verifyAccessToken(accessToken);
      return userRepo.findById(payload.userId);
    },
  };
}
