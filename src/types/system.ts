import type { BlogConfig, CategoryTheme, StorageAdapter, BlogI18nStrings } from '@withwiz/blog-core/types';
import type {
  BlogService,
  BlogServiceConfig,
  TagService,
  CommentService,
  SearchService,
  SchedulerService,
} from '@withwiz/blog-core/services';
import type { TagRoutes } from '../routes/tag-routes';
import type { CommentRoutes } from '../routes/comment-routes';
import type { SearchRoutes } from '../routes/search-routes';
import type { SchedulerRoutes } from '../routes/scheduler-routes';
import type { NextMiddleware } from './middleware';
import type { AuthService } from '../auth/auth-service';
import type { BlogRoutes } from '../routes/blog-routes';
import type { AuthRoutes } from '../routes/auth-routes';
import type { TenantRoutes } from '../routes/tenant-routes';
import type { SuperAdminRoutes } from '../routes/admin-routes';
import type { TenantService } from '../tenant/tenant-service';
import type { TenantUserService } from '../tenant/tenant-user-service';
import type { TenantResolver } from '../tenant/tenant-resolver';
import type { TenantResolutionResult } from '../tenant/tenant-middleware';
import type { OnboardingService } from '../onboarding/onboarding-service';
import type { BillingService } from '../billing/billing-service';
import type { PlanService } from '../billing/plan-service';
import type { DomainService } from '../tenant/domain-service';
import type { DomainRoutes } from '../routes/domain-routes';
import type { TenantRole } from './tenant';
import type { TApiMiddleware } from '@withwiz/toolkit/next/middleware/types';

export enum SystemRole {
  USER = 'USER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface BlogSystemConfig {
  mode: 'single' | 'multi';
  prisma: PrismaClientLike;

  auth: {
    jwtSecret: string;
    /** 기본값: '15m' */
    accessTokenExpiry?: string;
    /** 기본값: '7d' */
    refreshTokenExpiry?: string;
    oauthProviders?: {
      google?: OAuthProviderConfig;
      github?: OAuthProviderConfig;
    };
  };

  blog: {
    /** Prisma 모델명 (예: 'news', 'blogPost') */
    modelName: string;
    categories?: Record<string, CategoryTheme>;
    /** 기본값: '/blog' */
    basePath?: string;
    /** 기본값: '/admin/blog' */
    adminBasePath?: string;
    /** 기본값: '/api/upload' */
    uploadEndpoint?: string;
    /** 기본값: 12 */
    pageSize?: number;
    maxAttachments?: number;
    enableCta?: boolean;
    enableFeatured?: boolean;
    enableAttachments?: boolean;
    i18n?: BlogI18nStrings;
    authRefreshPath?: string;
    loginPath?: string;
  };

  /** 스토리지 어댑터 (선택). 지정하면 포스트 삭제 시 첨부 이미지 정리에 사용된다. */
  storage?: StorageAdapter;

  /**
   * 포스트 본문 HTML 새니타이저 (선택).
   * 지정하면 single·multi 모드의 블로그 서비스가 create·update 시 본문 저장 전에 이 함수를 사용한다.
   * 지정하지 않으면 blog-core 기본 새니타이저를 사용한다. 기본 새니타이저는 DOMPurify 를
   * 불러오지 못하는 번들 환경(예: Next.js Turbopack 서버 번들)에서 정규식 폴백으로 동작하므로,
   * 신뢰할 수 없는 HTML 을 다룬다면 호스트가 검증된 새니타이저를 지정하는 것을 권장한다.
   * 타입은 blog-core `BlogServiceConfig.sanitizeContent` 와 같다.
   */
  sanitizeContent?: BlogServiceConfig['sanitizeContent'];

  /** multi 모드 전용 */
  billing?: {
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    plans: PlanDefinition[];
  };

  /** multi 모드 전용 */
  domain?: {
    baseDomain: string;
    vercelTeamId?: string;
    vercelProjectId?: string;
    vercelApiToken?: string;
  };

  features?: {
    /** 기본: true */
    tags?: boolean;
    comments?: {
      enabled: boolean;
      /** 기본: false */
      autoApprove?: boolean;
      /** 기본: false */
      requireLogin?: boolean;
      /** 기본: 2 */
      maxDepth?: number;
      rateLimit?: { maxPerHour?: number };
    };
    /** 기본: true, Postgres FTS 필요 */
    search?: boolean;
    scheduler?: {
      enabled: boolean;
      /** enabled=true인 경우 필수 */
      cronSecret: string;
    };
  };
}

import type { PlanDefinition } from './billing';
export type { PlanDefinition };

export type ApiMiddleware = ((req: Request) => Promise<Response | void>) | null;

export type RouteHandler = (req: Request, ctx?: any) => Promise<Response>;

export type RouteHandlers = Record<string, RouteHandler>;

export interface BlogSystem {
  /** single 모드에서만 non-null */
  blogService: BlogService | null;
  authService: AuthService | null;
  /** multi 모드 전용 */
  tenantService: TenantService | null;
  /** multi 모드 전용 */
  tenantUserService: TenantUserService | null;
  /** multi 모드 전용 */
  onboardingService: OnboardingService | null;
  /** multi 모드 전용 */
  billingService: BillingService | null;
  /** multi 모드 전용 */
  planService: PlanService | null;
  /** multi 모드 + domain 설정 시 */
  domainService: DomainService | null;
  /** single 모드 + features.tags 활성화 시 */
  tagService: TagService | null;
  /** single 모드 + features.comments.enabled 시 */
  commentService: CommentService | null;
  /** single 모드 + features.search 활성화 시 */
  searchService: SearchService | null;
  schedulerService: SchedulerService | null;

  routes: {
    blog: BlogRoutes | null;
    auth: AuthRoutes | null;
    /** multi 모드 전용 */
    tenant: TenantRoutes | null;
    /** multi 모드 전용 */
    admin: SuperAdminRoutes | null;
    /** multi 모드 전용 */
    billing: Record<string, Record<string, any>> | null;
    /** multi 모드 + domain 설정 시 */
    domain: DomainRoutes | null;
    tag: TagRoutes | null;
    comment: CommentRoutes | null;
    search: SearchRoutes | null;
    scheduler: SchedulerRoutes | null;
  };

  middleware: {
    /** multi 모드 전용 (Next.js 미들웨어) */
    tenantResolver: NextMiddleware | null;
    auth: ApiMiddleware;
    adminAuth: ApiMiddleware;
    /** multi 모드 전용 */
    resolveTenantFromRequest:
      | ((
          req: Request,
          baseDomain?: string,
        ) => Promise<TenantResolutionResult | null>)
      | null;
    /** multi 모드 전용 */
    requireTenantRole: ((role: TenantRole) => TApiMiddleware) | null;
  };

  blogConfig: BlogConfig;

  /** multi 모드 전용 */
  createScopedBlogService: ((tenantId: string) => BlogService) | null;
}

/** 덕 타이핑 기반 Prisma 클라이언트 최소 인터페이스 */
export type PrismaClientLike = {
  [key: string]: any;
  $transaction: (fn: (tx: any) => Promise<any>) => Promise<any>;
  $queryRawUnsafe: (sql: string, ...values: any[]) => Promise<any[]>;
};
