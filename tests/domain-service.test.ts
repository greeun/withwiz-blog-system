/**
 * Task 14: domain-service 헬퍼 함수 테스트 (17건)
 *
 * 커스텀 도메인은 DNS TXT 인증에 성공한 뒤에만 tenant.customDomain 에 설정한다(BS-DS-11~17).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const VERCEL_CONFIG = {
  baseDomain: 'blog.example.com',
  vercelTeamId: 'team-1',
  vercelProjectId: 'project-1',
  vercelApiToken: 'token-1',
};

/** 인증 대기 중인 새 형식 데이터: customDomain 은 비어 있고 도메인은 settings 에만 있다 */
function pendingTenant() {
  return {
    ...baseTenant,
    customDomain: null,
    settings: {
      domainVerification: { ...baseTenant.settings.domainVerification, domain: 'blog.custom.com' },
    },
  };
}

const originalFetch = globalThis.fetch;

function stubFetch() {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
  globalThis.fetch = mockFetch as any;
  return mockFetch;
}

describe('createDomainService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
  it('BS-DS-10: vercelEnabled — 3개 설정 중 하나라도 없으면 인증 성공 뒤에도 Vercel API 를 호출하지 않는다', async () => {
    // vercelTeamId만 설정, vercelProjectId/vercelApiToken 미설정
    const service = createDomainService(prisma, {
      baseDomain: 'blog.example.com',
      vercelTeamId: 'team-1',
    });
    prisma.tenant.findUnique.mockResolvedValue(pendingTenant());
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({});
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([['withwiz-verify=mock-uuid-token']]);

    const mockFetch = stubFetch();
    const result = await service.checkVerification('t-1', 'blog.custom.com');

    expect(result.status).toBe('verified');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 인증 후 활성화 ──
  it('BS-DS-11: addCustomDomain — 도메인을 인증 대기로만 저장하고 customDomain 은 비워 두며 Vercel 에 등록하지 않는다', async () => {
    const service = createDomainService(prisma, VERCEL_CONFIG);
    prisma.tenant.findUnique.mockResolvedValue({ ...baseTenant, customDomain: null, settings: {} });
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({});
    const mockFetch = stubFetch();

    const result = await service.addCustomDomain('t-1', 'new.custom.com');

    expect(result.status).toBe('pending');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        customDomain: null,
        settings: {
          domainVerification: expect.objectContaining({ domain: 'new.custom.com', token: 'mock-uuid-token', status: 'pending' }),
        },
      },
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('BS-DS-12: checkVerification — DNS 인증에 성공하면 customDomain 을 설정하고 Vercel 에 등록한다', async () => {
    const service = createDomainService(prisma, VERCEL_CONFIG);
    prisma.tenant.findUnique.mockResolvedValue(pendingTenant());
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({});
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([['withwiz-verify=mock-uuid-token']]);
    const mockFetch = stubFetch();

    const result = await service.checkVerification('t-1', 'blog.custom.com');

    expect(result.status).toBe('verified');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: {
        customDomain: 'blog.custom.com',
        settings: { domainVerification: expect.objectContaining({ status: 'verified', domain: 'blog.custom.com' }) },
      },
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'blog.custom.com' }) });
  });

  it('BS-DS-13: 같은 도메인을 다른 테넌트가 먼저 인증했으면 DNS 인증에 성공해도 설정하지 않는다', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(pendingTenant());
    prisma.tenant.findFirst.mockResolvedValue({ id: 't-2' });
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([['withwiz-verify=mock-uuid-token']]);

    await expect(service.checkVerification('t-1', 'blog.custom.com'))
      .rejects.toThrow('이미 다른 테넌트에서 인증한 도메인');
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('BS-DS-14: 동시 인증으로 customDomain 고유 제약(P2002)에 걸리면 같은 오류로 알린다', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(pendingTenant());
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
    (resolveTxt as ReturnType<typeof vi.fn>).mockResolvedValue([['withwiz-verify=mock-uuid-token']]);

    await expect(service.checkVerification('t-1', 'blog.custom.com'))
      .rejects.toThrow('이미 다른 테넌트에서 인증한 도메인');
  });

  it('BS-DS-15: checkVerification — 인증 대기 도메인과 다른 도메인이면 오류이고 DNS 를 조회하지 않는다', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue(pendingTenant());

    await expect(service.checkVerification('t-1', 'other.custom.com'))
      .rejects.toThrow('테넌트에 등록된 도메인이 아닙니다');
    expect(resolveTxt).not.toHaveBeenCalled();
  });

  it('BS-DS-16: addCustomDomain — 이미 인증한 같은 도메인이면 인증 데이터를 다시 만들지 않는다', async () => {
    const service = createDomainService(prisma, { baseDomain: 'blog.example.com' });
    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      settings: {
        domainVerification: {
          domain: 'blog.custom.com', token: 'old-token', status: 'verified', sslStatus: 'active',
          createdAt: '2025-01-01T00:00:00.000Z', verifiedAt: '2025-01-02T00:00:00.000Z',
        },
      },
    });
    prisma.tenant.findFirst.mockResolvedValue(null);

    const result = await service.addCustomDomain('t-1', 'blog.custom.com');

    expect(result.status).toBe('verified');
    expect(result.verificationRecord.value).toBe('withwiz-verify=old-token');
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('BS-DS-17: addCustomDomain — 인증한 도메인을 다른 도메인으로 바꾸면 기존 도메인을 해제하고 Vercel 에서 제거한다', async () => {
    const service = createDomainService(prisma, VERCEL_CONFIG);
    prisma.tenant.findUnique.mockResolvedValue({
      ...baseTenant,
      settings: {
        domainVerification: {
          domain: 'blog.custom.com', token: 'old-token', status: 'verified', sslStatus: 'active',
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      },
    });
    prisma.tenant.findFirst.mockResolvedValue(null);
    prisma.tenant.update.mockResolvedValue({});
    const mockFetch = stubFetch();

    await service.addCustomDomain('t-1', 'new.custom.com');

    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customDomain: null }) }),
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('/domains/blog.custom.com');
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
