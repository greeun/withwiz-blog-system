/**
 * Task 9: role-middleware (createTenantRoleMiddleware) 테스트 (5건)
 *
 * 테넌트는 앞선 미들웨어가 확정한 context.metadata.tenantId 로만 전달한다.
 * X-Tenant-Id 헤더를 무시하는지는 tests/security/tenant-header-trust.test.ts 에서 검증한다.
 */
import { describe, it, expect, vi } from 'vitest';
import { createTenantRoleMiddleware } from '@withwiz/blog-system/auth';
import { TenantRole } from '@withwiz/blog-system/types';

function createMockContext(overrides: {
  userId?: string;
  tenantId?: string;
} = {}) {
  return {
    request: {
      headers: new Headers(),
      url: 'http://localhost/api/test',
    } as unknown as Request,
    user: overrides.userId ? { id: overrides.userId, role: 'ADMIN' } : undefined,
    metadata: overrides.tenantId ? { tenantId: overrides.tenantId } : {},
  } as any;
}

function createMockTenantUserService() {
  return {
    hasPermission: vi.fn(),
    getUserRole: vi.fn(),
    addUser: vi.fn(),
    removeUser: vi.fn(),
    updateRole: vi.fn(),
    listUsers: vi.fn(),
    getUserTenants: vi.fn(),
  };
}

describe('createTenantRoleMiddleware', () => {
  it('BS-RM-01: userId 없음 → 401', async () => {
    const mockService = createMockTenantUserService();
    const middleware = createTenantRoleMiddleware(mockService, TenantRole.EDITOR);
    const context = createMockContext({});
    const next = vi.fn();

    const response = await middleware(context, next);
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('BS-RM-02: 확정된 metadata.tenantId 없음 → 400', async () => {
    const mockService = createMockTenantUserService();
    const middleware = createTenantRoleMiddleware(mockService, TenantRole.EDITOR);
    const context = createMockContext({ userId: 'u-1' });
    const next = vi.fn();

    const response = await middleware(context, next);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('BS-RM-03: 권한 부족(역할 낮음) → 403', async () => {
    const mockService = createMockTenantUserService();
    mockService.getUserRole.mockResolvedValue(TenantRole.VIEWER);
    const middleware = createTenantRoleMiddleware(mockService, TenantRole.ADMIN);
    const context = createMockContext({ userId: 'u-1', tenantId: 't-1' });
    const next = vi.fn();

    const response = await middleware(context, next);
    const body = await response.json();
    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    // DB 쿼리는 단 한 번 (getUserRole만) — hasPermission은 호출되지 않음
    expect(mockService.getUserRole).toHaveBeenCalledTimes(1);
    expect(mockService.hasPermission).not.toHaveBeenCalled();
  });

  it('BS-RM-03b: 멤버십 없음 → 403', async () => {
    const mockService = createMockTenantUserService();
    mockService.getUserRole.mockResolvedValue(null);
    const middleware = createTenantRoleMiddleware(mockService, TenantRole.EDITOR);
    const context = createMockContext({ userId: 'u-1', tenantId: 't-1' });
    const next = vi.fn();

    const response = await middleware(context, next);
    expect(response.status).toBe(403);
    expect(mockService.getUserRole).toHaveBeenCalledTimes(1);
    expect(mockService.hasPermission).not.toHaveBeenCalled();
  });

  it('BS-RM-04: 권한 충분 → next() 호출 + metadata.tenantRole 설정 (단일 DB 쿼리)', async () => {
    const mockService = createMockTenantUserService();
    mockService.getUserRole.mockResolvedValue(TenantRole.OWNER);

    const middleware = createTenantRoleMiddleware(mockService, TenantRole.EDITOR);
    const context = createMockContext({ userId: 'u-1', tenantId: 't-1' });
    const nextResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    const next = vi.fn().mockResolvedValue(nextResponse);

    const response = await middleware(context, next);
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalled();
    expect(context.metadata.tenantRole).toBe(TenantRole.OWNER);
    expect(context.metadata.tenantId).toBe('t-1');
    // 최적화 검증: getUserRole만 1회 호출, hasPermission은 호출되지 않음
    expect(mockService.getUserRole).toHaveBeenCalledTimes(1);
    expect(mockService.hasPermission).not.toHaveBeenCalled();
  });
});
