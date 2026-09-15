import { NextResponse } from 'next/server';
import { withAdminApi } from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import type { TenantService } from '../tenant/tenant-service';
import type { TenantUserService } from '../tenant/tenant-user-service';
import { TenantRole } from '../types/tenant';
import {
  CreateTenantSchema,
  UpdateTenantSchema,
} from '../validators/tenant.validator';
import type { ZodSchema } from 'zod';
import {
  forbidRoleEscalation,
  hasRoleLevel,
  requireAuthenticatedUser,
  requireSuperAdmin,
  requireTenantRole,
} from './route-authorization';

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}

function validateAndParse<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            message: '입력값 검증에 실패했습니다.',
            details: result.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      ),
    };
  }
  return { success: true, data: result.data };
}

/**
 * 테넌트 구성원이 detail.PUT 으로 바꿀 수 없는 필드.
 * 커스텀 도메인은 도메인 라우트의 중복 확인·DNS 인증 흐름을, 요금제는 과금 흐름을,
 * 활성 상태는 슈퍼 관리자 라우트를 거쳐야 하므로 이 경로에서는 거부한다.
 */
const PLATFORM_CONTROLLED_FIELDS = ['customDomain', 'planId', 'isActive'] as const;

function findPlatformControlledFields(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  return PLATFORM_CONTROLLED_FIELDS.filter(
    (field) => field in record && record[field] !== undefined,
  );
}

const serviceDisabledResponse = () =>
  NextResponse.json(
    { success: false, error: { message: '사용자 관리 기능이 비활성화되어 있습니다.' } },
    { status: 501 },
  );

export interface TenantRoutes {
  list: { GET: ReturnType<typeof withAdminApi> };
  create: { POST: ReturnType<typeof withAdminApi> };
  detail: {
    GET: ReturnType<typeof withAdminApi>;
    PUT: ReturnType<typeof withAdminApi>;
  };
  deactivate: { PATCH: ReturnType<typeof withAdminApi> };
  settings: {
    GET: ReturnType<typeof withAdminApi>;
    PUT: ReturnType<typeof withAdminApi>;
  };
  users: {
    list: { GET: ReturnType<typeof withAdminApi> };
    add: { POST: ReturnType<typeof withAdminApi> };
    updateRole: { PATCH: ReturnType<typeof withAdminApi> };
    remove: { DELETE: ReturnType<typeof withAdminApi> };
  };
}

/**
 * 테넌트 관리 라우트.
 *
 * - `list`, `create`, `deactivate`: 플랫폼 수준 작업이므로 SUPER_ADMIN 만 호출할 수 있다.
 * - 그 밖의 라우트: 경로 파라미터 `id` 테넌트에 ADMIN 이상 역할로 소속된 사용자만 호출할 수 있다.
 *   `tenantUserService` 를 전달하지 않으면 소속을 확인할 수 없으므로 403 으로 거부한다.
 */
export function createTenantRoutes(
  tenantService: TenantService,
  tenantUserService?: TenantUserService,
): TenantRoutes {
  return {
    list: {
      GET: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const { page, limit } = parsePagination(context.request);
        const search = getSearchParam(context.request, 'search');

        const result = await tenantService.listAll({
          page,
          limit,
          search: search ?? undefined,
        });

        return NextResponse.json({ success: true, data: result });
      }),
    },

    create: {
      POST: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const body = await context.request.json();
        const validation = validateAndParse(CreateTenantSchema, body);
        if (!validation.success) return validation.response;

        try {
          const tenant = await tenantService.create(validation.data);

          return NextResponse.json(
            { success: true, data: tenant },
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
                    : '테넌트 생성에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    detail: {
      GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');
        const access = await requireTenantRole(context, tenantUserService, id);
        if (!access.ok) return access.response;

        const tenant = await tenantService.getById(id);

        if (!tenant) {
          return NextResponse.json(
            { success: false, error: { message: '테넌트를 찾을 수 없습니다.' } },
            { status: 404 },
          );
        }

        return NextResponse.json({ success: true, data: tenant });
      }),

      PUT: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');
        const access = await requireTenantRole(context, tenantUserService, id);
        if (!access.ok) return access.response;

        const body = await context.request.json();

        const controlled = findPlatformControlledFields(body);
        if (controlled.length > 0) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: `이 경로에서는 ${controlled.join(', ')} 을(를) 변경할 수 없습니다.`,
              },
            },
            { status: 403 },
          );
        }

        const validation = validateAndParse(UpdateTenantSchema, body);
        if (!validation.success) return validation.response;

        const existing = await tenantService.getById(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: { message: '테넌트를 찾을 수 없습니다.' } },
            { status: 404 },
          );
        }

        try {
          const tenant = await tenantService.update(id, validation.data);

          return NextResponse.json({ success: true, data: tenant });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '테넌트 수정에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    deactivate: {
      PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const id = await getRouteParam(props, 'id');

        const existing = await tenantService.getById(id);
        if (!existing) {
          return NextResponse.json(
            { success: false, error: { message: '테넌트를 찾을 수 없습니다.' } },
            { status: 404 },
          );
        }

        await tenantService.deactivate(id);

        return NextResponse.json({
          success: true,
          data: { message: '테넌트가 비활성화되었습니다.' },
        });
      }),
    },

    settings: {
      GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');
        const access = await requireTenantRole(context, tenantUserService, id);
        if (!access.ok) return access.response;

        try {
          const settings = await tenantService.getSettings(id);

          return NextResponse.json({ success: true, data: settings });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '설정 조회에 실패했습니다.',
              },
            },
            { status: 404 },
          );
        }
      }),

      PUT: withAdminApi(async (context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');
        const access = await requireTenantRole(context, tenantUserService, id);
        if (!access.ok) return access.response;

        const body = await context.request.json();

        try {
          const settings = await tenantService.updateSettings(id, body);

          return NextResponse.json({ success: true, data: settings });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '설정 수정에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    users: {
      list: {
        GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const unauthenticated = requireAuthenticatedUser(context);
          if (unauthenticated) return unauthenticated;
          if (!tenantUserService) return serviceDisabledResponse();

          const tenantId = await getRouteParam(props, 'id');
          const access = await requireTenantRole(context, tenantUserService, tenantId);
          if (!access.ok) return access.response;

          const { page, limit } = parsePagination(context.request);

          const result = await tenantUserService.listUsers(tenantId, {
            page,
            limit,
          });

          return NextResponse.json({ success: true, data: result });
        }),
      },

      add: {
        POST: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const unauthenticated = requireAuthenticatedUser(context);
          if (unauthenticated) return unauthenticated;
          if (!tenantUserService) return serviceDisabledResponse();

          const tenantId = await getRouteParam(props, 'id');
          const access = await requireTenantRole(context, tenantUserService, tenantId);
          if (!access.ok) return access.response;

          const body = await context.request.json();

          if (!body.userId || !body.role) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'userId와 role은 필수입니다.' },
              },
              { status: 400 },
            );
          }

          if (!Object.values(TenantRole).includes(body.role)) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: `유효하지 않은 역할입니다. 허용: ${Object.values(TenantRole).join(', ')}`,
                },
              },
              { status: 400 },
            );
          }

          if (!hasRoleLevel(access.role, body.role as TenantRole)) {
            return forbidRoleEscalation();
          }

          try {
            const tenantUser = await tenantUserService.addUser(
              tenantId,
              body.userId,
              body.role as TenantRole,
            );

            return NextResponse.json(
              { success: true, data: tenantUser },
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
                      : '사용자 추가에 실패했습니다.',
                },
              },
              { status: 400 },
            );
          }
        }),
      },

      updateRole: {
        PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const unauthenticated = requireAuthenticatedUser(context);
          if (unauthenticated) return unauthenticated;
          if (!tenantUserService) return serviceDisabledResponse();

          const tenantId = await getRouteParam(props, 'id');
          const access = await requireTenantRole(context, tenantUserService, tenantId);
          if (!access.ok) return access.response;

          const body = await context.request.json();

          if (!body.userId || !body.role) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'userId와 role은 필수입니다.' },
              },
              { status: 400 },
            );
          }

          if (!Object.values(TenantRole).includes(body.role)) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: `유효하지 않은 역할입니다. 허용: ${Object.values(TenantRole).join(', ')}`,
                },
              },
              { status: 400 },
            );
          }

          // 부여할 역할과 대상의 현재 역할이 모두 요청자 역할 이하여야 한다.
          const targetRole = await tenantUserService.getUserRole(tenantId, body.userId);
          if (
            !hasRoleLevel(access.role, body.role as TenantRole) ||
            (targetRole && !hasRoleLevel(access.role, targetRole))
          ) {
            return forbidRoleEscalation();
          }

          try {
            const tenantUser = await tenantUserService.updateRole(
              tenantId,
              body.userId,
              body.role as TenantRole,
            );

            return NextResponse.json({ success: true, data: tenantUser });
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : '역할 변경에 실패했습니다.',
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
          if (!tenantUserService) return serviceDisabledResponse();

          const tenantId = await getRouteParam(props, 'id');
          const access = await requireTenantRole(context, tenantUserService, tenantId);
          if (!access.ok) return access.response;

          const body = await context.request.json();

          if (!body.userId) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'userId는 필수입니다.' },
              },
              { status: 400 },
            );
          }

          const targetRole = await tenantUserService.getUserRole(tenantId, body.userId);
          if (targetRole && !hasRoleLevel(access.role, targetRole)) {
            return forbidRoleEscalation();
          }

          try {
            await tenantUserService.removeUser(tenantId, body.userId);

            return NextResponse.json({
              success: true,
              data: { message: '사용자가 테넌트에서 제거되었습니다.' },
            });
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : '사용자 제거에 실패했습니다.',
                },
              },
              { status: 400 },
            );
          }
        }),
      },
    },
  };
}
