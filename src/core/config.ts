import type { BlogConfig } from '@withwiz/blog-core/types';
import type { BlogSystemConfig } from '../types/system';

export function resolveBlogConfig(systemConfig: BlogSystemConfig): BlogConfig {
  const { blog } = systemConfig;
  const basePath = blog.basePath ?? '/blog';
  const adminBasePath = blog.adminBasePath ?? '/admin/blog';

  return {
    prisma: systemConfig.prisma,
    modelName: blog.modelName,
    categories: blog.categories ?? {},
    basePath,
    adminBasePath,
    apiBasePath: `/api${basePath}`,
    adminApiBasePath: `/api${adminBasePath}`,
    uploadEndpoint: blog.uploadEndpoint ?? '/api/upload',
    pageSize: blog.pageSize ?? 12,
    // undefined로 덮어쓰지 않기 위해 조건부로 전달
    ...(blog.maxAttachments !== undefined && { maxAttachments: blog.maxAttachments }),
    ...(blog.enableCta !== undefined && { enableCta: blog.enableCta }),
    ...(blog.enableFeatured !== undefined && { enableFeatured: blog.enableFeatured }),
    ...(blog.enableAttachments !== undefined && { enableAttachments: blog.enableAttachments }),
    ...(blog.i18n !== undefined && { i18n: blog.i18n }),
    ...(blog.authRefreshPath !== undefined && { authRefreshPath: blog.authRefreshPath }),
    ...(blog.loginPath !== undefined && { loginPath: blog.loginPath }),
  };
}
