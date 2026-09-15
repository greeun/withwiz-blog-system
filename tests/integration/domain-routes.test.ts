/**
 * 도메인 관리 라우트 핸들러 통합 테스트 (5건)
 *
 * createDomainRoutes()로 생성된 핸들러를 실제 Request 객체로 호출하여
 * Response 상태 코드와 JSON 응답을 검증한다.
 *
 * 인가 전제: 요청자 admin-1 은 테넌트 t-1 의 ADMIN 구성원이고, 전체 목록(BS-DR-05)은
 * 시스템 역할 SUPER_ADMIN 으로 호출한다. 거부 경로는
 * tests/security/admin-route-authorization.test.ts 에서 검증한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'ADMIN' }));

// ── 미들웨어 모킹 ──

vi.mock('@withwiz/toolkit/next/middleware/wrappers', () => ({
  withAdminApi: vi.fn((handler: any) => {
    return (req: Request, props?: unknown) => {
      const context = {
        request: req,
        user: { id: 'admin-1', role: auth.role, email: 'admin@test.com' },
        metadata: {},
      };
      return handler(context, props);
    };
  }),
}));

vi.mock('@withwiz/toolkit/next/utils/api-helpers', () => ({
  parsePagination: vi.fn((req: Request) => {
    const url = new URL(req.url);
    return {
      page: parseInt(url.searchParams.get('page') ?? '1', 10),
      limit: parseInt(url.searchParams.get('limit') ?? '10', 10),
    };
  }),
  getSearchParam: vi.fn().mockReturnValue(null),
}));

import { createDomainRoutes } from '@withwiz/blog-system/routes';

// ── Mock DomainService 팩토리 ──

function createMockDomainService() {
  return {
    addCustomDomain: vi.fn().mockResolvedValue({
      domain: 'blog.example.com',
      tenantId: 't-1',
      status: 'pending',
      verificationRecord: {
        type: 'CNAME',
        name: '_withwiz-verify.blog.example.com',
        value: 'verify-abc123.withwiz.com',
      },
      sslStatus: 'pending',
      createdAt: new Date(),
    }),
    verifyDomain: vi.fn().mockResolvedValue(true),
    checkVerification: vi.fn().mockResolvedValue({
      domain: 'blog.example.com',
      status: 'verified',
      sslStatus: 'active',
      verifiedAt: new Date(),
    }),
    removeCustomDomain: vi.fn().mockResolvedValue(undefined),
    listCustomDomains: vi.fn().mockResolvedValue({
      items: [
        {
          domain: 'blog.example.com',
          tenantId: 't-1',
          tenantName: '테스트 테넌트',
          status: 'verified',
          sslStatus: 'active',
          createdAt: new Date(),
        },
      ],
      page: 1, limit: 10, total: 1, totalPages: 1,
    }),
  } as any;
}

describe('도메인 관리 라우트 핸들러', () => {
  let domainService: ReturnType<typeof createMockDomainService>;
  let routes: ReturnType<typeof createDomainRoutes>;

  beforeEach(() => {
    auth.role = 'ADMIN';
    domainService = createMockDomainService();
    const tenantUserService = {
      getUserRole: vi.fn(async (tenantId: string, userId: string) =>
        tenantId === 't-1' && userId === 'admin-1' ? 'ADMIN' : null,
      ),
    } as any;
    routes = createDomainRoutes(domainService, tenantUserService);
  });

  // ── 도메인 추가 ──

  it('BS-DR-01: 도메인 추가 — POST 유효 → 201 + 인증 레코드 반환', async () => {
    const req = new Request('http://localhost/api/admin/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 't-1', domain: 'blog.example.com' }),
    });
    const res = await routes.add.POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.verificationRecord).toBeDefined();
    expect(body.data.verificationRecord.type).toBe('CNAME');
  });

  it('BS-DR-02: 도메인 추가 — 유효하지 않은 형식 → 400', async () => {
    const req = new Request('http://localhost/api/admin/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 't-1', domain: 'invalid domain!!!' }),
    });
    const res = await routes.add.POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.message).toContain('유효하지 않은');
  });

  // ── 도메인 인증 ──

  it('BS-DR-03: 도메인 인증 — POST → 인증 상태 반환', async () => {
    const req = new Request('http://localhost/api/admin/domains/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 't-1', domain: 'blog.example.com' }),
    });
    const res = await routes.verify.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.verified).toBe(true);
  });

  // ── 도메인 제거 ──

  it('BS-DR-04: 도메인 제거 — DELETE → 제거 완료', async () => {
    const req = new Request(
      'http://localhost/api/admin/domains?tenantId=t-1',
      { method: 'DELETE' },
    );
    const res = await routes.remove.DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('제거');
    expect(domainService.removeCustomDomain).toHaveBeenCalledWith('t-1');
  });

  // ── 도메인 목록 ──

  it('BS-DR-05: 도메인 목록 — GET → 전체 도메인 목록 반환', async () => {
    auth.role = 'SUPER_ADMIN';
    const req = new Request('http://localhost/api/admin/domains?page=1');
    const res = await routes.list.GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].domain).toBe('blog.example.com');
  });
});
