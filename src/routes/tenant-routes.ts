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

export function createTenantRoutes(
  tenantService: TenantService,
  tenantUserService?: TenantUserService,
): TenantRoutes {
  return {
    list: {
      GET: withAdminApi(async (context: IApiContext) => {
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
      GET: withAdminApi(async (_context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');
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
        const body = await context.request.json();
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
      PATCH: withAdminApi(async (_context: IApiContext, props?: unknown) => {
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
      GET: withAdminApi(async (_context: IApiContext, props?: unknown) => {
        const id = await getRouteParam(props, 'id');

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
          const tenantId = await getRouteParam(props, 'id');
          const { page, limit } = parsePagination(context.request);

          if (!tenantUserService) {
            return NextResponse.json(
              { success: false, error: { message: '사용자 관리 기능이 비활성화되어 있습니다.' } },
              { status: 501 },
            );
          }

          const result = await tenantUserService.listUsers(tenantId, {
            page,
            limit,
          });

          return NextResponse.json({ success: true, data: result });
        }),
      },

      add: {
        POST: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const tenantId = await getRouteParam(props, 'id');
          const body = await context.request.json();

          if (!tenantUserService) {
            return NextResponse.json(
              { success: false, error: { message: '사용자 관리 기능이 비활성화되어 있습니다.' } },
              { status: 501 },
            );
          }

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
          const tenantId = await getRouteParam(props, 'id');
          const body = await context.request.json();

          if (!tenantUserService) {
            return NextResponse.json(
              { success: false, error: { message: '사용자 관리 기능이 비활성화되어 있습니다.' } },
              { status: 501 },
            );
          }

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
          const tenantId = await getRouteParam(props, 'id');
          const body = await context.request.json();

          if (!tenantUserService) {
            return NextResponse.json(
              { success: false, error: { message: '사용자 관리 기능이 비활성화되어 있습니다.' } },
              { status: 501 },
            );
          }

          if (!body.userId) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'userId는 필수입니다.' },
              },
              { status: 400 },
            );
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
