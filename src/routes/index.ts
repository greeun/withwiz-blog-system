export { createBlogRoutes } from './blog-routes';
export type {
  BlogRoutes,
  BlogRoutesOptions,
  BlogRoutesMultiTenantConfig,
} from './blog-routes';

export { createAuthRoutes } from './auth-routes';
export type { AuthRoutes } from './auth-routes';

export { createTenantRoutes } from './tenant-routes';
export type { TenantRoutes } from './tenant-routes';

export { createSuperAdminRoutes } from './admin-routes';
export type { SuperAdminRoutes } from './admin-routes';

export { createBillingRoutes } from './billing-routes';
export type { BillingRoutes } from './billing-routes';

export { createDomainRoutes } from './domain-routes';
export type { DomainRoutes } from './domain-routes';

export { createTagRoutes } from './tag-routes';
export type { TagRoutes } from './tag-routes';

export {
  createCommentRoutes,
  extractClientIp,
  hashIp,
} from './comment-routes';
export type { CommentRoutes, CommentRoutesConfig } from './comment-routes';

export { createSearchRoutes } from './search-routes';
export type { SearchRoutes } from './search-routes';

export { createSchedulerRoutes } from './scheduler-routes';
export type { SchedulerRoutes, SchedulerRoutesConfig } from './scheduler-routes';
