/**
 * Task 7: tenant-middleware (resolveTenantFromRequest) 테스트 (5건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveTenantFromRequest,
  TENANT_ID_HEADER,
  TENANT_SLUG_HEADER,
} from '@withwiz/blog-system/tenant';

const mockTenant = {
  id: 't-1',
  name: '테스트',
  slug: 'my-blog',
  customDomain: null,
  isActive: true,
};

function createMockResolver() {
  return {
    resolveFromSubdomain: vi.fn().mockResolvedValue(null),
    resolveFromCustomDomain: vi.fn().mockResolvedValue(null),
    resolveFromSlug: vi.fn().mockResolvedValue(null),
    resolve: vi.fn().mockResolvedValue(null),
  };
}

describe('resolveTenantFromRequest', () => {
  let resolver: ReturnType<typeof createMockResolver>;

  beforeEach(() => {
    resolver = createMockResolver();
  });

  it('BS-TM-01: X-Tenant-Id 헤더가 있어도 슬러그 조회를 하지 않고 호스트명으로 해석', async () => {
    resolver.resolveFromSlug.mockResolvedValue(mockTenant);
    const req = new Request('http://localhost/api/test', {
      headers: { [TENANT_ID_HEADER]: 'my-blog' },
    });

    const result = await resolveTenantFromRequest(req, resolver, 'blog.example.com');
    expect(result).toBeNull();
    expect(resolver.resolveFromSlug).not.toHaveBeenCalled();
    expect(resolver.resolve).toHaveBeenCalledWith('localhost', 'blog.example.com');
  });

  it('BS-TM-02: X-Tenant-Id 헤더 없으면 → 호스트명 기반 resolve', async () => {
    resolver.resolve.mockResolvedValue(mockTenant);
    const req = new Request('http://my-blog.blog.example.com/api/test');

    const result = await resolveTenantFromRequest(req, resolver, 'blog.example.com');
    expect(result).toEqual({ tenantId: 't-1', tenant: mockTenant });
    expect(resolver.resolve).toHaveBeenCalled();
  });

  it('BS-TM-03: 둘 다 null → null 반환', async () => {
    const req = new Request('http://unknown.com/api/test');
    const result = await resolveTenantFromRequest(req, resolver, 'blog.example.com');
    expect(result).toBeNull();
  });

  it('BS-TM-04: TENANT_ID_HEADER 상수값 = X-Tenant-Id', () => {
    expect(TENANT_ID_HEADER).toBe('X-Tenant-Id');
  });

  it('BS-TM-05: TENANT_SLUG_HEADER 상수값 = X-Tenant-Slug', () => {
    expect(TENANT_SLUG_HEADER).toBe('X-Tenant-Slug');
  });
});
