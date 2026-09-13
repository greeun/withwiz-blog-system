export { createBlogSystem } from './core';
export { createTenantProxy } from './core';
export { resolveBlogConfig } from './core';

export { createAuthService } from './auth';
export type { AuthService, AuthServiceConfig } from './auth';
export { createAuthFetch } from './auth';
export type { AuthFetchConfig } from './auth';

export { createBlogRoutes } from './routes';
export type { BlogRoutes, BlogRoutesOptions, BlogRoutesMultiTenantConfig } from './routes';
export { createAuthRoutes } from './routes';
export type { AuthRoutes } from './routes';
export { createTenantRoutes } from './routes';
export type { TenantRoutes } from './routes';
export { createSuperAdminRoutes } from './routes';
export type { SuperAdminRoutes } from './routes';

export type {
  BlogSystemConfig,
  BlogSystem,
  PlanDefinition,
  OAuthProviderConfig,
  ApiMiddleware,
  RouteHandler,
  RouteHandlers,
  PrismaClientLike,
} from './types';
export { SystemRole } from './types';

export type {
  Tenant,
  TenantUser,
  TenantSettings,
  CreateTenantInput,
  UpdateTenantInput,
  DomainVerification,
  DomainVerificationStatus,
  DomainSslStatus,
  DomainVerificationRecord,
  DomainInfo,
  TenantDomainVerificationData,
} from './types';
export { TenantRole } from './types';

export { createTenantService } from './tenant';
export type { TenantService } from './tenant';
export { createTenantUserService } from './tenant';
export type {
  TenantUserService,
  TenantUserWithUser,
  UserTenantMembership,
} from './tenant';
export { createTenantResolver } from './tenant';
export type { TenantResolver } from './tenant';
export {
  resolveTenantFromRequest,
  TENANT_ID_HEADER,
  TENANT_SLUG_HEADER,
} from './tenant';
export type { TenantResolutionResult } from './tenant';
export { createDomainService } from './tenant';
export type { DomainService, DomainServiceConfig } from './tenant';

export { createDomainRoutes } from './routes';
export type { DomainRoutes } from './routes';

export {
  createTagRoutes,
  createCommentRoutes,
  extractClientIp,
  hashIp,
  createSearchRoutes,
  createSchedulerRoutes,
} from './routes';

export {
  isBlogErrorLike,
  toErrorResponse,
  withRouteErrorHandling,
} from './routes';
export type { BlogErrorLike } from './routes';
export type {
  TagRoutes,
  CommentRoutes,
  CommentRoutesConfig,
  SearchRoutes,
  SchedulerRoutes,
  SchedulerRoutesConfig,
} from './routes';

export { createTenantRoleMiddleware } from './auth';

export { CreateTenantSchema, UpdateTenantSchema } from './validators';
export type {
  CreateTenantSchemaType,
  UpdateTenantSchemaType,
} from './validators';

export type {
  Plan,
  Subscription,
  UsageRecord,
  UsageCheck,
  SubscriptionStatus,
} from './types';

export { createBillingService } from './billing';
export type { BillingService, StripeConfig } from './billing';
export { createPlanService } from './billing';
export type { PlanService } from './billing';
export { createWebhookHandler } from './billing';
export type { WebhookHandler } from './billing';

export { createBillingRoutes } from './routes';
export type { BillingRoutes } from './routes';

export { createOnboardingService } from './onboarding';
export type {
  OnboardingService,
  OnboardingInput,
  OnboardingResult,
} from './onboarding';
