/**
 * Task 2: createTenantProxy 테스트 (14건)
 */
import { describe, it, expect, vi } from 'vitest';
import { createTenantProxy } from '@withwiz/blog-system/core';

const TENANT_ID = 'tenant-001';

function createMockDelegate() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue({ id: '1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  };
}

function createMockPrisma(delegates: Record<string, ReturnType<typeof createMockDelegate>> = {}) {
  const post = delegates.post ?? createMockDelegate();
  return {
    post,
    $transaction: vi.fn(async (fn: any) => fn({ post, $transaction: vi.fn() })),
    someUtility: 'not-a-delegate',
  } as any;
}

describe('createTenantProxy', () => {
  it('BS-TP-01: findMany 호출 시 where.tenantId 자동 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findMany({ where: { published: true } });
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { published: true, tenantId: TENANT_ID },
    });
  });

  it('BS-TP-02: findFirst 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findFirst({ where: { slug: 'hello' } });
    expect(prisma.post.findFirst).toHaveBeenCalledWith({
      where: { slug: 'hello', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-03: findUnique 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findUnique({ where: { id: 'abc' } });
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: 'abc', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-04: count 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.count({ where: { published: true } });
    expect(prisma.post.count).toHaveBeenCalledWith({
      where: { published: true, tenantId: TENANT_ID },
    });
  });

  it('BS-TP-05: create 호출 시 data.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.create({ data: { title: 'test' } });
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: { title: 'test', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-06: update 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.update({ where: { id: '1' }, data: { title: 'new' } });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: '1', tenantId: TENANT_ID },
      data: { title: 'new' },
    });
  });

  it('BS-TP-07: delete 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.delete({ where: { id: '1' } });
    expect(prisma.post.delete).toHaveBeenCalledWith({
      where: { id: '1', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-08: updateMany 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.updateMany({ where: { published: false }, data: { published: true } });
    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { published: false, tenantId: TENANT_ID },
      data: { published: true },
    });
  });

  it('BS-TP-09: deleteMany 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.deleteMany({ where: { published: false } });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({
      where: { published: false, tenantId: TENANT_ID },
    });
  });

  it('BS-TP-10: groupBy 호출 시 where.tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.groupBy({ where: {}, by: ['category'] });
    expect(prisma.post.groupBy).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID },
      by: ['category'],
    });
  });

  it('BS-TP-11: $transaction 콜백 내 tx 객체가 proxy로 래핑되어 tenantId 주입', async () => {
    const txDelegate = createMockDelegate();
    const txPrisma = { post: txDelegate, $transaction: vi.fn() } as any;
    const prisma = {
      post: createMockDelegate(),
      $transaction: vi.fn(async (fn: any) => fn(txPrisma)),
      someUtility: 'not-a-delegate',
    } as any;
    const proxy = createTenantProxy(prisma, TENANT_ID);

    await proxy.$transaction(async (tx: any) => {
      await tx.post.findMany({ where: { published: true } });
      await tx.post.create({ data: { title: 'in-tx' } });
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    // tx 내부에서도 tenantId가 주입되어야 함
    expect(txDelegate.findMany).toHaveBeenCalledWith({
      where: { published: true, tenantId: TENANT_ID },
    });
    expect(txDelegate.create).toHaveBeenCalledWith({
      data: { title: 'in-tx', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-12: findMany 없는 프로퍼티(비모델) → 원본 그대로 반환', () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    expect(proxy.someUtility).toBe('not-a-delegate');
  });

  it('BS-TP-13: 기존 where 조건과 tenantId 병합 확인', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findMany({ where: { published: true, category: 'tech' } });
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { published: true, category: 'tech', tenantId: TENANT_ID },
    });
  });

  it('BS-TP-14: where 없이 호출 시 → where: { tenantId } 자동 생성', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findMany({});
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID },
    });
  });

  it('BS-TP-15: args가 undefined일 때도 tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findMany(undefined);
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID },
    });
  });

  it('BS-TP-16: 중첩 where.AND 조건과 tenantId가 충돌하지 않음', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findMany({
      where: {
        AND: [{ published: true }, { category: 'tech' }],
      },
    });
    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: {
        AND: [{ published: true }, { category: 'tech' }],
        tenantId: TENANT_ID,
      },
    });
  });

  it('BS-TP-17: 중첩 where.OR 조건과 tenantId가 충돌하지 않음', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.findFirst({
      where: {
        OR: [{ title: 'A' }, { title: 'B' }],
      },
    });
    expect(prisma.post.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ title: 'A' }, { title: 'B' }],
        tenantId: TENANT_ID,
      },
    });
  });

  it('BS-TP-18: $disconnect 등 non-model 프로퍼티는 그대로 통과', () => {
    const disconnectFn = vi.fn();
    const prisma = {
      ...createMockPrisma(),
      $disconnect: disconnectFn,
    } as any;
    const proxy = createTenantProxy(prisma, TENANT_ID);
    expect(proxy.$disconnect).toBe(disconnectFn);
  });

  it('BS-TP-19: create 시 args가 undefined여도 data에 tenantId 주입', async () => {
    const prisma = createMockPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);
    await proxy.post.create(undefined);
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: { tenantId: TENANT_ID },
    });
  });
});
