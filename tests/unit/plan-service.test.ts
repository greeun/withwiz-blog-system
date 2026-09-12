/**
 * PlanService 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPlanService, type PlanService } from '../../src/billing/plan-service';

// ── Prisma 모킹 ──

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

// ── 테스트 ──

describe('PlanService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PlanService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = createPlanService(prisma);
  });

  // ── create ──

  describe('create', () => {
    it('PlanDefinition으로 Plan을 생성하고 반환한다', async () => {
      const input = {
        name: 'Pro',
        maxPosts: 100,
        maxStorage: 5000000,
        maxUsers: 10,
        priceMonthly: 2900,
      };

      const dbRecord = {
        id: 'plan-1',
        ...input,
        isActive: true,
        stripeProductId: null,
        stripePriceId: null,
      };

      prisma.plan.create.mockResolvedValue(dbRecord);

      const result = await service.create(input);

      expect(result.id).toBe('plan-1');
      expect(result.name).toBe('Pro');
      expect(result.maxPosts).toBe(100);
      expect(result.maxStorage).toBe(5000000);
      expect(result.maxUsers).toBe(10);
      expect(result.priceMonthly).toBe(2900);
      expect(result.isActive).toBe(true);
      expect(prisma.plan.create).toHaveBeenCalledWith({
        data: {
          name: 'Pro',
          maxPosts: 100,
          maxStorage: 5000000,
          maxUsers: 10,
          priceMonthly: 2900,
          isActive: true,
        },
      });
    });
  });

  // ── listActive ──

  describe('listActive', () => {
    it('활성 플랜만 가격 오름차순으로 반환한다', async () => {
      const plans = [
        { id: 'plan-1', name: 'Free', maxPosts: 10, maxStorage: 100000, maxUsers: 1, priceMonthly: 0, isActive: true, stripeProductId: null, stripePriceId: null },
        { id: 'plan-2', name: 'Pro', maxPosts: 100, maxStorage: 5000000, maxUsers: 10, priceMonthly: 2900, isActive: true, stripeProductId: null, stripePriceId: null },
      ];

      prisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.listActive();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Free');
      expect(result[1].name).toBe('Pro');
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });
    });
  });

  // ── getDefault ──

  describe('getDefault', () => {
    it('가장 저렴한 활성 플랜을 반환한다', async () => {
      const cheapestPlan = {
        id: 'plan-free',
        name: 'Free',
        maxPosts: 5,
        maxStorage: 50000,
        maxUsers: 1,
        priceMonthly: 0,
        isActive: true,
        stripeProductId: null,
        stripePriceId: null,
      };

      prisma.plan.findFirst.mockResolvedValue(cheapestPlan);

      const result = await service.getDefault();

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Free');
      expect(result!.priceMonthly).toBe(0);
      expect(prisma.plan.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { priceMonthly: 'asc' },
      });
    });

    it('활성 플랜이 없으면 null을 반환한다', async () => {
      prisma.plan.findFirst.mockResolvedValue(null);

      const result = await service.getDefault();

      expect(result).toBeNull();
    });
  });

  // ── deactivate ──

  describe('deactivate', () => {
    it('플랜의 isActive를 false로 변경한다', async () => {
      prisma.plan.update.mockResolvedValue({});

      await service.deactivate('plan-1');

      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { isActive: false },
      });
    });
  });
});
