/**
 * AuthService (createAuthService) 단위 테스트
 *
 * toolkit 모듈을 모킹하여 AuthService 팩토리 및 각 메서드를 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── toolkit 모듈 모킹 ──

const mockHash = vi.fn();
const mockVerify = vi.fn();

const mockCreateTokenPair = vi.fn();
const mockVerifyAccessToken = vi.fn();
const mockVerifyRefreshToken = vi.fn();

const mockUserRepoCreate = vi.fn();
const mockUserRepoFindByEmail = vi.fn();
const mockUserRepoFindById = vi.fn();
const mockUserRepoUpdateLastLoginAt = vi.fn();
const mockUserRepoUpdate = vi.fn();

vi.mock('@withwiz/toolkit/core/auth', () => {
  class MockJWTService {
    constructor(_config: any) {}
    createTokenPair = mockCreateTokenPair;
    verifyAccessToken = mockVerifyAccessToken;
    verifyRefreshToken = mockVerifyRefreshToken;
  }
  class MockPasswordHasher {
    hash = mockHash;
    verify = mockVerify;
  }
  class MockOAuthManager {
    constructor(..._args: any[]) {}
  }
  return {
    JWTService: MockJWTService,
    PasswordHasher: MockPasswordHasher,
    OAuthManager: MockOAuthManager,
    TokenGenerator: { generateUrlSafe: vi.fn().mockReturnValue('mock-state') },
    OAuthProvider: { GOOGLE: 'google', GITHUB: 'github' },
  };
});

vi.mock('@withwiz/toolkit/prisma/auth-adapter', () => {
  class MockPrismaUserRepository {
    constructor(_prisma: any) {}
    create = mockUserRepoCreate;
    findByEmail = mockUserRepoFindByEmail;
    findById = mockUserRepoFindById;
    updateLastLoginAt = mockUserRepoUpdateLastLoginAt;
    update = mockUserRepoUpdate;
  }
  class MockPrismaOAuthAccountRepository {
    constructor(..._args: any[]) {}
  }
  class MockPrismaEmailTokenRepository {
    constructor(..._args: any[]) {}
  }
  return {
    PrismaUserRepository: MockPrismaUserRepository,
    PrismaOAuthAccountRepository: MockPrismaOAuthAccountRepository,
    PrismaEmailTokenRepository: MockPrismaEmailTokenRepository,
  };
});

import { createAuthService } from '@withwiz/blog-system/auth';
import type { AuthService } from '@withwiz/blog-system/auth';

// ── 헬퍼 ──

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

const TEST_CONFIG = {
  jwtSecret: 'test-secret-key-minimum-32-characters-long',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
};

const MOCK_USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
};

const MOCK_TOKENS = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

describe('AuthService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    authService = createAuthService(prisma, TEST_CONFIG);
  });

  // ── 팩토리 ──

  describe('createAuthService 팩토리', () => {
    it('AS-01: prisma + config → AuthService 인스턴스 반환', () => {
      expect(authService).toBeDefined();
      expect(authService.register).toBeTypeOf('function');
      expect(authService.login).toBeTypeOf('function');
      expect(authService.refreshToken).toBeTypeOf('function');
      expect(authService.getCurrentUser).toBeTypeOf('function');
      expect(authService.changePassword).toBeTypeOf('function');
      expect(authService.getOAuthLoginUrl).toBeTypeOf('function');
      expect(authService.handleOAuthCallback).toBeTypeOf('function');
    });
  });

  // ── register ──

  describe('register', () => {
    it('AS-02: 정상 — email + password → user + tokenPair 반환', async () => {
      mockHash.mockResolvedValue('hashed-pw');
      mockUserRepoCreate.mockResolvedValue(MOCK_USER);
      mockCreateTokenPair.mockResolvedValue(MOCK_TOKENS);

      const result = await authService.register('test@example.com', 'StrongP@ss1!', 'Test User');

      expect(mockHash).toHaveBeenCalledWith('StrongP@ss1!');
      expect(mockUserRepoCreate).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'hashed-pw',
        name: 'Test User',
      });
      expect(mockCreateTokenPair).toHaveBeenCalledWith({ ...MOCK_USER, role: 'USER' });
      expect(result.user).toEqual(MOCK_USER);
      expect(result.tokens).toEqual(MOCK_TOKENS);
    });

    it('AS-03: 중복 이메일 → userRepo.create 에러 전파', async () => {
      mockHash.mockResolvedValue('hashed-pw');
      mockUserRepoCreate.mockRejectedValue(new Error('이미 존재하는 이메일입니다.'));

      await expect(
        authService.register('dup@example.com', 'StrongP@ss1!'),
      ).rejects.toThrow('이미 존재하는 이메일');
    });

    it('AS-04: 약한 비밀번호 → passwordHasher.hash 에러 전파', async () => {
      mockHash.mockRejectedValue(new Error('비밀번호가 보안 요구사항을 충족하지 않습니다.'));

      await expect(
        authService.register('test@example.com', '123'),
      ).rejects.toThrow('비밀번호가 보안 요구사항');
    });

    it('AS-05: name 미전달 시 null로 전달', async () => {
      mockHash.mockResolvedValue('hashed-pw');
      mockUserRepoCreate.mockResolvedValue(MOCK_USER);
      mockCreateTokenPair.mockResolvedValue(MOCK_TOKENS);

      await authService.register('test@example.com', 'StrongP@ss1!');

      expect(mockUserRepoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: null }),
      );
    });
  });

  // ── login ──

  describe('login', () => {
    it('AS-06: 정상 자격증명 → user + tokenPair 반환', async () => {
      mockUserRepoFindByEmail.mockResolvedValue(MOCK_USER);
      prisma.user.findUnique.mockResolvedValue({ password: 'hashed-pw' });
      mockVerify.mockResolvedValue(true);
      mockCreateTokenPair.mockResolvedValue(MOCK_TOKENS);

      const result = await authService.login('test@example.com', 'StrongP@ss1!');

      expect(mockUserRepoFindByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockVerify).toHaveBeenCalledWith('StrongP@ss1!', 'hashed-pw');
      expect(mockUserRepoUpdateLastLoginAt).toHaveBeenCalledWith('user-1');
      expect(result.user).toEqual(MOCK_USER);
      expect(result.tokens).toEqual(MOCK_TOKENS);
    });

    it('AS-07: 존재하지 않는 이메일 → 에러', async () => {
      mockUserRepoFindByEmail.mockResolvedValue(null);

      await expect(
        authService.login('unknown@example.com', 'password'),
      ).rejects.toThrow('이메일 또는 비밀번호가 올바르지 않습니다.');
    });

    it('AS-08: 잘못된 비밀번호 → 에러', async () => {
      mockUserRepoFindByEmail.mockResolvedValue(MOCK_USER);
      prisma.user.findUnique.mockResolvedValue({ password: 'hashed-pw' });
      mockVerify.mockResolvedValue(false);

      await expect(
        authService.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow('이메일 또는 비밀번호가 올바르지 않습니다.');
    });

    it('AS-09: OAuth 전용 계정 (비밀번호 미설정) → 에러', async () => {
      mockUserRepoFindByEmail.mockResolvedValue(MOCK_USER);
      prisma.user.findUnique.mockResolvedValue({ password: null });

      await expect(
        authService.login('test@example.com', 'password'),
      ).rejects.toThrow('비밀번호가 설정되지 않은 계정입니다.');
    });
  });

  // ── refreshToken ──

  describe('refreshToken', () => {
    it('AS-10: 유효한 refresh token → 새 tokenPair 반환', async () => {
      mockVerifyRefreshToken.mockResolvedValue({ userId: 'user-1' });
      mockUserRepoFindById.mockResolvedValue(MOCK_USER);
      mockCreateTokenPair.mockResolvedValue(MOCK_TOKENS);

      const result = await authService.refreshToken('valid-refresh-token');

      expect(mockVerifyRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(mockUserRepoFindById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(MOCK_TOKENS);
    });

    it('AS-11: 만료된 refresh token → 에러', async () => {
      mockVerifyRefreshToken.mockRejectedValue(new Error('토큰이 만료되었습니다.'));

      await expect(
        authService.refreshToken('expired-token'),
      ).rejects.toThrow('토큰이 만료되었습니다.');
    });

    it('AS-12: 잘못된 refresh token → 에러', async () => {
      mockVerifyRefreshToken.mockRejectedValue(new Error('유효하지 않은 토큰입니다.'));

      await expect(
        authService.refreshToken('invalid-token'),
      ).rejects.toThrow('유효하지 않은 토큰');
    });

    it('AS-13: 토큰은 유효하나 사용자 없음 → 에러', async () => {
      mockVerifyRefreshToken.mockResolvedValue({ userId: 'deleted-user' });
      mockUserRepoFindById.mockResolvedValue(null);

      await expect(
        authService.refreshToken('valid-but-orphan'),
      ).rejects.toThrow('사용자를 찾을 수 없습니다.');
    });
  });

  // ── getCurrentUser ──

  describe('getCurrentUser', () => {
    it('AS-14: 유효한 access token → user 반환', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1' });
      mockUserRepoFindById.mockResolvedValue(MOCK_USER);

      const result = await authService.getCurrentUser('valid-access-token');

      expect(mockVerifyAccessToken).toHaveBeenCalledWith('valid-access-token');
      expect(result).toEqual(MOCK_USER);
    });

    it('AS-15: 유효한 토큰이나 사용자 삭제됨 → null 반환', async () => {
      mockVerifyAccessToken.mockResolvedValue({ userId: 'deleted-user' });
      mockUserRepoFindById.mockResolvedValue(null);

      const result = await authService.getCurrentUser('valid-token');
      expect(result).toBeNull();
    });

    it('AS-16: 잘못된 access token → 에러', async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error('유효하지 않은 토큰입니다.'));

      await expect(
        authService.getCurrentUser('bad-token'),
      ).rejects.toThrow('유효하지 않은 토큰');
    });
  });

  // ── changePassword ──

  describe('changePassword', () => {
    it('AS-17: 정상 비밀번호 변경 → void', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: 'old-hashed' });
      mockVerify.mockResolvedValue(true);
      mockHash.mockResolvedValue('new-hashed');
      mockUserRepoUpdate.mockResolvedValue(undefined);

      await expect(
        authService.changePassword('user-1', 'old-password', 'NewStr0ng!'),
      ).resolves.toBeUndefined();

      expect(mockVerify).toHaveBeenCalledWith('old-password', 'old-hashed');
      expect(mockHash).toHaveBeenCalledWith('NewStr0ng!');
      expect(mockUserRepoUpdate).toHaveBeenCalledWith('user-1', { password: 'new-hashed' });
    });

    it('AS-18: 잘못된 현재 비밀번호 → 에러', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: 'old-hashed' });
      mockVerify.mockResolvedValue(false);

      await expect(
        authService.changePassword('user-1', 'wrong-current', 'NewStr0ng!'),
      ).rejects.toThrow('현재 비밀번호가 올바르지 않습니다.');
    });

    it('AS-19: 비밀번호 미설정 계정 → 에러', async () => {
      prisma.user.findUnique.mockResolvedValue({ password: null });

      await expect(
        authService.changePassword('user-1', 'anything', 'NewStr0ng!'),
      ).rejects.toThrow('비밀번호가 설정되지 않은 계정입니다.');
    });
  });
});
