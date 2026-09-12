import type { PrismaClientLike } from '../types/system';
import type { Tenant } from '../types/tenant';

export interface TenantResolver {
  resolveFromSubdomain(
    hostname: string,
    baseDomain: string,
  ): Promise<Tenant | null>;
  resolveFromCustomDomain(hostname: string): Promise<Tenant | null>;
  resolveFromSlug(slug: string): Promise<Tenant | null>;
  resolve(hostname: string, baseDomain: string): Promise<Tenant | null>;
}

function extractSubdomain(
  hostname: string,
  baseDomain: string,
): string | null {
  const host = hostname.split(':')[0];
  const base = baseDomain.split(':')[0];

  if (host === base) return null;

  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;

  return subdomain;
}

export function createTenantResolver(
  prisma: PrismaClientLike,
): TenantResolver {
  return {
    async resolveFromSubdomain(
      hostname: string,
      baseDomain: string,
    ): Promise<Tenant | null> {
      const subdomain = extractSubdomain(hostname, baseDomain);
      if (!subdomain) return null;

      return prisma.tenant.findFirst({
        where: { slug: subdomain, isActive: true },
      });
    },

    async resolveFromCustomDomain(
      hostname: string,
    ): Promise<Tenant | null> {
      const host = hostname.split(':')[0];

      return prisma.tenant.findFirst({
        where: { customDomain: host, isActive: true },
      });
    },

    async resolveFromSlug(slug: string): Promise<Tenant | null> {
      return prisma.tenant.findFirst({
        where: { slug, isActive: true },
      });
    },

    async resolve(
      hostname: string,
      baseDomain: string,
    ): Promise<Tenant | null> {
      // 1. 커스텀 도메인 확인
      const byDomain = await this.resolveFromCustomDomain(hostname);
      if (byDomain) return byDomain;

      // 2. 서브도메인 확인
      const bySubdomain = await this.resolveFromSubdomain(
        hostname,
        baseDomain,
      );
      if (bySubdomain) return bySubdomain;

      return null;
    },
  };
}
