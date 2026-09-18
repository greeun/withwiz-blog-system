import { NextResponse } from 'next/server';
import type { TApiMiddleware, IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { TenantResolver } from './tenant-resolver';
import type { Tenant } from '../types/tenant';

export interface TenantResolutionResult {
  tenantId: string;
  tenant: Tenant;
}

/**
 * @deprecated blog-system 은 이 헤더를 읽지 않는다. 외부 클라이언트가 임의로 지정할 수 있어
 * 테넌트 식별에 신뢰할 수 없기 때문이다. 기존 import 호환을 위해 상수만 남긴다.
 */
export const TENANT_ID_HEADER = 'X-Tenant-Id';
/** @deprecated `TENANT_ID_HEADER` 와 같은 이유로 blog-system 은 이 헤더를 읽지 않는다. */
export const TENANT_SLUG_HEADER = 'X-Tenant-Slug';

/**
 * 요청 테넌트 해석의 단일 진입점.
 *
 * 호스트명(커스텀 도메인 → 서브도메인)으로만 테넌트를 식별한다. `X-Tenant-Id` 같은 요청 헤더는
 * 클라이언트가 임의로 지정할 수 있으므로 사용하지 않는다.
 */
export async function resolveTenantFromRequest(
  req: Request,
  tenantResolver: TenantResolver,
  baseDomain: string,
): Promise<TenantResolutionResult | null> {
  const { hostname } = new URL(req.url);

  const tenant = await tenantResolver.resolve(hostname, baseDomain);
  if (tenant) {
    return { tenantId: tenant.id, tenant };
  }

  return null;
}

/**
 * 요청 테넌트를 확정해 `context.metadata.tenantId`·`context.metadata.tenant` 에 기록하는 미들웨어.
 *
 * `createTenantRoleMiddleware` 는 이 값만 신뢰하므로 역할 미들웨어 앞에 둔다.
 * 앞선 서버 측 미들웨어가 이미 `metadata.tenantId` 를 확정했다면 그 값을 유지한다.
 * 테넌트를 찾지 못하면 404 로 응답하고 다음 단계로 넘기지 않는다.
 */
export function createTenantResolutionMiddleware(
  tenantResolver: TenantResolver,
  baseDomain: string,
): TApiMiddleware {
  return async (
    context: IApiContext,
    next: () => Promise<NextResponse>,
  ): Promise<NextResponse> => {
    if (typeof context.metadata?.tenantId === 'string' && context.metadata.tenantId) {
      return next();
    }

    const resolved = await resolveTenantFromRequest(
      context.request,
      tenantResolver,
      baseDomain,
    );

    if (!resolved) {
      return NextResponse.json(
        { success: false, error: { message: '테넌트를 찾을 수 없습니다.' } },
        { status: 404 },
      );
    }

    context.metadata.tenantId = resolved.tenantId;
    context.metadata.tenant = resolved.tenant;
    return next();
  };
}
