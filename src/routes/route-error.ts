/**
 * 라우트 공통 오류 변환 헬퍼
 *
 * @withwiz/blog-core 의 서비스는 `BlogError(code, message, statusCode)` 로
 * 의미론적 HTTP 상태 코드를 전달한다(예: TAG_DUPLICATE_SLUG → 409,
 * COMMENT_RATE_LIMIT_EXCEEDED → 429). 이 모듈은 그 상태 코드와 오류 코드를
 * 호스트 응답까지 그대로 전달한다.
 *
 * 상태 코드가 없는 예외(Prisma 오류 등)는 응답으로 바꾸지 않고 다시 던져,
 * 바깥의 toolkit 오류 처리 미들웨어가 분류하게 한다.
 *
 * `instanceof BlogError` 검사는 blog-core 가 중복 설치되거나 번들링 과정에서
 * 클래스가 복제되면 패키지 경계를 넘는 순간 실패한다. 따라서 클래스 아이덴티티
 * 대신 구조적 판별(`code` + `statusCode`/`status` 속성 존재 여부)을 사용한다.
 */
import { NextResponse } from 'next/server';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import type { TApiHandler } from '@withwiz/toolkit/next/middleware/types';

/** blog-core `BlogError` 의 구조적 형태 */
export interface BlogErrorLike {
  /** BLOG_ERROR_CODES 의 값 */
  code: string;
  /** blog-core BlogError 가 사용하는 필드 */
  statusCode?: number;
  /** 다른 오류 계층이 사용하는 필드 */
  status?: number;
  message?: string;
}

/** BLOG_ERROR_CODES.INTERNAL_ERROR 와 동일한 값. 런타임 결합을 피하려고 문자열로 고정한다. */
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
/** 예기치 못한 예외에 사용하는 일반 메시지. 내부 정보를 노출하지 않는다. */
const INTERNAL_ERROR_MESSAGE = '서버 오류가 발생했습니다.';

function toHttpStatus(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= 400 && value <= 599 ? value : null;
}

/**
 * 예외에 담긴 HTTP 상태 코드를 읽는다.
 * blog-core 의 `statusCode` 를 우선하고, 없으면 `status` 를 사용한다.
 */
export function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const source = error as { statusCode?: unknown; status?: unknown };
  return toHttpStatus(source.statusCode) ?? toHttpStatus(source.status);
}

/** 예외에 담긴 오류 코드를 읽는다. */
export function getErrorCode(error: unknown): string | number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { code } = error as { code?: unknown };
  if (typeof code === 'number' && Number.isFinite(code)) return code;
  if (typeof code === 'string' && code.trim()) return code.trim();
  return null;
}

/**
 * blog-core `BlogError` 여부를 클래스가 아닌 구조로 판별한다.
 * 패키지 중복 설치·번들 복제로 클래스 아이덴티티가 갈려도 동작한다.
 */
export function isBlogErrorLike(error: unknown): error is BlogErrorLike {
  return (
    typeof getErrorCode(error) === 'string' && getErrorStatus(error) !== null
  );
}

function getErrorMessage(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { message } = error as { message?: unknown };
  return typeof message === 'string' && message.trim() ? message : null;
}

/**
 * 서비스 예외를 응답으로 변환한다.
 *
 * - 상태 코드를 가진 예외(BlogError 등) → 그 상태 코드와 오류 코드를 보존한다.
 * - 그 외 예기치 못한 예외 → 500 + 일반 메시지. 내부 정보를 노출하지 않는다.
 *   (withRouteErrorHandling 은 이런 예외를 여기로 보내지 않고 toolkit 에 넘긴다.
 *    이 분기는 toErrorResponse 를 직접 호출하는 쪽을 위한 안전장치다.)
 */
export function toErrorResponse(error: unknown): NextResponse {
  const status = getErrorStatus(error);

  if (status !== null) {
    const code = getErrorCode(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          ...(code !== null && { code }),
          message: getErrorMessage(error) ?? INTERNAL_ERROR_MESSAGE,
        },
      },
      { status },
    );
  }

  // 예기치 못한 예외는 서버 로그에만 남기고 응답에는 노출하지 않는다.
  console.error('[blog-system] 처리되지 않은 라우트 예외:', error);
  return NextResponse.json(
    {
      success: false,
      error: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE },
    },
    { status: 500 },
  );
}

/**
 * 라우트 핸들러에서 빠져나온 예외 중 상태 코드를 가진 것만 응답으로 변환하는 공통 래퍼
 *
 * 상태 코드가 없는 예외는 원본 그대로 다시 던진다. 이 래퍼를 감싸는 toolkit 의
 * errorHandlerMiddleware 가 Prisma 오류를 분류하고(P2002 → 409, P2025 → 404,
 * PrismaClientValidationError → 400), 분류되지 않는 예외는 내부 정보를 숨긴 500 으로
 * 응답한다. 여기서 500 으로 확정하면 그 분류가 적용되지 않는다.
 */
export function withRouteErrorHandling(handler: TApiHandler): TApiHandler {
  return async (context, props) => {
    try {
      return await handler(context, props);
    } catch (error) {
      if (getErrorStatus(error) === null) throw error;
      return toErrorResponse(error);
    }
  };
}

/** withPublicApi + 공통 오류 변환 */
export function withPublicRoute(
  handler: TApiHandler,
): ReturnType<typeof withPublicApi> {
  return withPublicApi(withRouteErrorHandling(handler));
}

/** withAdminApi + 공통 오류 변환 */
export function withAdminRoute(
  handler: TApiHandler,
): ReturnType<typeof withAdminApi> {
  return withAdminApi(withRouteErrorHandling(handler));
}
