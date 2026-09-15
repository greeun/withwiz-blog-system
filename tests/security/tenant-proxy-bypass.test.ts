/**
 * 테넌트 스코프 프록시 우회 경로 보안 테스트
 *
 * createTenantProxy 는 모든 모델 호출에 tenantId 격리를 적용해야 한다.
 * - 조건(where)을 받는 조회·변경 메서드에는 where.tenantId 를 강제한다.
 * - 생성 메서드(create·createMany·createManyAndReturn·upsert.create)에는 data.tenantId 를 강제한다.
 * - 변경 data 로 레코드를 다른 테넌트로 옮기는 호출은 거부한다.
 * - 격리를 보장할 수 없는 호출(원시 쿼리, $extends, 배열형 $transaction, 알 수 없는 모델 메서드)은 명시적으로 거부한다.
 */
import { describe, it, expect, vi } from 'vitest';
import { createTenantProxy } from '@withwiz/blog-system/core';
import { createBlogService } from '@withwiz/blog-core/services';

const TENANT_ID = 'tenant-001';

const DELEGATE_METHODS = [
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
  'create', 'createMany', 'createManyAndReturn', 'upsert',
  'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany',
] as const;

function createDelegate() {
  const delegate: Record<string, any> = {};
  for (const method of DELEGATE_METHODS) {
    delegate[method] = vi.fn().mockResolvedValue({ ok: true });
  }
  return delegate;
}

function createPrisma() {
  const post = createDelegate();
  const prisma: any = {
    post,
    $transaction: vi.fn(async (fn: any, _options?: unknown) => fn({ post, $queryRawUnsafe: vi.fn() })),
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $extends: vi.fn(),
    $disconnect: vi.fn(),
  };
  return prisma;
}

describe('createTenantProxy — 누락 메서드 격리', () => {
  it('BS-TX-01: 호출자가 넘긴 다른 tenantId 는 조회 where 와 생성 data 에서 스코프 값으로 덮어쓴다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    await proxy.post.findMany({ where: { tenantId: 'other' } });
    await proxy.post.create({ data: { title: 'x', tenantId: 'other' } });

    expect(prisma.post.findMany.mock.calls[0][0].where.tenantId).toBe(TENANT_ID);
    expect(prisma.post.create.mock.calls[0][0].data.tenantId).toBe(TENANT_ID);
  });

  it('BS-TX-02: createMany·createManyAndReturn 은 배열·단일 객체 data 의 모든 항목에 tenantId 를 주입한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    await proxy.post.createMany({ data: [{ title: 'a' }, { title: 'b', tenantId: 'other' }], skipDuplicates: true });
    await proxy.post.createManyAndReturn({ data: { title: 'c' } });

    expect(prisma.post.createMany).toHaveBeenCalledWith({
      data: [{ title: 'a', tenantId: TENANT_ID }, { title: 'b', tenantId: TENANT_ID }],
      skipDuplicates: true,
    });
    expect(prisma.post.createManyAndReturn).toHaveBeenCalledWith({ data: { title: 'c', tenantId: TENANT_ID } });
  });

  it('BS-TX-03: upsert 는 where 와 create 에 tenantId 를 주입하고 update 는 유지한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    await proxy.post.upsert({ where: { id: '1' }, create: { title: 'x' }, update: { title: 'y' } });

    expect(prisma.post.upsert).toHaveBeenCalledWith({
      where: { id: '1', tenantId: TENANT_ID },
      create: { title: 'x', tenantId: TENANT_ID },
      update: { title: 'y' },
    });
  });

  it('BS-TX-04: aggregate·findUniqueOrThrow·findFirstOrThrow·updateManyAndReturn 에 where.tenantId 를 주입한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    await proxy.post.aggregate({ where: { published: true }, _count: true });
    await proxy.post.findUniqueOrThrow({ where: { id: '1' } });
    await proxy.post.findFirstOrThrow(undefined);
    await proxy.post.updateManyAndReturn({ where: { published: false }, data: { published: true } });

    expect(prisma.post.aggregate).toHaveBeenCalledWith({ where: { published: true, tenantId: TENANT_ID }, _count: true });
    expect(prisma.post.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: '1', tenantId: TENANT_ID } });
    expect(prisma.post.findFirstOrThrow).toHaveBeenCalledWith({ where: { tenantId: TENANT_ID } });
    expect(prisma.post.updateManyAndReturn).toHaveBeenCalledWith({
      where: { published: false, tenantId: TENANT_ID },
      data: { published: true },
    });
  });
});

describe('createTenantProxy — 테넌트 이동 거부', () => {
  it('BS-TX-05: update·updateMany·upsert.update 의 data 가 다른 tenantId 를 지정하면 거부한다', () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    expect(() => proxy.post.update({ where: { id: '1' }, data: { tenantId: 'other' } })).toThrow('테넌트');
    expect(() => proxy.post.updateMany({ where: {}, data: { tenantId: 'other' } })).toThrow('테넌트');
    expect(() =>
      proxy.post.upsert({ where: { id: '1' }, create: {}, update: { tenantId: 'other' } }),
    ).toThrow('테넌트');
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
    expect(prisma.post.upsert).not.toHaveBeenCalled();
  });

  it('BS-TX-06: 관계(tenant) 쓰기로 테넌트를 바꾸는 update 는 거부하고, 같은 tenantId 지정은 허용한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    expect(() =>
      proxy.post.update({ where: { id: '1' }, data: { tenant: { connect: { id: 'other' } } } }),
    ).toThrow('테넌트');
    expect(prisma.post.update).not.toHaveBeenCalled();

    await proxy.post.update({ where: { id: '1' }, data: { title: 'x', tenantId: TENANT_ID } });
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: '1', tenantId: TENANT_ID },
      data: { title: 'x', tenantId: TENANT_ID },
    });
  });
});

describe('createTenantProxy — 격리를 보장할 수 없는 호출 거부', () => {
  it('BS-TX-07: 목록에 없는 모델 메서드(클라이언트 확장 등)는 호출 시 거부한다', () => {
    const prisma = createPrisma();
    prisma.post.findManyUnscoped = vi.fn();
    const proxy = createTenantProxy(prisma, TENANT_ID);

    expect(() => proxy.post.findManyUnscoped({ where: {} })).toThrow('격리');
    expect(prisma.post.findManyUnscoped).not.toHaveBeenCalled();
  });

  it('BS-TX-08: 원시 쿼리와 $extends 는 거부하고 원본을 호출하지 않는다', () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID) as any;

    for (const method of ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe', '$extends']) {
      expect(() => proxy[method]('SELECT * FROM posts')).toThrow('격리');
      expect(prisma[method]).not.toHaveBeenCalled();
    }
    // 연결 관리 함수는 그대로 통과한다.
    expect(proxy.$disconnect).toBe(prisma.$disconnect);
  });

  it('BS-TX-09: 배열형 $transaction 은 명시적 오류로 거부한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID) as any;

    expect(() => proxy.$transaction([Promise.resolve(1)])).toThrow('콜백');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('BS-TX-10: 콜백형 $transaction 은 옵션을 전달하고, tx 안의 원시 쿼리도 거부한다', async () => {
    const prisma = createPrisma();
    const proxy = createTenantProxy(prisma, TENANT_ID) as any;
    const options = { isolationLevel: 'Serializable' };

    await proxy.$transaction(async (tx: any) => {
      await tx.post.createMany({ data: [{ title: 'in-tx' }] });
      expect(() => tx.$queryRawUnsafe('SELECT 1')).toThrow('격리');
    }, options);

    expect(prisma.$transaction.mock.calls[0][1]).toBe(options);
    expect(prisma.post.createMany).toHaveBeenCalledWith({ data: [{ title: 'in-tx', tenantId: TENANT_ID }] });
  });
});

describe('blog-core 태그 동기화와 테넌트 스코프', () => {
  it('BS-TX-11: 스코프 서비스의 태그 동기화 postTag.createMany·deleteMany 에 같은 tenantId 가 적용된다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const news = createDelegate();
    news.create.mockImplementation(async (args: any) => ({ id: 'post-1', ...args.data }));
    news.update.mockImplementation(async (args: any) => ({ id: args.where.id, ...args.data }));
    news.findUnique.mockResolvedValue({ published: false });
    news.findMany.mockResolvedValue([]);
    news.findFirst.mockResolvedValue(null);
    const postTag = createDelegate();
    const prisma: any = { news, postTag };
    prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));

    const service = createBlogService(createTenantProxy(prisma, TENANT_ID), {
      modelName: 'news',
      enableTags: true,
      sanitizeContent: (html) => html ?? '',
    });

    await service.create(
      { title: '제목', slug: 'slug', category: 'notice', content: '<p>x</p>', published: false, tagIds: ['tag-1'] } as any,
      'author-1',
    );
    await service.update('post-1', { tagIds: ['tag-2'] } as any);
    warn.mockRestore();

    expect(news.create.mock.calls[0][0].data.tenantId).toBe(TENANT_ID);
    expect(postTag.createMany.mock.calls[0][0].data).toEqual([{ postId: 'post-1', tagId: 'tag-1', tenantId: TENANT_ID }]);
    expect(postTag.deleteMany.mock.calls[0][0].where).toEqual({ postId: 'post-1', tenantId: TENANT_ID });
    expect(postTag.createMany.mock.calls[1][0].data).toEqual([{ postId: 'post-1', tagId: 'tag-2', tenantId: TENANT_ID }]);
  });
});
