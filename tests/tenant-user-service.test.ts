/**
 * Task 5: tenant-user-service (createTenantUserService) 테스트 (14건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTenantUserService } from '@withwiz/blog-system/tenant';
import { TenantRole } from '@withwiz/blog-system/types';

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

const TENANT_ID = 't-1';
const USER_ID = 'u-1';

describe('createTenantUserService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReturnType<typeof createTenantUserService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = createTenantUserService(prisma);
  });

  // ── addUser ──
  it('BS-TU-01: addUser — 정상 추가', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue(null);
    const created = { id: 'tu-1', tenantId: TENANT_ID, userId: USER_ID, role: TenantRole.EDITOR };
    prisma.tenantUser.create.mockResolvedValue(created);

    const result = await service.addUser(TENANT_ID, USER_ID, TenantRole.EDITOR);
    expect(result).toEqual(created);
  });

  it('BS-TU-02: addUser — 중복 추가 시 Error', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1' });
    await expect(service.addUser(TENANT_ID, USER_ID, TenantRole.EDITOR)).rejects.toThrow('이미 해당 테넌트에 소속된');
  });

  // ── removeUser ──
  it('BS-TU-03: removeUser — 정상 제거', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1', role: TenantRole.EDITOR });
    prisma.tenantUser.delete.mockResolvedValue({});
    await service.removeUser(TENANT_ID, USER_ID);
    expect(prisma.tenantUser.delete).toHaveBeenCalled();
  });

  it('BS-TU-04: removeUser — 유일 OWNER 제거 차단', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1', role: TenantRole.OWNER });
    prisma.tenantUser.count.mockResolvedValue(1);
    await expect(service.removeUser(TENANT_ID, USER_ID)).rejects.toThrow('최소 1명의 소유자');
  });

  it('BS-TU-05: removeUser — 다수 OWNER 중 1명 제거 허용', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1', role: TenantRole.OWNER });
    prisma.tenantUser.count.mockResolvedValue(2);
    prisma.tenantUser.delete.mockResolvedValue({});
    await service.removeUser(TENANT_ID, USER_ID);
    expect(prisma.tenantUser.delete).toHaveBeenCalled();
  });

  // ── updateRole ──
  it('BS-TU-06: updateRole — 정상 변경', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1', role: TenantRole.EDITOR });
    prisma.tenantUser.update.mockResolvedValue({ id: 'tu-1', role: TenantRole.ADMIN });
    const result = await service.updateRole(TENANT_ID, USER_ID, TenantRole.ADMIN);
    expect(result.role).toBe(TenantRole.ADMIN);
  });

  it('BS-TU-07: updateRole — 유일 OWNER의 역할 변경 차단', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ id: 'tu-1', role: TenantRole.OWNER });
    prisma.tenantUser.count.mockResolvedValue(1);
    await expect(service.updateRole(TENANT_ID, USER_ID, TenantRole.EDITOR)).rejects.toThrow('최소 1명의 소유자');
  });

  // ── hasPermission ──
  it('BS-TU-08: hasPermission — OWNER ≥ VIEWER → true', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.OWNER });
    const result = await service.hasPermission(TENANT_ID, USER_ID, TenantRole.VIEWER);
    expect(result).toBe(true);
  });

  it('BS-TU-09: hasPermission — EDITOR < ADMIN → false', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.EDITOR });
    const result = await service.hasPermission(TENANT_ID, USER_ID, TenantRole.ADMIN);
    expect(result).toBe(false);
  });

  it('BS-TU-10: hasPermission — 동일 역할 → true', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue({ role: TenantRole.ADMIN });
    const result = await service.hasPermission(TENANT_ID, USER_ID, TenantRole.ADMIN);
    expect(result).toBe(true);
  });

  it('BS-TU-11: hasPermission — 멤버십 없음 → false', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue(null);
    const result = await service.hasPermission(TENANT_ID, USER_ID, TenantRole.VIEWER);
    expect(result).toBe(false);
  });

  // ── listUsers ──
  it('BS-TU-12: listUsers — 정상 조회', async () => {
    prisma.tenantUser.count.mockResolvedValue(2);
    prisma.tenantUser.findMany.mockResolvedValue([
      { id: 'tu-1', user: { id: 'u-1', email: 'a@b.com', name: 'A' } },
      { id: 'tu-2', user: { id: 'u-2', email: 'c@d.com', name: 'B' } },
    ]);

    const result = await service.listUsers(TENANT_ID, { page: 1, limit: 20 });
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  // ── getUserTenants ──
  it('BS-TU-13: getUserTenants — userId로 소속 테넌트 목록', async () => {
    prisma.tenantUser.findMany.mockResolvedValue([
      { tenant: { id: 't-1', name: 'A' }, role: 'OWNER' },
      { tenant: { id: 't-2', name: 'B' }, role: 'EDITOR' },
    ]);

    const result = await service.getUserTenants(USER_ID);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe(TenantRole.OWNER);
  });

  // ── getUserRole ──
  it('BS-TU-14: getUserRole — 멤버십 없으면 null', async () => {
    prisma.tenantUser.findUnique.mockResolvedValue(null);
    const result = await service.getUserRole(TENANT_ID, USER_ID);
    expect(result).toBeNull();
  });
});
