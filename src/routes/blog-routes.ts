import { NextResponse } from 'next/server';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
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
import { resolveTenantFromRequest } from '../tenant/tenant-middleware';
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
}

export function createBlogRoutes(
  blogService: BlogService,
  options?: BlogRoutesOptions,
  multiTenantConfig?: BlogRoutesMultiTenantConfig,
): BlogRoutes {
  const pageSize = options?.pageSize ?? 12;

  async function resolveService(
    req: Request,
  ): Promise<
    | { ok: true; service: BlogService }
    | { ok: false; response: NextResponse }
  > {
    if (!multiTenantConfig) {
      return { ok: true, service: blogService };
    }

    const tenant = await resolveTenantFromRequest(
      req,
      multiTenantConfig.tenantResolver,
      multiTenantConfig.baseDomain,
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

    const scopedService = multiTenantConfig.createScopedService(
      tenant.tenantId,
    );
    return { ok: true, service: scopedService };
  }

  return {
    public: {
      list: {
        GET: withPublicApi(async (context: IApiContext) => {
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
        GET: withPublicApi(async (context: IApiContext, props?: unknown) => {
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
        GET: withPublicApi(async (context: IApiContext) => {
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
        GET: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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

        POST: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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

        DELETE: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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
        GET: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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

        PUT: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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

        DELETE: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

          const id = await getRouteParam(props, 'id');
          await svc.remove(id);

          return new NextResponse(null, { status: 204 });
        }),
      },

      publish: {
        PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

          const id = await getRouteParam(props, 'id');
          const result = await svc.togglePublish(id);

          return NextResponse.json({ success: true, data: result });
        }),
      },

      bulk: {
        PATCH: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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

        DELETE: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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
        GET: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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
        GET: withAdminApi(async (context: IApiContext) => {
          const resolved = await resolveService(context.request);
          if (!resolved.ok) return resolved.response;
          const svc = resolved.service;

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
