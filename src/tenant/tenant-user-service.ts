import type { PaginatedResult } from '@withwiz/blog-core/types';
import type { PrismaClientLike } from '../types/system';
import type { Tenant, TenantUser } from '../types/tenant';
import { TenantRole } from '../types/tenant';

export const ROLE_LEVELS: Record<TenantRole, number> = {
  [TenantRole.OWNER]: 4,
  [TenantRole.ADMIN]: 3,
  [TenantRole.EDITOR]: 2,
  [TenantRole.VIEWER]: 1,
};

export type TenantUserWithUser = TenantUser & {
  user: { id: string; email: string; name: string | null };
};

export interface UserTenantMembership {
  tenant: Tenant;
  role: TenantRole;
}

export interface TenantUserService {
  addUser(tenantId: string, userId: string, role: TenantRole): Promise<TenantUser>;
  removeUser(tenantId: string, userId: string): Promise<void>;
  updateRole(tenantId: string, userId: string, role: TenantRole): Promise<TenantUser>;
  listUsers(
    tenantId: string,
    options?: { page: number; limit: number },
  ): Promise<PaginatedResult<TenantUserWithUser>>;
  getUserRole(tenantId: string, userId: string): Promise<TenantRole | null>;
  getUserTenants(userId: string): Promise<UserTenantMembership[]>;
  hasPermission(
    tenantId: string,
    userId: string,
    requiredRole: TenantRole,
  ): Promise<boolean>;
}

export function createTenantUserService(
  prisma: PrismaClientLike,
): TenantUserService {
  return {
    async addUser(
      tenantId: string,
      userId: string,
      role: TenantRole,
    ): Promise<TenantUser> {
      const existing = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });

      if (existing) {
        throw new Error('이미 해당 테넌트에 소속된 사용자입니다.');
      }

      return prisma.tenantUser.create({
        data: { tenantId, userId, role },
      });
    },

    async removeUser(tenantId: string, userId: string): Promise<void> {
      // OWNER는 제거할 수 없음 (테넌트에 최소 1명의 OWNER 필요)
      const membership = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });

      if (!membership) {
        throw new Error('해당 테넌트에 소속되지 않은 사용자입니다.');
      }

      if (membership.role === TenantRole.OWNER) {
        // OWNER가 1명뿐이면 제거 불가
        const ownerCount = await prisma.tenantUser.count({
          where: { tenantId, role: TenantRole.OWNER },
        });

        if (ownerCount <= 1) {
          throw new Error(
            '테넌트에는 최소 1명의 소유자(OWNER)가 필요합니다.',
          );
        }
      }

      await prisma.tenantUser.delete({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });
    },

    async updateRole(
      tenantId: string,
      userId: string,
      role: TenantRole,
    ): Promise<TenantUser> {
      const existing = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });

      if (!existing) {
        throw new Error('해당 테넌트에 소속되지 않은 사용자입니다.');
      }

      // OWNER → 다른 역할로 변경 시, 다른 OWNER가 있는지 확인
      if (
        existing.role === TenantRole.OWNER &&
        role !== TenantRole.OWNER
      ) {
        const ownerCount = await prisma.tenantUser.count({
          where: { tenantId, role: TenantRole.OWNER },
        });

        if (ownerCount <= 1) {
          throw new Error(
            '테넌트에는 최소 1명의 소유자(OWNER)가 필요합니다.',
          );
        }
      }

      return prisma.tenantUser.update({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        data: { role },
      });
    },

    async listUsers(
      tenantId: string,
      options: { page: number; limit: number } = { page: 1, limit: 20 },
    ): Promise<PaginatedResult<TenantUserWithUser>> {
      const { page, limit } = options;
      const skip = (page - 1) * limit;

      const [total, items] = await Promise.all([
        prisma.tenantUser.count({ where: { tenantId } }),
        prisma.tenantUser.findMany({
          where: { tenantId },
          include: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        total,
        page,
        limit,
        totalPages,
      };
    },

    async getUserRole(
      tenantId: string,
      userId: string,
    ): Promise<TenantRole | null> {
      const membership = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        select: { role: true },
      });

      return membership ? (membership.role as TenantRole) : null;
    },

    async getUserTenants(
      userId: string,
    ): Promise<UserTenantMembership[]> {
      const memberships = await prisma.tenantUser.findMany({
        where: { userId },
        include: {
          tenant: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return memberships.map(
        (m: { tenant: Tenant; role: string }) => ({
          tenant: m.tenant,
          role: m.role as TenantRole,
        }),
      );
    },

    async hasPermission(
      tenantId: string,
      userId: string,
      requiredRole: TenantRole,
    ): Promise<boolean> {
      const membership = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: { tenantId, userId },
        },
        select: { role: true },
      });

      if (!membership) return false;

      const userLevel = ROLE_LEVELS[membership.role as TenantRole] ?? 0;
      const requiredLevel = ROLE_LEVELS[requiredRole];

      return userLevel >= requiredLevel;
    },
  };
}
