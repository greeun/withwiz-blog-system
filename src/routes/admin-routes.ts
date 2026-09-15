import { NextResponse } from 'next/server';
import { withAdminApi } from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import { isBlogErrorLike, toErrorResponse } from './route-error';
import { isSuperAdmin } from './route-authorization';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import type { TenantService } from '../tenant/tenant-service';
import type { TenantUserService } from '../tenant/tenant-user-service';
import type { OnboardingService } from '../onboarding/onboarding-service';
import type { PrismaClientLike } from '../types/system';
import { SystemRole } from '../types/system';

export interface SuperAdminRoutes {
  dashboard: { GET: ReturnType<typeof withAdminApi> };
  tenants: {
    list: { GET: ReturnType<typeof withAdminApi> };
    detail: { GET: ReturnType<typeof withAdminApi> };
    create: { POST: ReturnType<typeof withAdminApi> };
    update: { PUT: ReturnType<typeof withAdminApi> };
    deactivate: { PATCH: ReturnType<typeof withAdminApi> };
  };
  users: {
    list: { GET: ReturnType<typeof withAdminApi> };
    detail: { GET: ReturnType<typeof withAdminApi> };
    updateRole: { PATCH: ReturnType<typeof withAdminApi> };
    deactivate: { PATCH: ReturnType<typeof withAdminApi> };
  };
  onboarding: {
    create: { POST: ReturnType<typeof withAdminApi> };
  };
}

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}

// toolkit의 IUser.role은 'USER' | 'ADMIN'이지만,
// blog-system은 SUPER_ADMIN 역할을 확장하여 사용하므로 문자열 비교로 검증한다.
function verifySuperAdmin(context: IApiContext): NextResponse | null {
  if (!isSuperAdmin(context.user)) {
    return NextResponse.json(
      {
        success: false,
        error: { message: '슈퍼 관리자 권한이 필요합니다.' },
      },
      { status: 403 },
    );
  }
  return null;
}

export function createSuperAdminRoutes(
  tenantService: TenantService,
  tenantUserService: TenantUserService,
  prisma: PrismaClientLike,
  onboardingService?: OnboardingService,
): SuperAdminRoutes {
  return {
    dashboard: {
      GET: withAdminApi(async (context: IApiContext) => {
        const forbidden = verifySuperAdmin(context);
        if (forbidden) return forbidden;

        const [totalTenants, activeTenants, totalUsers, totalPosts] =
          await Promise.all([
            prisma.tenant?.count?.() ?? 0,
            prisma.tenant?.count?.({ where: { isActive: true } }) ?? 0,
            prisma.user?.count?.() ?? 0,
            safeCount(prisma, 'news').catch(() => 0),
          ]);

        const recentTenants = await (prisma.tenant?.findMany?.({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
            createdAt: true,
          },
        }) ?? []);

        return NextResponse.json({
          success: true,
          data: {
            stats: {
              totalTenants,
              activeTenants,
              totalUsers,
              totalPosts,
            },
            recentTenants,
          },
        });
      }),
    },

    tenants: {
      list: {
        GET: withAdminApi(async (context: IApiContext) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const { page, limit } = parsePagination(context.request);
          const search = getSearchParam(context.request, 'search');
          const status = getSearchParam(context.request, 'status');

          const result = await tenantService.listAll({
            page,
            limit,
            search: search ?? undefined,
          });

          if (status === 'active' || status === 'inactive') {
            const isActive = status === 'active';
            result.items = result.items.filter(
              (t) => t.isActive === isActive,
            );
          }

          return NextResponse.json({ success: true, data: result });
        }),
      },

      detail: {
        GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');
          const tenant = await tenantService.getById(id);

          if (!tenant) {
            return NextResponse.json(
              {
                success: false,
                error: { message: '테넌트를 찾을 수 없습니다.' },
              },
              { status: 404 },
            );
          }

          const users = await tenantUserService.listUsers(id, {
            page: 1,
            limit: 50,
          });

          return NextResponse.json({
            success: true,
            data: {
              tenant,
              users: users.items,
              userCount: users.total,
            },
          });
        }),
      },

      create: {
        POST: withAdminApi(async (context: IApiContext) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const body = await context.request.json();

          if (!body.name || !body.slug) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'name과 slug는 필수입니다.' },
              },
              { status: 400 },
            );
          }

          try {
            const tenant = await tenantService.create(body);
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

      update: {
        PUT: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');
          const body = await context.request.json();

          const existing = await tenantService.getById(id);
          if (!existing) {
            return NextResponse.json(
              {
                success: false,
                error: { message: '테넌트를 찾을 수 없습니다.' },
              },
              { status: 404 },
            );
          }

          try {
            const tenant = await tenantService.update(id, body);
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
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');

          const existing = await tenantService.getById(id);
          if (!existing) {
            return NextResponse.json(
              {
                success: false,
                error: { message: '테넌트를 찾을 수 없습니다.' },
              },
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
    },

    users: {
      list: {
        GET: withAdminApi(async (context: IApiContext) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const { page, limit } = parsePagination(context.request);
          const search = getSearchParam(context.request, 'search');

          const where = search
            ? {
                OR: [
                  {
                    email: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    name: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              }
            : {};

          const skip = (page - 1) * limit;

          const [total, items] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
              where,
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
              },
              skip,
              take: limit,
              orderBy: { createdAt: 'desc' },
            }),
          ]);

          const totalPages = Math.ceil(total / limit);

          return NextResponse.json({
            success: true,
            data: {
              items,
              page,
              limit,
              total,
              totalPages,
            },
          });
        }),
      },

      detail: {
        GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');

          const user = await prisma.user.findUnique({
            where: { id },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          });

          if (!user) {
            return NextResponse.json(
              {
                success: false,
                error: { message: '사용자를 찾을 수 없습니다.' },
              },
              { status: 404 },
            );
          }

          const memberships = await tenantUserService.getUserTenants(id);

          return NextResponse.json({
            success: true,
            data: {
              user,
              memberships,
            },
          });
        }),
      },

      updateRole: {
        PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');
          const body = await context.request.json();

          if (!body.role) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'role은 필수입니다.' },
              },
              { status: 400 },
            );
          }

          if (!Object.values(SystemRole).includes(body.role)) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: `유효하지 않은 역할입니다. 허용: ${Object.values(SystemRole).join(', ')}`,
                },
              },
              { status: 400 },
            );
          }

          if (context.user?.id === id) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: '자신의 시스템 역할은 변경할 수 없습니다.',
                },
              },
              { status: 400 },
            );
          }

          try {
            const updated = await prisma.user.update({
              where: { id },
              data: { role: body.role },
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
              },
            });

            return NextResponse.json({ success: true, data: updated });
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

      deactivate: {
        PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          const id = await getRouteParam(props, 'id');

          if (context.user?.id === id) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: '자신의 계정을 비활성화할 수 없습니다.',
                },
              },
              { status: 400 },
            );
          }

          try {
            await prisma.user.update({
              where: { id },
              data: { isActive: false },
            });

            return NextResponse.json({
              success: true,
              data: { message: '사용자가 비활성화되었습니다.' },
            });
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : '사용자 비활성화에 실패했습니다.',
                },
              },
              { status: 400 },
            );
          }
        }),
      },
    },

    onboarding: {
      create: {
        POST: withAdminApi(async (context: IApiContext) => {
          const forbidden = verifySuperAdmin(context);
          if (forbidden) return forbidden;

          if (!onboardingService) {
            return NextResponse.json(
              {
                success: false,
                error: { message: '온보딩 서비스가 비활성화되어 있습니다.' },
              },
              { status: 501 },
            );
          }

          const body = await context.request.json();

          if (!body.tenantName || !body.tenantSlug || !body.ownerUserId) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    'tenantName, tenantSlug, ownerUserId는 필수입니다.',
                },
              },
              { status: 400 },
            );
          }

          try {
            const result = await onboardingService.onboardTenant({
              tenantName: body.tenantName,
              tenantSlug: body.tenantSlug,
              ownerUserId: body.ownerUserId,
              categories: body.categories,
              createSamplePost: body.createSamplePost ?? false,
              planId: body.planId,
            });

            return NextResponse.json(
              { success: true, data: result },
              { status: 201 },
            );
          } catch (error) {
            // 온보딩은 blog-core BlogService 를 호출하므로 BlogError 가 올라올 수 있다.
            // 그 경우 blog-core 가 지정한 상태 코드와 오류 코드를 보존한다.
            if (isBlogErrorLike(error)) {
              return toErrorResponse(error);
            }
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : '온보딩에 실패했습니다.',
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

async function safeCount(
  prisma: PrismaClientLike,
  modelName: string,
): Promise<number> {
  const delegate = prisma[modelName];
  if (!delegate || typeof delegate.count !== 'function') return 0;
  return delegate.count();
}
