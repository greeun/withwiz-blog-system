import { NextResponse } from 'next/server';
import { withAdminApi } from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import { parsePagination } from '@withwiz/toolkit/next/utils/api-helpers';
import type { DomainService } from '../tenant/domain-service';
import type { TenantUserService } from '../tenant/tenant-user-service';
import {
  requireAuthenticatedUser,
  requireSuperAdmin,
  requireTenantRole,
} from './route-authorization';

export interface DomainRoutes {
  add: { POST: ReturnType<typeof withAdminApi> };
  verify: { POST: ReturnType<typeof withAdminApi> };
  status: { GET: ReturnType<typeof withAdminApi> };
  remove: { DELETE: ReturnType<typeof withAdminApi> };
  list: { GET: ReturnType<typeof withAdminApi> };
}

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}

/**
 * 커스텀 도메인 관리 라우트.
 *
 * - `add`, `verify`, `status`, `remove`: 대상 테넌트(경로 파라미터 `id` 또는 요청의 `tenantId`)에
 *   ADMIN 이상 역할로 소속된 사용자만 호출할 수 있다. `tenantUserService` 를 전달하지 않으면 403 으로 거부한다.
 * - `list`: 모든 테넌트의 도메인을 조회하므로 SUPER_ADMIN 만 호출할 수 있다.
 */
export function createDomainRoutes(
  domainService: DomainService,
  tenantUserService?: TenantUserService,
): DomainRoutes {
  return {
    add: {
      POST: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const tenantId = props
          ? await getRouteParam(props, 'id')
          : null;

        const body = await context.request.json();
        const { domain } = body;

        if (!tenantId && !body.tenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        if (!domain || typeof domain !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'domain은 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!domainPattern.test(domain)) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '유효하지 않은 도메인 형식입니다.' },
            },
            { status: 400 },
          );
        }

        const targetTenantId = tenantId ?? body.tenantId;
        const access = await requireTenantRole(context, tenantUserService, targetTenantId);
        if (!access.ok) return access.response;

        try {
          const result = await domainService.addCustomDomain(
            targetTenantId,
            domain,
          );

          return NextResponse.json(
            { success: true, data: result },
            { status: 201 },
          );
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '도메인 추가에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    verify: {
      POST: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const tenantId = props
          ? await getRouteParam(props, 'id')
          : null;

        const body = await context.request.json();
        const { domain } = body;

        if (!tenantId && !body.tenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        if (!domain || typeof domain !== 'string') {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'domain은 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const targetTenantId = tenantId ?? body.tenantId;
        const access = await requireTenantRole(context, tenantUserService, targetTenantId);
        if (!access.ok) return access.response;

        try {
          const verified = await domainService.verifyDomain(
            targetTenantId,
            domain,
          );

          return NextResponse.json({
            success: true,
            data: { verified },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '도메인 인증에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    status: {
      GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const tenantId = props
          ? await getRouteParam(props, 'id')
          : null;

        const url = new URL(context.request.url);
        const domain = url.searchParams.get('domain');
        const resolvedTenantId =
          tenantId ?? url.searchParams.get('tenantId');

        if (!resolvedTenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        if (!domain) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'domain 쿼리 파라미터는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, resolvedTenantId);
        if (!access.ok) return access.response;

        try {
          const result = await domainService.checkVerification(
            resolvedTenantId,
            domain,
          );

          return NextResponse.json({ success: true, data: result });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '인증 상태 조회에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    remove: {
      DELETE: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const tenantId = props
          ? await getRouteParam(props, 'id')
          : null;

        let resolvedTenantId = tenantId;
        if (!resolvedTenantId) {
          const url = new URL(context.request.url);
          resolvedTenantId = url.searchParams.get('tenantId');
        }

        if (!resolvedTenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, resolvedTenantId);
        if (!access.ok) return access.response;

        try {
          await domainService.removeCustomDomain(resolvedTenantId);

          return NextResponse.json({
            success: true,
            data: { message: '커스텀 도메인이 제거되었습니다.' },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '도메인 제거에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    list: {
      GET: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const { page, limit } = parsePagination(context.request);

        const result = await domainService.listCustomDomains({
          page,
          limit,
        });

        return NextResponse.json({ success: true, data: result });
      }),
    },
  };
}
