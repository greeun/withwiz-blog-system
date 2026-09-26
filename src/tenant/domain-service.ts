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

/** 인증 대상 도메인. 이전 데이터는 `domain` 필드가 없으므로 `customDomain` 을 사용한다. */
function getPendingDomain(
  verificationData: TenantDomainVerificationData,
  customDomain: string | null,
): string | null {
  return verificationData.domain ?? customDomain;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
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

/**
 * 커스텀 도메인 서비스.
 *
 * `addCustomDomain` 은 도메인을 인증 대기 상태로 `settings.domainVerification` 에만 저장한다.
 * `tenant.customDomain`(테넌트 해석에 사용하는 컬럼)은 DNS TXT 인증에 성공한 뒤에만 설정하므로,
 * 소유하지 않은 도메인을 먼저 등록해 선점하거나 인증 전에 활성화할 수 없다.
 * 같은 도메인을 여러 테넌트가 인증 대기할 수 있으며, 먼저 인증한 테넌트가 도메인을 갖는다.
 * Vercel 프로젝트 도메인 등록도 인증 성공 뒤에 한다.
 */
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

      const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};

      // 이미 인증을 마친 같은 도메인이면 인증 데이터를 다시 만들지 않는다.
      const currentVerification = getDomainVerificationData(currentSettings);
      if (
        tenant.customDomain === domain &&
        currentVerification?.status === 'verified'
      ) {
        return buildVerificationResponse(domain, tenantId, currentVerification);
      }

      const token = randomUUID();
      const now = new Date().toISOString();

      const verificationData: TenantDomainVerificationData = {
        domain,
        token,
        status: 'pending',
        sslStatus: 'pending',
        createdAt: now,
      };

      const updatedSettings = {
        ...currentSettings,
        domainVerification: verificationData,
      };

      // 인증 전이므로 customDomain 은 비워 둔다. 기존에 인증한 다른 도메인이 있으면 여기서 해제된다.
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          customDomain: null,
          settings: updatedSettings,
        },
      });

      if (vercelEnabled && tenant.customDomain) {
        await removeVercelDomain(
          tenant.customDomain,
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

      const settings = (tenant.settings as Record<string, unknown>) ?? {};
      const verificationData = getDomainVerificationData(settings);
      if (!verificationData) {
        throw new Error('도메인 인증 데이터가 없습니다. addCustomDomain을 먼저 호출하세요.');
      }

      if (getPendingDomain(verificationData, tenant.customDomain) !== domain) {
        throw new Error(`테넌트에 등록된 도메인이 아닙니다: ${domain}`);
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

        const claimed = await prisma.tenant.findFirst({
          where: { customDomain: domain, NOT: { id: tenantId } },
        });
        if (claimed) {
          throw new Error(`이미 다른 테넌트에서 인증한 도메인입니다: ${domain}`);
        }

        try {
          await prisma.tenant.update({
            where: { id: tenantId },
            data: { customDomain: domain, settings: updatedSettings },
          });
        } catch (error) {
          // 두 테넌트가 동시에 인증하면 customDomain 고유 제약이 나중 요청을 막는다.
          if (isUniqueConstraintError(error)) {
            throw new Error(`이미 다른 테넌트에서 인증한 도메인입니다: ${domain}`);
          }
          throw error;
        }

        if (vercelEnabled) {
          await addVercelDomain(
            domain,
            domainConfig.vercelProjectId!,
            domainConfig.vercelTeamId!,
            domainConfig.vercelApiToken!,
          );
        }

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
