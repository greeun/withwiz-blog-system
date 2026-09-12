/**
 * Task 11: plan-service (createPlanService) 테스트 (9건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlanService } from '@withwiz/blog-system/billing';

function createMockPrisma() {
  return {
    plan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
}

const basePlan = {
  id: 'plan-1',
  name: 'Free',
  maxPosts: 10,
  maxStorage: 1073741824,
  maxUsers: 3,
  priceMonthly: 0,
  stripeProductId: null,
  stripePriceId: null,
  isActive: true,
};

describe('createPlanService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReturnType<typeof createPlanService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = createPlanService(prisma as any);
  });

  it('BS-PS-01: create — Plan 생성', async () => {
    prisma.plan.create.mockResolvedValue(basePlan);
    const result = await service.create({
      name: 'Free',
      maxPosts: 10,
      maxStorage: 1073741824,
      maxUsers: 3,
      priceMonthly: 0,
    });
    expect(result.name).toBe('Free');
    expect(prisma.plan.create).toHaveBeenCalled();
  });

  it('BS-PS-02: getById — 존재하는 id → Plan 반환', async () => {
    prisma.plan.findUnique.mockResolvedValue(basePlan);
    const result = await service.getById('plan-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('plan-1');
  });

  it('BS-PS-03: getById — 없는 id → null', async () => {
    prisma.plan.findUnique.mockResolvedValue(null);
    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('BS-PS-04: listActive — isActive=true만 조회, priceMonthly 오름차순', async () => {
    prisma.plan.findMany.mockResolvedValue([basePlan]);
    await service.listActive();
    expect(prisma.plan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  });

  it('BS-PS-05: update — 필드 변경', async () => {
    prisma.plan.update.mockResolvedValue({ ...basePlan, name: 'Pro' });
    const result = await service.update('plan-1', { name: 'Pro' });
    expect(result.name).toBe('Pro');
  });

  it('BS-PS-06: deactivate — isActive=false', async () => {
    prisma.plan.update.mockResolvedValue({ ...basePlan, isActive: false });
    await service.deactivate('plan-1');
    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { isActive: false },
    });
  });

  it('BS-PS-07: getDefault — 가장 저렴한 활성 플랜', async () => {
    prisma.plan.findFirst.mockResolvedValue(basePlan);
    const result = await service.getDefault();
    expect(result).not.toBeNull();
    expect(prisma.plan.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  });

  it('BS-PS-08: mapToPlan — stripeProductId null → undefined 변환', async () => {
    prisma.plan.findUnique.mockResolvedValue({ ...basePlan, stripeProductId: null });
    const result = await service.getById('plan-1');
    expect(result!.stripeProductId).toBeUndefined();
  });

  it('BS-PS-09: mapToPlan — stripePriceId null → undefined 변환', async () => {
    prisma.plan.findUnique.mockResolvedValue({ ...basePlan, stripePriceId: null });
    const result = await service.getById('plan-1');
    expect(result!.stripePriceId).toBeUndefined();
  });
});
