import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import {
  parsePagination,
  getSearchParam,
} from '@withwiz/toolkit/next/utils/api-helpers';
import type { CommentService } from '@withwiz/blog-core/services';
import type {
  CommentStatus,
  CreateCommentInput,
} from '@withwiz/blog-core/types';

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

// Priority: CF-Connecting-IP > X-Real-IP > X-Forwarded-For (first entry)
export function extractClientIp(request: Request): string | null {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf && cf.trim()) return cf.trim();

  const real = request.headers.get('x-real-ip');
  if (real && real.trim()) return real.trim();

  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}

export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

const COMMENT_STATUS_VALUES: CommentStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SPAM',
];
function isCommentStatus(value: unknown): value is CommentStatus {
  return (
    typeof value === 'string' &&
    COMMENT_STATUS_VALUES.includes(value as CommentStatus)
  );
}

export interface CommentRoutesConfig {
  requireLogin?: boolean;
  hmacSecret?: string;
}

export interface CommentRoutes {
  public: {
    list: { GET: ReturnType<typeof withPublicApi> };
    create: { POST: ReturnType<typeof withPublicApi> };
  };
  admin: {
    listAll: { GET: ReturnType<typeof withAdminApi> };
    updateStatus: { PATCH: ReturnType<typeof withAdminApi> };
    bulkUpdateStatus: { PATCH: ReturnType<typeof withAdminApi> };
    remove: { DELETE: ReturnType<typeof withAdminApi> };
    bulkRemove: { DELETE: ReturnType<typeof withAdminApi> };
    pendingCount: { GET: ReturnType<typeof withAdminApi> };
  };
}

export function createCommentRoutes(
  commentService: CommentService,
  config: CommentRoutesConfig = {},
): CommentRoutes {
  const hmacSecret =
    config.hmacSecret ?? process.env.JWT_SECRET ?? 'comment-ip-hash-default';
  void config.requireLogin; // 실제 로그인 검증은 CommentService 내부에서 수행

  return {
    public: {
      list: {
        GET: withPublicApi(async (context: IApiContext) => {
          const postId = getSearchParam(context.request, 'postId');
          if (!postId) {
            return badRequest('postId는 필수 파라미터입니다.');
          }
          const includeRepliesParam = getSearchParam(
            context.request,
            'includeReplies',
          );
          const includeReplies = includeRepliesParam !== 'false';

          const comments = await commentService.listByPost(postId, {
            includeReplies,
          });

          return NextResponse.json(
            { success: true, data: comments },
            {
              headers: {
                'Cache-Control':
                  'public, s-maxage=60, stale-while-revalidate=120',
              },
            },
          );
        }),
      },

      create: {
        POST: withPublicApi(async (context: IApiContext) => {
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }

          const {
            postId,
            parentId,
            content,
            guestName,
            guestEmail,
            honeypot,
          } = body as Record<string, unknown>;

          if (typeof postId !== 'string' || !postId.trim()) {
            return badRequest('postId는 필수입니다.');
          }
          if (typeof content !== 'string' || !content.trim()) {
            return badRequest('content는 필수입니다.');
          }

          const input: CreateCommentInput = {
            postId: postId.trim(),
            content: content.trim(),
          };
          if (typeof parentId === 'string' && parentId.trim()) {
            input.parentId = parentId.trim();
          }
          if (typeof guestName === 'string') input.guestName = guestName;
          if (typeof guestEmail === 'string') input.guestEmail = guestEmail;
          if (typeof honeypot === 'string') input.honeypot = honeypot;

          const ip = extractClientIp(context.request);
          const ipHash = ip ? hashIp(ip, hmacSecret) : undefined;
          const userId = context.user?.id;

          try {
            const created = await commentService.create(input, {
              userId,
              ipHash,
            });
            return NextResponse.json(
              { success: true, data: created },
              { status: 201 },
            );
          } catch (err) {
            const message =
              err instanceof Error ? err.message : '댓글 작성에 실패했습니다.';
            return NextResponse.json(
              { success: false, error: { message } },
              { status: 400 },
            );
          }
        }),
      },
    },

    admin: {
      listAll: {
        GET: withAdminApi(async (context: IApiContext) => {
          const { page, limit } = parsePagination(context.request);
          const statusParam = getSearchParam(context.request, 'status');
          const postId = getSearchParam(context.request, 'postId') ?? undefined;

          const status = isCommentStatus(statusParam)
            ? statusParam
            : undefined;

          const result = await commentService.listAll({
            page,
            limit,
            status,
            postId,
          });

          return NextResponse.json({ success: true, data: result });
        }),
      },

      updateStatus: {
        PATCH: withAdminApi(async (context: IApiContext, props?: unknown) => {
          const id = await getRouteParam(props, 'id');
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }
          const { status } = body as Record<string, unknown>;
          if (!isCommentStatus(status)) {
            return badRequest(
              `status는 ${COMMENT_STATUS_VALUES.join(', ')} 중 하나여야 합니다.`,
            );
          }
          const updated = await commentService.updateStatus(id, status);
          return NextResponse.json({ success: true, data: updated });
        }),
      },

      bulkUpdateStatus: {
        PATCH: withAdminApi(async (context: IApiContext) => {
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }
          const { ids, status } = body as Record<string, unknown>;
          if (!Array.isArray(ids) || ids.length === 0) {
            return badRequest('ids 배열이 필요합니다.');
          }
          if (!isCommentStatus(status)) {
            return badRequest(
              `status는 ${COMMENT_STATUS_VALUES.join(', ')} 중 하나여야 합니다.`,
            );
          }
          const count = await commentService.bulkUpdateStatus(
            ids as string[],
            status,
          );
          return NextResponse.json({ success: true, data: { count } });
        }),
      },

      remove: {
        DELETE: withAdminApi(async (_context: IApiContext, props?: unknown) => {
          const id = await getRouteParam(props, 'id');
          await commentService.remove(id);
          return new NextResponse(null, { status: 204 });
        }),
      },

      bulkRemove: {
        DELETE: withAdminApi(async (context: IApiContext) => {
          const body = await context.request.json().catch(() => null);
          if (!body || typeof body !== 'object') {
            return badRequest('요청 본문이 올바르지 않습니다.');
          }
          const { ids } = body as Record<string, unknown>;
          if (!Array.isArray(ids) || ids.length === 0) {
            return badRequest('ids 배열이 필요합니다.');
          }
          const count = await commentService.removeMany(ids as string[]);
          return NextResponse.json({ success: true, data: { count } });
        }),
      },

      pendingCount: {
        GET: withAdminApi(async () => {
          const count = await commentService.getPendingCount();
          return NextResponse.json({ success: true, data: { count } });
        }),
      },
    },
  };
}
