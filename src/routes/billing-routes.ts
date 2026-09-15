import { NextResponse } from 'next/server';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { BillingService } from '../billing/billing-service';
import type { PlanService } from '../billing/plan-service';
import type { RouteHandlers } from '../types/system';
import type { TenantUserService } from '../tenant/tenant-user-service';
import {
  requireAuthenticatedUser,
  requireSuperAdmin,
  requireTenantRole,
} from './route-authorization';

export interface BillingRoutes extends RouteHandlers {
  [key: string]: (req: Request, ctx?: any) => Promise<Response>;
}

/**
 * 과금 라우트.
 *
 * - `plans.GET`, `webhook.POST`: 공개 경로 (웹훅은 Stripe 서명으로 검증)
 * - `checkout`, `portal`, `subscription`, `usage`: 요청의 `tenantId` 테넌트에 ADMIN 이상 역할로
 *   소속된 사용자만 호출할 수 있다. `tenantUserService` 를 전달하지 않으면 403 으로 거부한다.
 * - `adminPlans`: 요금제 관리는 플랫폼 수준 작업이므로 SUPER_ADMIN 만 호출할 수 있다.
 */
export function createBillingRoutes(
  billingService: BillingService,
  planService: PlanService,
  tenantUserService?: TenantUserService,
) {
  return {
    plans: {
      GET: withPublicApi(async (_context: IApiContext) => {
        const plans = await planService.listActive();
        return NextResponse.json({ success: true, data: plans });
      }),
    },

    checkout: {
      POST: withAdminApi(async (context: IApiContext) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const { tenantId, planId, successUrl, cancelUrl } =
          await context.request.json();

        if (!tenantId || !planId || !successUrl || !cancelUrl) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '필수 파라미터가 누락되었습니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, tenantId);
        if (!access.ok) return access.response;

        try {
          const url = await billingService.createCheckoutSession(
            tenantId,
            planId,
            successUrl,
            cancelUrl,
          );
          return NextResponse.json({ success: true, data: { url } });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '체크아웃 세션 생성에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    portal: {
      POST: withAdminApi(async (context: IApiContext) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const { tenantId, returnUrl } = await context.request.json();

        if (!tenantId || !returnUrl) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '필수 파라미터가 누락되었습니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, tenantId);
        if (!access.ok) return access.response;

        try {
          const url = await billingService.createPortalSession(
            tenantId,
            returnUrl,
          );
          return NextResponse.json({ success: true, data: { url } });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '포털 세션 생성에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    subscription: {
      GET: withAdminApi(async (context: IApiContext) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const url = new URL(context.request.url);
        const tenantId = url.searchParams.get('tenantId');

        if (!tenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, tenantId);
        if (!access.ok) return access.response;

        const subscription = await billingService.getSubscription(tenantId);
        return NextResponse.json({ success: true, data: subscription });
      }),
    },

    usage: {
      GET: withAdminApi(async (context: IApiContext) => {
        const unauthenticated = requireAuthenticatedUser(context);
        if (unauthenticated) return unauthenticated;

        const url = new URL(context.request.url);
        const tenantId = url.searchParams.get('tenantId');

        if (!tenantId) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'tenantId는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        const access = await requireTenantRole(context, tenantUserService, tenantId);
        if (!access.ok) return access.response;

        const periodParam = url.searchParams.get('period');
        const period = periodParam ? new Date(periodParam) : undefined;

        const usage = await billingService.getUsage(tenantId, period);
        return NextResponse.json({ success: true, data: usage });
      }),
    },

    webhook: {
      POST: withPublicApi(async (context: IApiContext) => {
        const payload = await context.request.text();
        const signature = context.request.headers.get('stripe-signature');

        if (!signature) {
          return NextResponse.json(
            {
              success: false,
              error: { message: 'Stripe 서명이 없습니다.' },
            },
            { status: 400 },
          );
        }

        try {
          await billingService.handleWebhook(payload, signature);
          return NextResponse.json({ success: true, data: { received: true } });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '웹훅 처리에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },

    adminPlans: {
      GET: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const plans = await planService.listActive();
        return NextResponse.json({ success: true, data: plans });
      }),

      POST: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const data = await context.request.json();

        if (!data.name || data.maxPosts == null || data.maxStorage == null) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '플랜 정보가 불완전합니다.' },
            },
            { status: 400 },
          );
        }

        try {
          const plan = await planService.create(data);
          return NextResponse.json(
            { success: true, data: plan },
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
                    : '플랜 생성에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),

      PUT: withAdminApi(async (context: IApiContext) => {
        const denied = requireSuperAdmin(context);
        if (denied) return denied;

        const { id, ...data } = await context.request.json();

        if (!id) {
          return NextResponse.json(
            {
              success: false,
              error: { message: '플랜 ID는 필수입니다.' },
            },
            { status: 400 },
          );
        }

        try {
          const plan = await planService.update(id, data);
          return NextResponse.json({ success: true, data: plan });
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message:
                  error instanceof Error
                    ? error.message
                    : '플랜 수정에 실패했습니다.',
              },
            },
            { status: 400 },
          );
        }
      }),
    },
  };
}
