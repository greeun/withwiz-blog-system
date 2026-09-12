import { NextResponse } from 'next/server';
import {
  withPublicApi,
  withAdminApi,
} from '@withwiz/toolkit/next/middleware/wrappers';
import type { IApiContext } from '@withwiz/toolkit/next/middleware/types';
import type { BillingService } from '../billing/billing-service';
import type { PlanService } from '../billing/plan-service';
import type { RouteHandlers } from '../types/system';

export interface BillingRoutes extends RouteHandlers {
  [key: string]: (req: Request, ctx?: any) => Promise<Response>;
}

export function createBillingRoutes(
  billingService: BillingService,
  planService: PlanService,
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

        const subscription = await billingService.getSubscription(tenantId);
        return NextResponse.json({ success: true, data: subscription });
      }),
    },

    usage: {
      GET: withAdminApi(async (context: IApiContext) => {
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
      GET: withAdminApi(async (_context: IApiContext) => {
        const plans = await planService.listActive();
        return NextResponse.json({ success: true, data: plans });
      }),

      POST: withAdminApi(async (context: IApiContext) => {
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
