import { NextResponse } from 'next/server';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { AuthService } from '../auth/auth-service';

export interface AuthRoutes {
  register: { POST: ReturnType<typeof withPublicApi> };
  login: { POST: ReturnType<typeof withPublicApi> };
  refresh: { POST: ReturnType<typeof withPublicApi> };
  logout: { POST: ReturnType<typeof withAdminApi> };
  me: { GET: ReturnType<typeof withAdminApi> };
  changePassword: { POST: ReturnType<typeof withAdminApi> };
  oauth: {
    login: { GET: ReturnType<typeof withPublicApi> };
    callback: { GET: ReturnType<typeof withPublicApi> };
  };
}

export function createAuthRoutes(authService: AuthService): AuthRoutes {
  return {
    register: {
      POST: withPublicApi(async (context: IApiContext) => {
        const { email, password, name } = await context.request.json();

        if (!email || !password) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '이메일과 비밀번호는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        try {
          const result = await authService.register(email, password, name);

          return NextResponse.json(
            {
              success: true,
              data: {
                user: result.user,
                tokens: result.tokens,
              },
            },
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
                    : '회원가입에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    login: {
      POST: withPublicApi(async (context: IApiContext) => {
        const { email, password } = await context.request.json();

        if (!email || !password) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '이메일과 비밀번호는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        try {
          const result = await authService.login(email, password);

          return NextResponse.json({
            success: true,
            data: {
              user: result.user,
              tokens: result.tokens,
            },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '로그인에 실패했습니다.',
              },
            },
            { status: 401 },
          );
        }
      }),
    },

    refresh: {
      POST: withPublicApi(async (context: IApiContext) => {
        const body = await context.request.json().catch(() => ({}));
        const refreshToken = body.refreshToken;

        if (!refreshToken) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: '리프레시 토큰이 필요합니다.',
                code: 'BAD_REQUEST',
              },
            },
            { status: 400 },
          );
        }

        try {
          const tokens = await authService.refreshToken(refreshToken);

          return NextResponse.json({
            success: true,
            data: { tokens },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '토큰 갱신에 실패했습니다.',
                code: 'UNAUTHORIZED',
              },
            },
            { status: 401 },
          );
        }
      }),
    },

    logout: {
      POST: withAdminApi(async (_context: IApiContext) => {
        // 토큰 무효화는 호스트 프로젝트의 쿠키/세션 관리에 위임
        return NextResponse.json({
          success: true,
          data: { message: '로그아웃 되었습니다.' },
        });
      }),
    },

    me: {
      GET: withAdminApi(async (context: IApiContext) => {
        const user = context.user!;

        return NextResponse.json({
          success: true,
          data: {
            user: { id: user.id, email: user.email, role: user.role },
          },
        });
      }),
    },

    changePassword: {
      POST: withAdminApi(async (context: IApiContext) => {
        const user = context.user!;
        const { currentPassword, newPassword } = await context.request.json();

        if (!currentPassword || !newPassword) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: '현재 비밀번호와 새 비밀번호가 필요합니다.',
              },
            },
            { status: 400 },
          );
        }

        if (newPassword.length < 8) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: '새 비밀번호는 최소 8자 이상이어야 합니다.',
              },
            },
            { status: 400 },
          );
        }

        try {
          await authService.changePassword(
            user.id,
            currentPassword,
            newPassword,
          );

          return NextResponse.json({
            success: true,
            data: { message: '비밀번호가 변경되었습니다.' },
          });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '비밀번호 변경에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    oauth: {
      login: {
        GET: withPublicApi(async (context: IApiContext, props?: unknown) => {
          const provider = await getRouteParam(props, 'provider');

          if (provider !== 'google' && provider !== 'github') {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message: `지원하지 않는 OAuth 프로바이더: ${provider}`,
                },
              },
              { status: 400 },
            );
          }

          try {
            const loginUrl = authService.getOAuthLoginUrl(provider);
            return NextResponse.redirect(loginUrl);
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'OAuth 설정 오류',
                },
              },
              { status: 500 },
            );
          }
        }),
      },

      callback: {
        GET: withPublicApi(async (context: IApiContext, props?: unknown) => {
          const provider = await getRouteParam(props, 'provider');
          const { searchParams } = new URL(context.request.url);
          const code = searchParams.get('code');

          if (!code) {
            return NextResponse.json(
              {
                success: false,
                error: { message: 'OAuth 인증 코드가 없습니다.' },
              },
              { status: 400 },
            );
          }

          try {
            const result = await authService.handleOAuthCallback(
              provider,
              code,
            );

            return NextResponse.json({
              success: true,
              data: {
                user: result.user,
                tokens: result.tokens,
              },
            });
          } catch (error) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'OAuth 인증에 실패했습니다.',
                },
              },
              { status: 401 },
            );
          }
        }),
      },
    },
  };
}

async function getRouteParam(props: unknown, key: string): Promise<string> {
  const { [key]: value } = await (
    props as { params: Promise<Record<string, string>> }
  ).params;
  return value;
}
