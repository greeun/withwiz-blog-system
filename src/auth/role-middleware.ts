import { NextResponse } from 'next/server';
import type { TApiMiddleware, IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { TenantUserService } from '../tenant/tenant-user-service';
import { ROLE_LEVELS } from '../tenant/tenant-user-service';
import type { TenantRole } from '../types/tenant';

/**
 * 요청자가 확정된 테넌트에 `requiredRole` 이상 역할로 소속되어 있는지 확인하는 미들웨어.
 *
 * 테넌트는 앞선 서버 측 미들웨어(`createTenantResolutionMiddleware` 등)가 기록한
 * `context.metadata.tenantId` 만 신뢰한다. `X-Tenant-Id` 같은 요청 헤더는 읽지 않는다.
 */
export function createTenantRoleMiddleware(
  tenantUserService: TenantUserService,
  requiredRole: TenantRole,
): TApiMiddleware {
  return async (
    context: IApiContext,
    next: () => Promise<NextResponse>,
  ): Promise<NextResponse> => {
    const userId = context.user?.id;
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: '인증이 필요합니다.' },
        },
        { status: 401 },
      );
    }

    const tenantId = context.metadata?.tenantId as string | undefined;

    if (!tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: '테넌트 정보가 필요합니다.' },
        },
        { status: 400 },
      );
    }

    const userRole = await tenantUserService.getUserRole(tenantId, userId);

    if (!userRole) {
      return NextResponse.json(
        {
          success: false,
          error: { message: '해당 작업에 대한 권한이 없습니다.' },
        },
        { status: 403 },
      );
    }

    const userLevel = ROLE_LEVELS[userRole] ?? 0;
    const requiredLevel = ROLE_LEVELS[requiredRole];

    if (userLevel < requiredLevel) {
      return NextResponse.json(
        {
          success: false,
          error: { message: '해당 작업에 대한 권한이 없습니다.' },
        },
        { status: 403 },
      );
    }

    context.metadata.tenantId = tenantId;
    context.metadata.tenantRole = userRole;

    return next();
  };
}
