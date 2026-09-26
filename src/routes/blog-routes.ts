import { NextResponse } from 'next/server';
// 반환 타입 선언 전용 import (실제 래핑은 route-error 의 공통 래퍼가 수행한다)
import type {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import { withPublicRoute, withAdminRoute, withAuthRoute } from './route-error';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import {
  CreateBlogPostSchema,
  UpdateBlogPostSchema,
  BulkUpdateSchema,
} from '@withwiz/blog-core/validators';
import type { BlogService } from '@withwiz/blog-core/services';
import type { TenantResolver } from '../tenant/tenant-resolver';
import type { TenantUserService } from '../tenant/tenant-user-service';
import { resolveTenantFromRequest } from '../tenant/tenant-middleware';
import { TenantRole } from '../types/tenant';
import { requireTenantRole } from './route-authorization';
import type { ZodSchema } from 'zod';

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}

function parseSortKey(
  searchParams: URLSearchParams,
  validKeys: readonly string[],
  defaultKey: string,
): string {
  const raw = searchParams.get('sortBy');
  if (raw && validKeys.includes(raw)) return raw;
  return defaultKey;
}

function validateIds(
  ids: unknown,
): { valid: true; ids: string[] } | { valid: false; response: NextResponse } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      valid: false,
      response: NextResponse.json(
        { success: false, error: { message: 'ids 배열이 필요합니다.' } },
        { status: 400 },
      ),
    };
  }
  return { valid: true, ids: ids as string[] };
}

// Inlined instead of using toolkit's validateAndParse to avoid Zod version mismatch
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

const VALID_SORT_KEYS = ['createdAt', 'publishedAt', 'updatedAt'] as const;

export interface BlogRoutes {
  public: {
    list: { GET: ReturnType<typeof withPublicApi> };
    detail: { GET: ReturnType<typeof withPublicApi> };
    featured: { GET: ReturnType<typeof withPublicApi> };
  };
  admin: {
    list: {
      GET: ReturnType<typeof withAdminApi>;
      POST: ReturnType<typeof withAdminApi>;
      DELETE: ReturnType<typeof withAdminApi>;
    };
    detail: {
      GET: ReturnType<typeof withAdminApi>;
      PUT: ReturnType<typeof withAdminApi>;
      DELETE: ReturnType<typeof withAdminApi>;
    };
    publish: { PATCH: ReturnType<typeof withAdminApi> };
    bulk: {
      PATCH: ReturnType<typeof withAdminApi>;
      DELETE: ReturnType<typeof withAdminApi>;
    };
    slugCheck: { GET: ReturnType<typeof withAdminApi> };
    dashboard: { GET: ReturnType<typeof withAdminApi> };
  };
}

export interface BlogRoutesOptions {
  pageSize?: number;
}

export interface BlogRoutesMultiTenantConfig {
  createScopedService: (tenantId: string) => BlogService;
  tenantResolver: TenantResolver;
  baseDomain: string;
  /**
   * 관리 라우트의 테넌트 멤버십 확인에 사용한다.
   * 전달하지 않으면 관리 라우트는 모두 403 으로 거부한다(fail-closed).
   */
  tenantUserService?: TenantUserService;
}

type AdminHandler = (
  context: IApiContext,
  service: BlogService,
  props?: unknown,
) => Promise<NextResponse>;

/**
 * 블로그 라우트.
 *
 * 관리 라우트의 인가는 모드에 따라 다르다.
 * - single 모드(`multiTenantConfig` 없음): toolkit `withAdminApi` 로 JWT 역할 `'ADMIN'` 을 확인한다.
 * - multi 모드: toolkit `withAuthApi` 로 인증한 뒤, 요청 호스트명으로 해석한 테넌트에
 *   요청자가 소속되어 있는지 확인한다. 조회(목록·상세·슬러그 확인·대시보드)는 VIEWER 이상,
 *   쓰기(생성·수정·삭제·발행·일괄 처리)는 EDITOR 이상 역할이 필요하다.
 *   테넌트를 찾지 못하면 404, 소속이 아니거나 역할이 부족하면 403 이다.
 */
export function createBlogRoutes(
  blogService: BlogService,
  options?: BlogRoutesOptions,
  multiTenantConfig?: BlogRoutesMultiTenantConfig,
): BlogRoutes {
  const pageSize = options?.pageSize ?? 12;

  async function resolveTenantId(
    req: Request,
    config: BlogRoutesMultiTenantConfig,
  ): Promise<
    | { ok: true; tenantId: string }
    | { ok: false; response: NextResponse }
  > {
    const tenant = await resolveTenantFromRequest(
      req,
      config.tenantResolver,
      config.baseDomain,
    );

    if (!tenant) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: { message: '테넌트를 찾을 수 없습니다.' } },
          { status: 404 },
        ),
      };
    }

    return { ok: true, tenantId: tenant.tenantId };
  }

  async function resolveService(
    req: Request,
  ): Promise<
    | { ok: true; service: BlogService }
    | { ok: false; response: NextResponse }
  > {
    if (!multiTenantConfig) {
      return { ok: true, service: blogService };
    }

    const resolved = await resolveTenantId(req, multiTenantConfig);
    if (!resolved.ok) return resolved;

    const scopedService = multiTenantConfig.createScopedService(
      resolved.tenantId,
    );
    return { ok: true, service: scopedService };
  }

  /** 모드에 맞는 인가를 거친 뒤 대상 서비스를 핸들러에 넘기는 관리 라우트 래퍼 */
  function adminRoute(
    requiredRole: TenantRole,
    handler: AdminHandler,
  ): ReturnType<typeof withAdminApi> {
    if (!multiTenantConfig) {
      return withAdminRoute((context, props) =>
        handler(context, blogService, props),
      );
    }

    const config = multiTenantConfig;
    return withAuthRoute(async (context, props) => {
      const resolved = await resolveTenantId(context.request, config);
      if (!resolved.ok) return resolved.response;

      const access = await requireTenantRole(
        context,
        config.tenantUserService,
        resolved.tenantId,
        requiredRole,
      );
      if (!access.ok) return access.response;

      return handler(
        context,
        config.createScopedService(resolved.tenantId),
        props,
      );
    });
  }

  return {
    public: {
      list: {
        GET: withPublicRoute(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

          const parsed = parsePagination(context.request, pageSize, 50);
          const page = Number.isFinite(parsed.page) ? parsed.page : 1;
          const limit = Number.isFinite(parsed.limit) ? parsed.limit : pageSize;
          const category = getSearchParam(context.request, 'category');
          const search = getSearchParam(context.request, 'search');

          const result = await svc.listPublished({
            page,
            limit,
            category,
            search,
          });

          return NextResponse.json(
            { success: true, data: result },
            {
              headers: {
                'Cache-Control':
                  'public, s-maxage=300, stale-while-revalidate=600',
              },
            },
          );
        }),
      },

      detail: {
        GET: withPublicRoute(async (context: IApiContext, props?: unknown) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

          const slug = await getRouteParam(props, 'slug');
          const post = await svc.getPublishedBySlug(slug);

          if (!post) {
            return NextResponse.json(
              { success: false, error: { message: 'Post not found' } },
              { status: 404 },
            );
          }

          return NextResponse.json(
            { success: true, data: post },
            {
              headers: {
                'Cache-Control':
                  'public, s-maxage=300, stale-while-revalidate=600',
              },
            },
          );
        }),
      },

      featured: {
        GET: withPublicRoute(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

          const limitParam = getSearchParam(context.request, 'limit');
          const limit = limitParam ? parseInt(limitParam, 10) : undefined;

          const result = await svc.getFeatured(limit);

          return NextResponse.json(
            { success: true, data: result },
            {
              headers: {
                'Cache-Control':
                  'public, s-maxage=300, stale-while-revalidate=600',
              },
            },
          );
        }),
      },
    },

    admin: {
      list: {
        GET: adminRoute(TenantRole.VIEWER, async (context: IApiContext, svc: BlogService) => {

          const { page, limit } = parsePagination(context.request);
          const { searchParams } = new URL(context.request.url);
          const category = getSearchParam(context.request, 'category');
          const published = getSearchParam(context.request, 'published');
          const search = getSearchParam(context.request, 'search');
          const sortBy = parseSortKey(
            searchParams,
            VALID_SORT_KEYS,
            'updatedAt',
          ) as 'createdAt' | 'publishedAt' | 'updatedAt';

          const result = await svc.listAll({
            page,
            limit,
            category,
            published,
            search,
            sortBy,
          });

          return NextResponse.json({ success: true, data: result });
        }),

        POST: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService) => {

          const body = await context.request.json();
          const validation = validateAndParse(CreateBlogPostSchema, body);
          if (!validation.success) return validation.response;

          const post = await svc.create(
            validation.data,
            context.user!.id,
          );

          return NextResponse.json(
            { success: true, data: post },
            { status: 201 },
          );
        }),

        DELETE: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService) => {

          const body = await context.request.json();
          const check = validateIds(body.ids);
          if (!check.valid) return check.response;

          const deleted = await svc.removeMany(check.ids);

          return NextResponse.json({
            success: true,
            data: { deleted },
          });
        }),
      },

      detail: {
        GET: adminRoute(TenantRole.VIEWER, async (context: IApiContext, svc: BlogService, props?: unknown) => {

          const id = await getRouteParam(props, 'id');
          const post = await svc.getById(id);

          if (!post) {
            return NextResponse.json(
              { success: false, error: { message: 'Post not found' } },
              { status: 404 },
            );
          }

          return NextResponse.json({ success: true, data: post });
        }),

        PUT: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService, props?: unknown) => {

          const id = await getRouteParam(props, 'id');
          const body = await context.request.json();
          const validation = validateAndParse(UpdateBlogPostSchema, body);
          if (!validation.success) return validation.response;

          const existing = await svc.getById(id);
          if (!existing) {
            return NextResponse.json(
              { success: false, error: { message: 'Post not found' } },
              { status: 404 },
            );
          }

          const post = await svc.update(id, validation.data);

          return NextResponse.json({ success: true, data: post });
        }),

        DELETE: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService, props?: unknown) => {

          const id = await getRouteParam(props, 'id');
          await svc.remove(id);

          return new NextResponse(null, { status: 204 });
        }),
      },

      publish: {
        PATCH: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService, props?: unknown) => {

          const id = await getRouteParam(props, 'id');
          const result = await svc.togglePublish(id);

          return NextResponse.json({ success: true, data: result });
        }),
      },

      bulk: {
        PATCH: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService) => {

          const body = await context.request.json();
          const validation = validateAndParse(BulkUpdateSchema, body);
          if (!validation.success) return validation.response;

          const { ids, published, featured } = validation.data;
          let count = 0;

          if (published !== undefined) {
            count = await svc.bulkUpdatePublished(ids, published);
          }
          if (featured !== undefined) {
            count = await svc.bulkUpdateFeatured(ids, featured);
          }

          return NextResponse.json({
            success: true,
            data: { count },
          });
        }),

        DELETE: adminRoute(TenantRole.EDITOR, async (context: IApiContext, svc: BlogService) => {

          const body = await context.request.json();
          const check = validateIds(body.ids);
          if (!check.valid) return check.response;

          const deleted = await svc.removeMany(check.ids);

          return NextResponse.json({
            success: true,
            data: { deleted },
          });
        }),
      },

      slugCheck: {
        GET: adminRoute(TenantRole.VIEWER, async (context: IApiContext, svc: BlogService) => {

          const { searchParams } = new URL(context.request.url);
          const slug = searchParams.get('slug')?.trim();
          const excludeId = searchParams.get('excludeId') || undefined;

          if (!slug) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'slug는 필수 파라미터입니다.' },
              },
              { status: 400 },
            );
          }

          const available = await svc.checkSlugAvailable(
            slug,
            excludeId,
          );

          return NextResponse.json(
            { success: true, data: { available } },
            { headers: { 'Cache-Control': 'private, max-age=10' } },
          );
        }),
      },

      dashboard: {
        GET: adminRoute(TenantRole.VIEWER, async (context: IApiContext, svc: BlogService) => {

          const stats = await svc.getDashboardStats();

          // 호환성을 위한 카테고리 데이터 변환
          const categories: Record<
            string,
            { total: number; published: number }
          > = {};
          for (const [cat, count] of Object.entries(stats.byCategory)) {
            categories[cat] = { total: count, published: 0 };
          }

          return NextResponse.json({
            success: true,
            data: {
              total: stats.total,
              published: stats.published,
              draft: stats.unpublished,
              categories,
              recent: stats.recentPosts,
            },
          });
        }),
      },
    },
  };
}
