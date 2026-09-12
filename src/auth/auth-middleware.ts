import type { PrismaClientLike } from '../types/system';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  role: string;
}

export function createTenantMiddleware(
  _prisma: PrismaClientLike,
): null {
  return null;
}
