/**
 * Task 6: tenant-resolver (createTenantResolver) 테스트 (9건)
 *
 * extractSubdomain은 비공개 함수이므로 resolveFromSubdomain을 통해 간접 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTenantResolver } from '@withwiz/blog-system/tenant';

function createMockPrisma() {
  return {
    tenant: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

const mockTenant = {
  id: 't-1',
  name: '테스트',
  slug: 'my-blog',
  customDomain: 'custom.com',
  isActive: true,
};

describe('createTenantResolver', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let resolver: ReturnType<typeof createTenantResolver>;

  beforeEach(() => {
    prisma = createMockPrisma();
    resolver = createTenantResolver(prisma);
  });

  // ── extractSubdomain 간접 테스트 ──
  it('BS-TR-01: extractSubdomain — my-blog.blog.example.com + blog.example.com → my-blog', async () => {
    prisma.tenant.findFirst.mockResolvedValue(mockTenant);
    await resolver.resolveFromSubdomain('my-blog.blog.example.com', 'blog.example.com');
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'my-blog', isActive: true },
    });
  });

  it('BS-TR-02: extractSubdomain — 동일 도메인 → null', async () => {
    const result = await resolver.resolveFromSubdomain('blog.example.com', 'blog.example.com');
    expect(result).toBeNull();
    expect(prisma.tenant.findFirst).not.toHaveBeenCalled();
  });

  it('BS-TR-03: extractSubdomain — 접미사 불일치 → null', async () => {
    const result = await resolver.resolveFromSubdomain('custom.com', 'blog.example.com');
    expect(result).toBeNull();
  });

  it('BS-TR-04: extractSubdomain — 포트 포함 호스트 → 포트 제거 후 추출', async () => {
    prisma.tenant.findFirst.mockResolvedValue(mockTenant);
    await resolver.resolveFromSubdomain('my-blog.blog.example.com:3000', 'blog.example.com:3000');
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { slug: 'my-blog', isActive: true },
    });
  });

  it('BS-TR-05: extractSubdomain — 중첩 서브도메인 (a.b.base) → null', async () => {
    const result = await resolver.resolveFromSubdomain('a.b.blog.example.com', 'blog.example.com');
    expect(result).toBeNull();
  });

  // ── resolveFromSubdomain ──
  it('BS-TR-06: resolveFromSubdomain — mock prisma → 테넌트 반환', async () => {
    prisma.tenant.findFirst.mockResolvedValue(mockTenant);
    const result = await resolver.resolveFromSubdomain('my-blog.blog.example.com', 'blog.example.com');
    expect(result).toEqual(mockTenant);
  });

  // ── resolveFromCustomDomain ──
  it('BS-TR-07: resolveFromCustomDomain — mock prisma → 테넌트 반환', async () => {
    prisma.tenant.findFirst.mockResolvedValue(mockTenant);
    const result = await resolver.resolveFromCustomDomain('custom.com');
    expect(result).toEqual(mockTenant);
    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: { customDomain: 'custom.com', isActive: true },
    });
  });

  // ── resolve ──
  it('BS-TR-08: resolve — 커스텀 도메인 우선 → 서브도메인 폴백', async () => {
    prisma.tenant.findFirst.mockResolvedValueOnce(mockTenant); // resolveFromCustomDomain 호출
    const result = await resolver.resolve('custom.com', 'blog.example.com');
    expect(result).toEqual(mockTenant);
    // findFirst는 1번만 호출됨 (커스텀 도메인 매칭 성공으로 서브도메인 skip)
    expect(prisma.tenant.findFirst).toHaveBeenCalledTimes(1);
  });

  it('BS-TR-09: resolve — 둘 다 없으면 null', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);
    const result = await resolver.resolve('unknown.com', 'blog.example.com');
    expect(result).toBeNull();
  });
});
