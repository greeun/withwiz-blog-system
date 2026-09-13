import { NextResponse } from 'next/server';
// 반환 타입 선언 전용 import (실제 래핑은 route-error 의 공통 래퍼가 수행한다)
import type { withPublicApi } from '@withwiz/toolkit/next/middleware/wrappers';
import { withPublicRoute } from './route-error';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import type { SearchService } from '@withwiz/blog-core/services';

export interface SearchRoutes {
  search: { GET: ReturnType<typeof withPublicApi> };
}

export function createSearchRoutes(searchService: SearchService): SearchRoutes {
  return {
    search: {
      GET: withPublicRoute(async (context: IApiContext) => {
        const query = getSearchParam(context.request, 'q') ?? '';
        const { page, limit } = parsePagination(context.request, 12, 50);
        const category =
          getSearchParam(context.request, 'category') ?? undefined;
        const highlight =
          getSearchParam(context.request, 'highlight') === '1';

        const result = await searchService.search({
          query,
          page,
          limit,
          category,
          highlight,
        });

        return NextResponse.json(
          { success: true, data: result },
          {
            headers: {
              'Cache-Control':
                'public, s-maxage=60, stale-while-revalidate=120',
            },
          },
        );
      }),
    },
  };
}
