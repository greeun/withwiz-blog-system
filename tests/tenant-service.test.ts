/**
 * Task 4: tenant-service (createTenantService) 테스트 (16건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTenantService } from '@withwiz/blog-system/tenant';

function createMockPrisma() {
  return {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

const baseTenant = {
  id: 't-1',
  name: '테스트',
  slug: 'test',
  customDomain: null,
  logo: null,
  settings: {},
  planId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('createTenantService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ReturnType<typeof createTenantService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = createTenantService(prisma);
  });

  // ── create ──
  it('BS-TS-01: create — 유효 입력 → 테넌트 생성', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockResolvedValue(baseTenant);

    const result = await service.create({ name: '테스트', slug: 'test' });
    expect(result).toEqual(baseTenant);
    expect(prisma.tenant.create).toHaveBeenCalled();
  });

  it('BS-TS-02: create — 슬러그 중복 → Error throw', async () => {
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    await expect(service.create({ name: '테스트', slug: 'test' })).rejects.toThrow('이미 사용 중인 슬러그');
  });

  it('BS-TS-03: create — DEFAULT_TENANT_SETTINGS 머지 확인', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockImplementation(async ({ data }: any) => ({
      ...baseTenant,
      settings: data.settings,
    }));

    await service.create({ name: '테스트', slug: 'test' });
    const callArgs = prisma.tenant.create.mock.calls[0][0];
    expect(callArgs.data.settings).toEqual(
      expect.objectContaining({
        blogConfig: {},
        theme: {},
        seo: {},
      }),
    );
  });

  // ── getById ──
  it('BS-TS-04: getById — 존재하는 id → 테넌트 반환', async () => {
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    const result = await service.getById('t-1');
    expect(result).toEqual(baseTenant);
  });

  it('BS-TS-05: getById — 없는 id → null', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    const result = await service.getById('nonexistent');
    expect(result).toBeNull();
  });

  // ── getBySlug ──
  it('BS-TS-06: getBySlug — 정상 조회', async () => {
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    const result = await service.getBySlug('test');
    expect(result).toEqual(baseTenant);
  });

  // ── getByCustomDomain ──
  it('BS-TS-07: getByCustomDomain — 정상 조회', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ ...baseTenant, customDomain: 'blog.test.com' });
    const result = await service.getByCustomDomain('blog.test.com');
    expect(result?.customDomain).toBe('blog.test.com');
  });

  // ── update ──
  it('BS-TS-08: update — 슬러그 변경 시 중복 체크 (자기 자신 제외)', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({ ...baseTenant, slug: 'new-slug' });

    await service.update('t-1', { slug: 'new-slug' });
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'new-slug', NOT: { id: 't-1' } },
    });
  });

  it('BS-TS-09: update — 슬러그 중복 → Error throw', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ id: 't-2', slug: 'taken' });
    await expect(service.update('t-1', { slug: 'taken' })).rejects.toThrow('이미 사용 중인 슬러그');
  });

  // ── deactivate ──
  it('BS-TS-10: deactivate — isActive=false로 변경', async () => {
    prisma.tenant.update.mockResolvedValue({ ...baseTenant, isActive: false });
    await service.deactivate('t-1');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { isActive: false },
    });
  });

  // ── listAll ──
  it('BS-TS-11: listAll — 검색어 없을 때 빈 where', async () => {
    prisma.tenant.count.mockResolvedValue(0);
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.listAll({ page: 1, limit: 10 });
    expect(prisma.tenant.count).toHaveBeenCalledWith({ where: {} });
  });

  it('BS-TS-12: listAll — 검색어 있을 때 OR 조건 (name + slug)', async () => {
    prisma.tenant.count.mockResolvedValue(0);
    prisma.tenant.findMany.mockResolvedValue([]);

    await service.listAll({ page: 1, limit: 10, search: 'abc' });
    const callArgs = prisma.tenant.count.mock.calls[0][0];
    expect(callArgs.where.OR).toHaveLength(2);
    expect(callArgs.where.OR[0]).toHaveProperty('name');
    expect(callArgs.where.OR[1]).toHaveProperty('slug');
  });

  it('BS-TS-13: listAll — 페이지네이션 계산 (skip, totalPages, total)', async () => {
    prisma.tenant.count.mockResolvedValue(25);
    prisma.tenant.findMany.mockResolvedValue(Array(10).fill(baseTenant));

    const result = await service.listAll({ page: 2, limit: 10 });
    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(25);
  });

  // ── getSettings ──
  it('BS-TS-14: getSettings — 존재하지 않는 테넌트 → Error', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(service.getSettings('nonexistent')).rejects.toThrow('테넌트를 찾을 수 없습니다');
  });

  // ── updateSettings ──
  it('BS-TS-15: updateSettings — deep merge 동작 (기존 값 보존 + 새 값 오버라이드)', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: {
        blogConfig: { existing: true },
        theme: { primaryColor: '#000' },
        seo: { siteName: 'Old' },
      },
    });
    prisma.tenant.update.mockResolvedValue({});

    const result = await service.updateSettings('t-1', {
      theme: { logo: 'https://example.com/logo.png' },
      seo: { siteName: 'New' },
    });

    expect(result.blogConfig).toEqual({ existing: true });
    expect(result.theme).toEqual({ primaryColor: '#000', logo: 'https://example.com/logo.png' });
    expect(result.seo).toEqual({ siteName: 'New' });
  });

  it('BS-TS-16: updateSettings — domainVerification 보존', async () => {
    const domainVerification = {
      token: 'abc',
      status: 'verified' as const,
      sslStatus: 'active' as const,
      createdAt: '2025-01-01',
    };
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { blogConfig: {}, domainVerification },
    });
    prisma.tenant.update.mockResolvedValue({});

    const result = await service.updateSettings('t-1', {
      theme: { primaryColor: '#fff' },
    });

    expect(result.domainVerification).toEqual(domainVerification);
  });
});
