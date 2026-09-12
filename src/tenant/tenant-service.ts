import type { PaginatedResult } from '@withwiz/blog-core/types';
import type { PrismaClientLike } from '../types/system';
import type {
  Tenant,
  CreateTenantInput,
  UpdateTenantInput,
  TenantSettings,
} from '../types/tenant';

export interface TenantService {
  create(data: CreateTenantInput): Promise<Tenant>;
  getById(id: string): Promise<Tenant | null>;
  getBySlug(slug: string): Promise<Tenant | null>;
  getByCustomDomain(domain: string): Promise<Tenant | null>;
  update(id: string, data: UpdateTenantInput): Promise<Tenant>;
  deactivate(id: string): Promise<void>;

  listAll(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<PaginatedResult<Tenant>>;

  getSettings(tenantId: string): Promise<TenantSettings>;
  updateSettings(
    tenantId: string,
    settings: Partial<TenantSettings>,
  ): Promise<TenantSettings>;
}

const DEFAULT_TENANT_SETTINGS: TenantSettings = {
  blogConfig: {},
  theme: {},
  seo: {},
};

export function createTenantService(prisma: PrismaClientLike): TenantService {
  return {
    async create(data: CreateTenantInput): Promise<Tenant> {
      const existing = await prisma.tenant.findUnique({
        where: { slug: data.slug },
      });
      if (existing) {
        throw new Error(`이미 사용 중인 슬러그입니다: ${data.slug}`);
      }

      const settings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...data.settings,
      };

      return prisma.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          logo: data.logo ?? null,
          planId: data.planId ?? null,
          settings,
          isActive: true,
        },
      });
    },

    async getById(id: string): Promise<Tenant | null> {
      return prisma.tenant.findUnique({ where: { id } });
    },

    async getBySlug(slug: string): Promise<Tenant | null> {
      return prisma.tenant.findUnique({ where: { slug } });
    },

    async getByCustomDomain(domain: string): Promise<Tenant | null> {
      return prisma.tenant.findFirst({
        where: { customDomain: domain, isActive: true },
      });
    },

    async update(id: string, data: UpdateTenantInput): Promise<Tenant> {
      if (data.slug) {
        const existing = await prisma.tenant.findFirst({
          where: { slug: data.slug, NOT: { id } },
        });
        if (existing) {
          throw new Error(`이미 사용 중인 슬러그입니다: ${data.slug}`);
        }
      }

      return prisma.tenant.update({
        where: { id },
        data,
      });
    },

    async deactivate(id: string): Promise<void> {
      await prisma.tenant.update({
        where: { id },
        data: { isActive: false },
      });
    },

    async listAll(options): Promise<PaginatedResult<Tenant>> {
      const { page, limit, search } = options;
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [total, items] = await Promise.all([
        prisma.tenant.count({ where }),
        prisma.tenant.findMany({
          where,
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

    async getSettings(tenantId: string): Promise<TenantSettings> {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      if (!tenant) {
        throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
      }

      return {
        ...DEFAULT_TENANT_SETTINGS,
        ...(tenant.settings as Partial<TenantSettings>),
      };
    },

    async updateSettings(
      tenantId: string,
      settings: Partial<TenantSettings>,
    ): Promise<TenantSettings> {
      const current = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });

      if (!current) {
        throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
      }

      const currentSettings = {
        ...DEFAULT_TENANT_SETTINGS,
        ...(current.settings as Partial<TenantSettings>),
      };
      const merged: TenantSettings = {
        blogConfig: { ...currentSettings.blogConfig, ...settings.blogConfig },
        theme: { ...currentSettings.theme, ...settings.theme },
        seo: { ...currentSettings.seo, ...settings.seo },
        // 도메인 인증 데이터 보존 (domainVerification은 DomainService가 관리)
        domainVerification:
          settings.domainVerification ?? currentSettings.domainVerification,
      };

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { settings: merged as any },
      });

      return merged;
    },
  };
}
