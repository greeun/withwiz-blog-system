/**
 * Task 14: domain-service 헬퍼 함수 테스트 (10건)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// dns/promises와 crypto를 mock
vi.mock('dns/promises', () => ({
  resolveTxt: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('mock-uuid-token'),
}));

import { createDomainService } from '@withwiz/blog-system/tenant';
import { resolveTxt } from 'dns/promises';

function createMockPrisma() {
  return {
    tenant: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
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
  customDomain: 'blog.custom.com',
  settings: {
    domainVerification: {
      token: 'mock-uuid-token',
      status: 'pending',
      sslStatus: 'pending',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  },
  isActive: true,
};

describe('createDomainService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.clearAllMocks();
  });

  // ── getDomainVerificationData 간접 테스트 ──
  it('BS-DS-01: getDomainVerificationData — token 없음 → checkVerification에서 에러', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      settings: {}, // token 없음
    });

    await expect(service.checkVerification('t-1', 'blog.custom.com'))
      .rejects.toThrow('도메인 인증 데이터가 없습니다');
  });

  it('BS-DS-02: getDomainVerificationData — 유효 settings → 데이터 반환 (checkVerification 성공)', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    (resolveTxt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NXDOMAIN'));

    const result = await service.checkVerification('t-1', 'blog.custom.com');
    expect(result.domain).toBe('blog.custom.com');
    expect(result.status).toBe('pending');
  });

  // ── buildVerificationResponse 간접 테스트 ──
  it('BS-DS-03: buildVerificationResponse — TXT 레코드 name/value 형식', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    (resolveTxt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NXDOMAIN'));

    const result = await service.checkVerification('t-1', 'blog.custom.com');
    expect(result.verificationRecord.type).toBe('TXT');
    expect(result.verificationRecord.name).toBe('_withwiz-verify.blog.custom.com');
    expect(result.verificationRecord.value).toBe('withwiz-verify=mock-uuid-token');
  });

  // ── addCustomDomain ──
  it('BS-DS-04: addCustomDomain — 존재하지 않는 테넌트 → Error', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.addCustomDomain('nonexistent', 'blog.custom.com'))
      .rejects.toThrow('테넌트를 찾을 수 없습니다');
  });

  it('BS-DS-05: addCustomDomain — 도메인 중복 → Error', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    prisma.tenant.findFirst.mockResolvedValue({ id: 't-2' }); // 다른 테넌트가 사용 중

    await expect(service.addCustomDomain('t-1', 'blog.custom.com'))
      .rejects.toThrow('이미 다른 테넌트에서 사용 중인 도메인');
  });

  // ── checkVerification ──
  it('BS-DS-06: checkVerification — 이미 인증 → 단락 처리', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      settings: {
        domainVerification: {
          token: 'mock-uuid-token',
          status: 'verified',
          sslStatus: 'active',
          createdAt: '2025-01-01T00:00:00.000Z',
          verifiedAt: '2025-01-02T00:00:00.000Z',
        },
      },
    });

    const result = await service.checkVerification('t-1', 'blog.custom.com');
    expect(result.status).toBe('verified');
    // resolveTxt should NOT have been called
    expect(resolveTxt).not.toHaveBeenCalled();
  });

  it('BS-DS-07: checkVerification — DNS TXT 일치 → verified 상태', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    prisma.tenant.update.mockResolvedValue({});
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([
      ['withwiz-verify=mock-uuid-token'],
    ]);

    const result = await service.checkVerification('t-1', 'blog.custom.com');
    expect(result.status).toBe('verified');
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it('BS-DS-08: checkVerification — DNS TXT 불일치 → pending 유지', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([
      ['some-other-value'],
    ]);

    const result = await service.checkVerification('t-1', 'blog.custom.com');
    expect(result.status).toBe('pending');
  });

  // ── removeCustomDomain ──
  it('BS-DS-09: removeCustomDomain — 정상 제거', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(baseTenant);
    prisma.tenant.update.mockResolvedValue({});

    await service.removeCustomDomain('t-1');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        customDomain: null,
        settings: expect.not.objectContaining({ domainVerification: expect.anything() }),
      },
    });
  });

  // ── vercelEnabled ──
  it('BS-DS-10: vercelEnabled — 3개 설정 중 하나라도 없으면 비활성', async () => {
    // vercelTeamId만 설정, vercelProjectId/vercelApiToken 미설정
    const service = createDomainService(prisma, {
      baseDomain: 'blog.example.com',
      vercelTeamId: 'team-1',
      // vercelProjectId와 vercelApiToken 미설정
    });

    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      customDomain: null,
      settings: {},
    });
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({});

    // addCustomDomain 호출 시 Vercel API가 호출되지 않아야 함 (fetch가 호출되지 않음)
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    try {
      await service.addCustomDomain('t-1', 'new.custom.com');
      // Vercel API fetch가 호출되지 않아야 함
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
