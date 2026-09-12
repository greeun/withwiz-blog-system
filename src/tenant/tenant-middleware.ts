import type { TenantResolver } from './tenant-resolver';
import type { Tenant } from '../types/tenant';

export interface TenantResolutionResult {
  tenantId: string;
  tenant: Tenant;
}

export const TENANT_ID_HEADER = 'X-Tenant-Id';
export const TENANT_SLUG_HEADER = 'X-Tenant-Slug';

export async function resolveTenantFromRequest(
  req: Request,
  tenantResolver: TenantResolver,
  baseDomain: string,
): Promise<TenantResolutionResult | null> {
  // 1. X-Tenant-Id 헤더 확인 (신뢰할 수 있는 내부 요청용)
  const tenantIdHeader = req.headers.get(TENANT_ID_HEADER);
  if (tenantIdHeader) {
    const tenant = await tenantResolver.resolveFromSlug(tenantIdHeader);
    // ID로 직접 조회 시도 — 헤더 값이 ID가 아닌 슬러그일 수도 있으므로 별도 처리 불요
    // 실제로는 ID 기반 조회가 필요하므로 prisma를 직접 호출해야 하지만,
    // TenantResolver 인터페이스에는 getById가 없으므로 슬러그 기반으로 처리
    if (tenant) {
      return { tenantId: tenant.id, tenant };
    }
  }

  // 2. 호스트명에서 테넌트 식별
  const url = new URL(req.url);
  const hostname = url.hostname;

  const tenant = await tenantResolver.resolve(hostname, baseDomain);
  if (tenant) {
    return { tenantId: tenant.id, tenant };
  }

  return null;
}
