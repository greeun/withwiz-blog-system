import { resolveTxt } from 'dns/promises';
import { randomUUID } from 'crypto';
import type { PaginatedResult } from '@withwiz/blog-core/types';
import type { PrismaClientLike } from '../types/system';
import type {
  DomainVerification,
  DomainInfo,
  TenantSettings,
  TenantDomainVerificationData,
} from '../types/tenant';

export interface DomainService {
  addCustomDomain(
    tenantId: string,
    domain: string,
  ): Promise<DomainVerification>;

  checkVerification(
    tenantId: string,
    domain: string,
  ): Promise<DomainVerification>;

  verifyDomain(tenantId: string, domain: string): Promise<boolean>;

  removeCustomDomain(tenantId: string): Promise<void>;

  listCustomDomains(options?: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<DomainInfo>>;
}

export interface DomainServiceConfig {
  baseDomain: string;
  vercelTeamId?: string;
  vercelProjectId?: string;
  vercelApiToken?: string;
}

const VERIFICATION_PREFIX = '_withwiz-verify';
const VERIFICATION_VALUE_PREFIX = 'withwiz-verify=';

async function addVercelDomain(
  domain: string,
  projectId: string,
  teamId: string,
  apiToken: string,
): Promise<void> {
  try {
    const url = `https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[DomainService] Vercel 도메인 추가 실패: ${response.status} ${body}`);
    }
  } catch (error) {
    console.warn('[DomainService] Vercel API 호출 실패:', error);
  }
}

async function removeVercelDomain(
  domain: string,
  projectId: string,
  teamId: string,
  apiToken: string,
): Promise<void> {
  try {
    const url = `https://api.vercel.com/v10/projects/${projectId}/domains/${domain}?teamId=${teamId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[DomainService] Vercel 도메인 제거 실패: ${response.status} ${body}`);
    }
  } catch (error) {
    console.warn('[DomainService] Vercel API 호출 실패:', error);
  }
}

async function checkDnsTxtRecord(
  domain: string,
  token: string,
): Promise<boolean> {
  try {
    const hostname = `${VERIFICATION_PREFIX}.${domain}`;
    const records = await resolveTxt(hostname);

    const expectedValue = `${VERIFICATION_VALUE_PREFIX}${token}`;
    return records.some((parts) =>
      parts.some((part) => part === expectedValue),
    );
  } catch {
    return false;
  }
}

function getDomainVerificationData(
  settings: Record<string, unknown>,
): TenantDomainVerificationData | null {
  const data = settings?.domainVerification as
    | TenantDomainVerificationData
    | undefined;
  if (!data || !data.token) return null;
  return data;
}

function buildVerificationResponse(
  domain: string,
  tenantId: string,
  verificationData: TenantDomainVerificationData,
): DomainVerification {
  return {
    domain,
    tenantId,
    status: verificationData.status,
    verificationRecord: {
      type: 'TXT' as const,
      name: `${VERIFICATION_PREFIX}.${domain}`,
      value: `${VERIFICATION_VALUE_PREFIX}${verificationData.token}`,
    },
    sslStatus: verificationData.sslStatus,
    verifiedAt: verificationData.verifiedAt
      ? new Date(verificationData.verifiedAt)
      : undefined,
    createdAt: new Date(verificationData.createdAt),
  };
}

export function createDomainService(
  prisma: PrismaClientLike,
  domainConfig: DomainServiceConfig,
): DomainService {
  const vercelEnabled = !!(
    domainConfig.vercelTeamId &&
    domainConfig.vercelProjectId &&
    domainConfig.vercelApiToken
  );

  return {
    async addCustomDomain(
      tenantId: string,
      domain: string,
    ): Promise<DomainVerification> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
      }

      const existingDomain = await prisma.tenant.findFirst({
        where: { customDomain: domain, NOT: { id: tenantId } },
      });
      if (existingDomain) {
        throw new Error(`이미 다른 테넌트에서 사용 중인 도메인입니다: ${domain}`);
      }

      const token = randomUUID();
      const now = new Date().toISOString();

      const verificationData: TenantDomainVerificationData = {
        token,
        status: 'pending',
        sslStatus: 'pending',
        createdAt: now,
      };

      const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
      const updatedSettings = {
        ...currentSettings,
        domainVerification: verificationData,
      };

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          customDomain: domain,
          settings: updatedSettings,
        },
      });

      if (vercelEnabled) {
        await addVercelDomain(
          domain,
          domainConfig.vercelProjectId!,
          domainConfig.vercelTeamId!,
          domainConfig.vercelApiToken!,
        );
      }

      return buildVerificationResponse(domain, tenantId, verificationData);
    },

    async checkVerification(
      tenantId: string,
      domain: string,
    ): Promise<DomainVerification> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
      }

      if (tenant.customDomain !== domain) {
        throw new Error(`테넌트에 등록된 도메인이 아닙니다: ${domain}`);
      }

      const settings = (tenant.settings as Record<string, unknown>) ?? {};
      const verificationData = getDomainVerificationData(settings);
      if (!verificationData) {
        throw new Error('도메인 인증 데이터가 없습니다. addCustomDomain을 먼저 호출하세요.');
      }

      if (verificationData.status === 'verified') {
        return buildVerificationResponse(domain, tenantId, verificationData);
      }

      const verified = await checkDnsTxtRecord(domain, verificationData.token);

      if (verified) {
        const now = new Date().toISOString();
        const updatedVerification: TenantDomainVerificationData = {
          ...verificationData,
          status: 'verified',
          sslStatus: vercelEnabled ? 'active' : 'pending',
          verifiedAt: now,
        };

        const updatedSettings = {
          ...settings,
          domainVerification: updatedVerification,
        };

        await prisma.tenant.update({
          where: { id: tenantId },
          data: { settings: updatedSettings },
        });

        return buildVerificationResponse(domain, tenantId, updatedVerification);
      }

      return buildVerificationResponse(domain, tenantId, verificationData);
    },

    async verifyDomain(
      tenantId: string,
      domain: string,
    ): Promise<boolean> {
      const result = await this.checkVerification(tenantId, domain);
      return result.status === 'verified';
    },

    async removeCustomDomain(tenantId: string): Promise<void> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
      }

      const previousDomain = tenant.customDomain;

      const settings = (tenant.settings as Record<string, unknown>) ?? {};
      const { domainVerification: _, ...cleanSettings } = settings;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          customDomain: null,
          settings: cleanSettings,
        },
      });

      if (vercelEnabled && previousDomain) {
        await removeVercelDomain(
          previousDomain,
          domainConfig.vercelProjectId!,
          domainConfig.vercelTeamId!,
          domainConfig.vercelApiToken!,
        );
      }
    },

    async listCustomDomains(
      options: { page: number; limit: number } = { page: 1, limit: 20 },
    ): Promise<PaginatedResult<DomainInfo>> {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const where = { customDomain: { not: null } };

      const [total, tenants] = await Promise.all([
        prisma.tenant.count({ where }),
        prisma.tenant.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const items: DomainInfo[] = tenants.map(
        (tenant: {
          customDomain: string | null;
          id: string;
          name: string;
          settings: Record<string, unknown>;
          createdAt: Date;
        }) => {
          const settings = (tenant.settings as Record<string, unknown>) ?? {};
          const verificationData = getDomainVerificationData(settings);

          return {
            domain: tenant.customDomain!,
            tenantId: tenant.id,
            tenantName: tenant.name,
            status: verificationData?.status ?? 'pending',
            sslStatus: verificationData?.sslStatus ?? 'pending',
            createdAt: verificationData
              ? new Date(verificationData.createdAt)
              : tenant.createdAt,
          };
        },
      );

      return {
        items,
        total,
        page,
        limit,
        totalPages,
      };
    },
  };
}
