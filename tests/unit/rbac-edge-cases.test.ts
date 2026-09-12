/**
 * RBAC 엣지 케이스 테스트
 *
 * 역할 계층, hasPermission 경계 조건, OWNER 보호 정책,
 * 크로스 테넌트 격리를 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTenantUserService } from '@withwiz/blog-system/tenant';
import { TenantRole } from '@withwiz/blog-system/types';

// ── Mock Prisma ──

function createMockPrisma() {
  return {
    tenantUser: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_1 = 'user-1';
const USER_2 = 'user-2';

describe('RBAC 엣지 케이스', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReturnType<typeof createTenantUserService>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = createTenantUserService(prisma);
  });

  // ── 역할 계층 ──

  describe('역할 계층 검증', () => {
    it('RBAC-01: OWNER(4) > ADMIN(3) > EDITOR(2) > VIEWER(1) 순서 검증', async () => {
      // OWNER가 모든 역할 이상의 권한을 가짐
      const roles = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.EDITOR, TenantRole.VIEWER];

      for (let i = 0; i < roles.length; i++) {
        for (let j = 0; j < roles.length; j++) {
          prisma.tenantUser.findUnique.mockResolvedValueOnce({ role: roles[i] });

          const result = await service.hasPermission(TENANT_A, USER_1, roles[j]);

          // 상위 역할(작은 인덱스)은 하위 역할(큰 인덱스) 권한을 충족
          if (i <= j) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      }
    });

    it('RBAC-02: 동일 역할 → 항상 true', async () => {
      const roles = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.EDITOR, TenantRole.VIEWER];

      for (const role of roles) {
        prisma.tenantUser.findUnique.mockResolvedValueOnce({ role });
        const result = await service.hasPermission(TENANT_A, USER_1, role);
        expect(result).toBe(true);
      }
    });
  });

  // ── hasPermission 경계 조건 ──

  describe('hasPermission 경계 조건', () => {
    it('RBAC-03: OWNER가 EDITOR 권한 요구 → true', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.OWNER });
      const result = await service.hasPermission(TENANT_A, USER_1, TenantRole.EDITOR);
      expect(result).toBe(true);
    });

    it('RBAC-04: VIEWER가 EDITOR 권한 요구 → false', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.VIEWER });
      const result = await service.hasPermission(TENANT_A, USER_1, TenantRole.EDITOR);
      expect(result).toBe(false);
    });

    it('RBAC-05: 비멤버가 권한 요구 → false', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue(null);
      const result = await service.hasPermission(TENANT_A, USER_1, TenantRole.VIEWER);
      expect(result).toBe(false);
    });

    it('RBAC-06: ADMIN이 OWNER 권한 요구 → false', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.ADMIN });
      const result = await service.hasPermission(TENANT_A, USER_1, TenantRole.OWNER);
      expect(result).toBe(false);
    });

    it('RBAC-07: EDITOR가 VIEWER 권한 요구 → true', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.EDITOR });
      const result = await service.hasPermission(TENANT_A, USER_1, TenantRole.VIEWER);
      expect(result).toBe(true);
    });
  });

  // ── OWNER 보호 ──

  describe('OWNER 보호 정책', () => {
    it('RBAC-08: 유일한 OWNER 제거 시도 → 에러', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });
      prisma.tenantUser.count.mockResolvedValue(1);

      await expect(
        service.removeUser(TENANT_A, USER_1),
      ).rejects.toThrow('최소 1명의 소유자(OWNER)가 필요합니다.');
    });

    it('RBAC-09: 유일한 OWNER 역할 변경 시도 → 에러', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });
      prisma.tenantUser.count.mockResolvedValue(1);

      await expect(
        service.updateRole(TENANT_A, USER_1, TenantRole.ADMIN),
      ).rejects.toThrow('최소 1명의 소유자(OWNER)가 필요합니다.');
    });

    it('RBAC-10: OWNER 2명일 때 1명 제거 → 성공', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });
      prisma.tenantUser.count.mockResolvedValue(2);
      prisma.tenantUser.delete.mockResolvedValue({});

      await service.removeUser(TENANT_A, USER_1);
      expect(prisma.tenantUser.delete).toHaveBeenCalled();
    });

    it('RBAC-11: OWNER 2명일 때 1명 역할 변경 → 성공', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });
      prisma.tenantUser.count.mockResolvedValue(2);
      prisma.tenantUser.update.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.ADMIN,
      });

      const result = await service.updateRole(TENANT_A, USER_1, TenantRole.ADMIN);
      expect(result.role).toBe(TenantRole.ADMIN);
    });

    it('RBAC-12: OWNER → OWNER 역할 변경 (동일 역할) → count 검사 안 함', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });
      prisma.tenantUser.update.mockResolvedValue({
        id: 'tu-1',
        role: TenantRole.OWNER,
      });

      await service.updateRole(TENANT_A, USER_1, TenantRole.OWNER);
      // OWNER → OWNER는 카운트 검사를 건너뜀
      expect(prisma.tenantUser.count).not.toHaveBeenCalled();
    });

    it('RBAC-13: 비소속 사용자 제거 시도 → 에러', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue(null);

      await expect(
        service.removeUser(TENANT_A, USER_1),
      ).rejects.toThrow('소속되지 않은 사용자');
    });

    it('RBAC-14: 비소속 사용자 역할 변경 시도 → 에러', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole(TENANT_A, USER_1, TenantRole.EDITOR),
      ).rejects.toThrow('소속되지 않은 사용자');
    });
  });

  // ── 크로스 테넌트 격리 ──

  describe('크로스 테넌트 격리', () => {
    it('RBAC-15: 테넌트A 멤버가 테넌트B 리소스 접근 → 거부 (hasPermission false)', async () => {
      // 테넌트A에서는 OWNER
      prisma.tenantUser.findUnique
        .mockResolvedValueOnce({ role: TenantRole.OWNER }) // tenant-a 조회
        .mockResolvedValueOnce(null); // tenant-b 조회 — 미소속

      const resultA = await service.hasPermission(TENANT_A, USER_1, TenantRole.VIEWER);
      expect(resultA).toBe(true);

      const resultB = await service.hasPermission(TENANT_B, USER_1, TenantRole.VIEWER);
      expect(resultB).toBe(false);
    });

    it('RBAC-16: 테넌트A OWNER가 테넌트B에서 getUserRole → null', async () => {
      prisma.tenantUser.findUnique.mockResolvedValue(null);

      const role = await service.getUserRole(TENANT_B, USER_1);
      expect(role).toBeNull();
    });

    it('RBAC-17: 서로 다른 테넌트에서 동일 사용자가 다른 역할 보유 가능', async () => {
      // 테넌트A: OWNER, 테넌트B: VIEWER
      prisma.tenantUser.findUnique
        .mockResolvedValueOnce({ role: TenantRole.OWNER })
        .mockResolvedValueOnce({ role: TenantRole.VIEWER });

      const roleA = await service.getUserRole(TENANT_A, USER_1);
      const roleB = await service.getUserRole(TENANT_B, USER_1);

      expect(roleA).toBe(TenantRole.OWNER);
      expect(roleB).toBe(TenantRole.VIEWER);
    });

    it('RBAC-18: 테넌트A 멤버의 테넌트B ADMIN 권한 요구 → false', async () => {
      // 테넌트B에 소속되지 않음
      prisma.tenantUser.findUnique.mockResolvedValue(null);

      const result = await service.hasPermission(TENANT_B, USER_1, TenantRole.ADMIN);
      expect(result).toBe(false);
    });
  });
});
