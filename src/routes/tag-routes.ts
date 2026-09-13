import { NextResponse } from 'next/server';
// 반환 타입 선언 전용 import (실제 래핑은 route-error 의 공통 래퍼가 수행한다)
import type {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import { withPublicRoute, withAdminRoute } from './route-error';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import type { TagService } from '@withwiz/blog-core/services';

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { message } },
    { status: 400 },
  );
}

export interface TagRoutes {
  public: {
    list: { GET: ReturnType<typeof withPublicApi> };
    cloud: { GET: ReturnType<typeof withPublicApi> };
    posts: { GET: ReturnType<typeof withPublicApi> };
  };
  admin: {
    list: {
      GET: ReturnType<typeof withAdminApi>;
      POST: ReturnType<typeof withAdminApi>;
    };
    detail: {
      GET: ReturnType<typeof withAdminApi>;
      PUT: ReturnType<typeof withAdminApi>;
      DELETE: ReturnType<typeof withAdminApi>;
    };
    byPost: { GET: ReturnType<typeof withAdminApi> };
  };
}

export function createTagRoutes(tagService: TagService): TagRoutes {
  return {
    public: {
      list: {
        GET: withPublicRoute(async (context: IApiContext) => {
          const parsed = parsePagination(context.request, 20, 100);
          const page = Number.isFinite(parsed.page) ? parsed.page : 1;
          const limit = Number.isFinite(parsed.limit) ? parsed.limit : 20;
          const search = getSearchParam(context.request, 'search') ?? undefined;

          const result = await tagService.listAll({ page, limit, search });

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

      cloud: {
        GET: withPublicRoute(async (context: IApiContext) => {
          const limitParam = getSearchParam(context.request, 'limit');
          const limit = limitParam ? parseInt(limitParam, 10) : undefined;

          const result = await tagService.getTagCloud(
            Number.isFinite(limit) ? (limit as number) : undefined,
          );

          return NextResponse.json(
            { success: true, data: result },
            {
              headers: {
                'Cache-Control':
                  'public, s-maxage=600, stale-while-revalidate=1800',
              },
            },
          );
        }),
      },

      posts: {
        GET: withPublicRoute(async (context: IApiContext, props?: unknown) => {
          const slug = await getRouteParam(props, 'slug');
          const parsed = parsePagination(context.request, 12, 50);
          const page = Number.isFinite(parsed.page) ? parsed.page : 1;
          const limit = Number.isFinite(parsed.limit) ? parsed.limit : 12;

          const result = await tagService.getPostsByTag(slug, { page, limit });

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
        GET: withAdminRoute(async (context: IApiContext) => {
          const { page, limit } = parsePagination(context.request);
          const search = getSearchParam(context.request, 'search') ?? undefined;

          const result = await tagService.listAll({ page, limit, search });

          return NextResponse.json({ success: true, data: result });
        }),

        POST: withAdminRoute(async (context: IApiContext) => {
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }
          const { slug, name, description } = body as Record<string, unknown>;
          if (typeof slug !== 'string' || !slug.trim()) {
            return badRequest('slug는 필수입니다.');
          }
          if (typeof name !== 'string' || !name.trim()) {
            return badRequest('name은 필수입니다.');
          }

          const created = await tagService.create({
            slug: slug.trim(),
            name: name.trim(),
            description:
              typeof description === 'string' ? description : undefined,
          });

          return NextResponse.json(
            { success: true, data: created },
            { status: 201 },
          );
        }),
      },

      detail: {
        GET: withAdminRoute(async (_context: IApiContext, props?: unknown) => {
          const id = await getRouteParam(props, 'id');
          const tag = await tagService.getById(id);
          if (!tag) {
            return NextResponse.json(
              { success: false, error: { message: 'Tag not found' } },
              { status: 404 },
            );
          }
          return NextResponse.json({ success: true, data: tag });
        }),

        PUT: withAdminRoute(async (context: IApiContext, props?: unknown) => {
          const id = await getRouteParam(props, 'id');
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }

          const existing = await tagService.getById(id);
          if (!existing) {
            return NextResponse.json(
              { success: false, error: { message: 'Tag not found' } },
              { status: 404 },
            );
          }

          const { slug, name, description } = body as Record<string, unknown>;
          const data: Record<string, unknown> = {};
          if (typeof slug === 'string') data.slug = slug.trim();
          if (typeof name === 'string') data.name = name.trim();
          if (typeof description === 'string') data.description = description;

          const updated = await tagService.update(id, data);
          return NextResponse.json({ success: true, data: updated });
        }),

        DELETE: withAdminRoute(async (_context: IApiContext, props?: unknown) => {
          const id = await getRouteParam(props, 'id');
          await tagService.remove(id);
          return new NextResponse(null, { status: 204 });
        }),
      },

      byPost: {
        GET: withAdminRoute(async (_context: IApiContext, props?: unknown) => {
          const postId = await getRouteParam(props, 'postId');
          const tags = await tagService.getTagsByPost(postId);
          return NextResponse.json({ success: true, data: tags });
        }),
      },
    },
  };
}
