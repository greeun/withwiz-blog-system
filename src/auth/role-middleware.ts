import { NextResponse } from 'next/server';
import type { TApiMiddleware, IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { TenantUserService } from '../tenant/tenant-user-service';
import { ROLE_LEVELS } from '../tenant/tenant-user-service';
import type { TenantRole } from '../types/tenant';
import { TENANT_ID_HEADER } from '../tenant/tenant-middleware';

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

    const tenantId =
      context.request.headers.get(TENANT_ID_HEADER) ??
      (context.metadata?.tenantId as string | undefined);

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
