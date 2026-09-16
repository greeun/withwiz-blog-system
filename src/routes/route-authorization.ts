import { NextResponse } from 'next/server';
import type { IApiContext, IUser } from '@withwiz/toolkit/next/middleware/types';
import type { TenantUserService } from '../tenant/tenant-user-service';
import { ROLE_LEVELS } from '../tenant/tenant-user-service';
import { TenantRole } from '../types/tenant';
import { SystemRole } from '../types/system';

/**
 * 관리 라우트 인가 헬퍼.
 *
 * 관리 라우트는 toolkit `withAuthApi` 로 인증만 확인하고, 역할 판정은 모두 이 모듈이 맡는다.
 * toolkit `withAdminApi` 는 JWT 역할이 toolkit 관리자 역할(`'ADMIN'` 고정)인 요청만 통과시키므로
 * blog-system 시스템 역할(USER·SUPER_ADMIN)과 맞지 않아 사용하지 않는다.
 * 이 모듈은 시스템 역할(SUPER_ADMIN)과 테넌트 멤버십 역할을 확인하며,
 * 확인에 필요한 정보가 없으면 항상 거부한다(fail-closed).
 *
 * `withAuthApi` 로 감싼 핸들러는 인가 헬퍼를 호출하지 않으면 로그인한 모든 사용자에게 열리므로,
 * 관리 핸들러는 반드시 `requireSuperAdmin` 또는 `requireTenantRole` 을 먼저 호출한다.
 */

type Rejection = { ok: false; response: NextResponse };

function reject(status: 401 | 403, message: string): NextResponse {
  return NextResponse.json({ success: false, error: { message } }, { status });
}

/** toolkit `IUser.role` 은 문자열이므로 blog-system 확장 역할과 문자열로 비교한다. */
export function isSuperAdmin(user: IUser | undefined | null): boolean {
  return !!user && (user.role as string) === SystemRole.SUPER_ADMIN;
}

/** 인증 정보가 없으면 401 응답, 있으면 `null` */
export function requireAuthenticatedUser(context: IApiContext): NextResponse | null {
  if (!context.user?.id) {
    return reject(401, '인증이 필요합니다.');
  }
  return null;
}

/** 인증 정보가 없으면 401, SUPER_ADMIN 이 아니면 403 응답. 통과하면 `null` */
export function requireSuperAdmin(context: IApiContext): NextResponse | null {
  const unauthenticated = requireAuthenticatedUser(context);
  if (unauthenticated) return unauthenticated;

  if (!isSuperAdmin(context.user)) {
    return reject(403, '슈퍼 관리자 권한이 필요합니다.');
  }
  return null;
}

/**
 * 요청자가 `tenantId` 테넌트에 `requiredRole` 이상 역할로 소속되어 있는지 확인한다.
 *
 * - 인증 정보 없음 → 401
 * - 멤버십 서비스 없음, tenantId 없음, 비소속, 역할 부족 → 403
 *
 * 시스템 역할(SUPER_ADMIN 포함)은 테넌트 멤버십을 대신하지 않는다.
 * 통과하면 요청자의 테넌트 역할을 돌려준다.
 */
export async function requireTenantRole(
  context: IApiContext,
  tenantUserService: TenantUserService | undefined,
  tenantId: string | null | undefined,
  requiredRole: TenantRole = TenantRole.ADMIN,
): Promise<{ ok: true; role: TenantRole } | Rejection> {
  const unauthenticated = requireAuthenticatedUser(context);
  if (unauthenticated) return { ok: false, response: unauthenticated };

  if (!tenantUserService || !tenantId) {
    return { ok: false, response: reject(403, '테넌트 권한을 확인할 수 없습니다.') };
  }

  const role = await tenantUserService.getUserRole(tenantId, context.user!.id);
  if (!role || !hasRoleLevel(role, requiredRole)) {
    return { ok: false, response: reject(403, '해당 테넌트에 대한 권한이 없습니다.') };
  }

  return { ok: true, role };
}

/** `actorRole` 이 `targetRole` 이상 수준이면 true. 알 수 없는 역할은 0 수준으로 본다. */
export function hasRoleLevel(actorRole: TenantRole, targetRole: TenantRole): boolean {
  return (ROLE_LEVELS[actorRole] ?? 0) >= (ROLE_LEVELS[targetRole] ?? Number.POSITIVE_INFINITY);
}

/** 요청자 역할보다 높은 역할을 부여하거나 그런 구성원을 변경·제거하려 할 때 쓰는 403 응답 */
export function forbidRoleEscalation(): NextResponse {
  return reject(403, '자신보다 높은 역할을 부여하거나 변경할 수 없습니다.');
}
