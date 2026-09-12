import type { Plan, PlanDefinition } from '../types/billing';

export interface PlanService {
  create(data: PlanDefinition): Promise<Plan>;
  getById(id: string): Promise<Plan | null>;
  listActive(): Promise<Plan[]>;
  update(id: string, data: Partial<PlanDefinition>): Promise<Plan>;
  deactivate(id: string): Promise<void>;
  getDefault(): Promise<Plan | null>;
}

export function createPlanService(prisma: any): PlanService {
  return {
    async create(data: PlanDefinition): Promise<Plan> {
      const plan = await prisma.plan.create({
        data: {
          name: data.name,
          maxPosts: data.maxPosts,
          maxStorage: data.maxStorage,
          maxUsers: data.maxUsers,
          priceMonthly: data.priceMonthly,
          isActive: true,
        },
      });

      return mapToPlan(plan);
    },

    async getById(id: string): Promise<Plan | null> {
      const plan = await prisma.plan.findUnique({ where: { id } });
      return plan ? mapToPlan(plan) : null;
    },

    async listActive(): Promise<Plan[]> {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });

      return plans.map(mapToPlan);
    },

    async update(id: string, data: Partial<PlanDefinition>): Promise<Plan> {
      const plan = await prisma.plan.update({
        where: { id },
        data,
      });

      return mapToPlan(plan);
    },

    async deactivate(id: string): Promise<void> {
      // 삭제 대신 소프트 비활성
      await prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });
    },

    async getDefault(): Promise<Plan | null> {
      // 활성 플랜 중 가장 저렴한 플랜을 기본 플랜으로 사용
      const plan = await prisma.plan.findFirst({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });

      return plan ? mapToPlan(plan) : null;
    },
  };
}

function mapToPlan(record: any): Plan {
  return {
    id: record.id,
    name: record.name,
    maxPosts: record.maxPosts,
    maxStorage: record.maxStorage,
    maxUsers: record.maxUsers,
    priceMonthly: record.priceMonthly,
    stripeProductId: record.stripeProductId ?? undefined,
    stripePriceId: record.stripePriceId ?? undefined,
    isActive: record.isActive,
  };
}
