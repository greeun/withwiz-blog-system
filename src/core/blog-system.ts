import {
  createBlogService,
  createTagService,
  createCommentService,
  createSearchService,
  createSchedulerService,
} from '@withwiz/blog-core/services';
import type {
  BlogService,
  BlogServiceConfig,
  TagService,
  CommentService,
  SearchService,
  SchedulerService,
} from '@withwiz/blog-core/services';
import type { BlogSystemConfig, BlogSystem } from '../types/system';
import { resolveBlogConfig } from './config';
import { createTenantProxy } from './tenant-proxy';
import { createAuthService } from '../auth/auth-service';
import { createBlogRoutes } from '../routes/blog-routes';
import { createAuthRoutes } from '../routes/auth-routes';
import { createTenantRoutes } from '../routes/tenant-routes';
import { createSuperAdminRoutes } from '../routes/admin-routes';
import { createTagRoutes } from '../routes/tag-routes';
import { createCommentRoutes } from '../routes/comment-routes';
import { createSearchRoutes } from '../routes/search-routes';
import { createSchedulerRoutes } from '../routes/scheduler-routes';
import type { TagRoutes } from '../routes/tag-routes';
import type { CommentRoutes } from '../routes/comment-routes';
import type { SearchRoutes } from '../routes/search-routes';
import type { SchedulerRoutes } from '../routes/scheduler-routes';
import { createTenantService } from '../tenant/tenant-service';
import { createTenantUserService } from '../tenant/tenant-user-service';
import { createTenantResolver } from '../tenant/tenant-resolver';
import { resolveTenantFromRequest } from '../tenant/tenant-middleware';
import { createTenantRoleMiddleware } from '../auth/role-middleware';
import { createOnboardingService } from '../onboarding/onboarding-service';
import { createPlanService } from '../billing/plan-service';
import { createBillingService } from '../billing/billing-service';
import { createBillingRoutes } from '../routes/billing-routes';
import { createDomainService } from '../tenant/domain-service';
import { createDomainRoutes } from '../routes/domain-routes';
import type { TenantRole } from '../types/tenant';

function inferTableName(modelName: string): string {
  return modelName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

export function createBlogSystem(config: BlogSystemConfig): BlogSystem {
  const blogConfig = resolveBlogConfig(config);

  const features = config.features ?? {};
  const tagsEnabled = features.tags !== false;
  const commentsEnabled = features.comments?.enabled === true;
  const searchEnabled = features.search !== false;
  const schedulerEnabled = features.scheduler?.enabled === true;

  // single 모드의 blogService 와 multi 모드의 createScopedBlogService 가 함께 사용한다.
  const blogServiceConfig: BlogServiceConfig = {
    modelName: blogConfig.modelName,
    enableTags: tagsEnabled,
    storage: config.storage,
    // 미지정(undefined)이면 blog-core 가 기본 새니타이저를 사용한다.
    sanitizeContent: config.sanitizeContent,
  };

  const authService = createAuthService(config.prisma, config.auth);

  if (config.mode === 'single') {
    const blogService = createBlogService(config.prisma, blogServiceConfig);

    const blogRoutes = createBlogRoutes(blogService, {
      pageSize: config.blog.pageSize,
    });
    const authRoutes = createAuthRoutes(authService);

    let tagService: TagService | null = null;
    let tagRoutes: TagRoutes | null = null;
    if (tagsEnabled) {
      tagService = createTagService(config.prisma, {
        postModelName: blogConfig.modelName,
      });
      tagRoutes = createTagRoutes(tagService);
    }

    let commentService: CommentService | null = null;
    let commentRoutes: CommentRoutes | null = null;
    if (commentsEnabled && features.comments) {
      commentService = createCommentService(config.prisma, {
        autoApprove: features.comments.autoApprove,
        requireLogin: features.comments.requireLogin,
        maxDepth: features.comments.maxDepth,
        rateLimit: features.comments.rateLimit,
      });
      commentRoutes = createCommentRoutes(commentService, {
        requireLogin: features.comments.requireLogin,
      });
    }

    let searchService: SearchService | null = null;
    let searchRoutes: SearchRoutes | null = null;
    if (searchEnabled) {
      // SearchService는 $queryRawUnsafe가 필요하므로 any 캐스팅으로 주입한다.
      // PrismaClientLike의 덕 타이핑은 $transaction만 요구하지만, 실제 Prisma 클라이언트는
      // $queryRaw / $queryRawUnsafe를 제공하므로 런타임 안전성에는 문제가 없다.
      searchService = createSearchService(
        config.prisma as unknown as Parameters<typeof createSearchService>[0],
        {
          postModelName: blogConfig.modelName,
          tableName: inferTableName(blogConfig.modelName),
        },
      );
      searchRoutes = createSearchRoutes(searchService);
    }

    let schedulerService: SchedulerService | null = null;
    let schedulerRoutes: SchedulerRoutes | null = null;
    if (schedulerEnabled && features.scheduler) {
      schedulerService = createSchedulerService(config.prisma, {
        modelName: blogConfig.modelName,
      });
      schedulerRoutes = createSchedulerRoutes(schedulerService, {
        cronSecret: features.scheduler.cronSecret,
      });
    }

    return {
      blogService,
      authService,
      tenantService: null,
      tenantUserService: null,
      onboardingService: null,
      billingService: null,
      planService: null,
      domainService: null,
      tagService,
      commentService,
      searchService,
      schedulerService,
      routes: {
        blog: blogRoutes,
        auth: authRoutes,
        tenant: null,
        admin: null,
        billing: null,
        domain: null,
        tag: tagRoutes,
        comment: commentRoutes,
        search: searchRoutes,
        scheduler: schedulerRoutes,
      },
      middleware: {
        tenantResolver: null,
        auth: null,
        adminAuth: null,
        resolveTenantFromRequest: null,
        requireTenantRole: null,
      },
      blogConfig,
      createScopedBlogService: null,
    };
  }

  const createScopedBlogService = (tenantId: string): BlogService => {
    const scopedPrisma = createTenantProxy(config.prisma, tenantId);
    return createBlogService(scopedPrisma, blogServiceConfig);
  };

  const tenantService = createTenantService(config.prisma);
  const tenantUserService = createTenantUserService(config.prisma);
  const tenantResolver = createTenantResolver(config.prisma);

  const baseDomain = config.domain?.baseDomain ?? 'localhost';

  const tenantRoutes = createTenantRoutes(tenantService, tenantUserService);

  const authRoutes = createAuthRoutes(authService);

  const blogRoutes = createBlogRoutes(
    null as unknown as BlogService,
    { pageSize: config.blog.pageSize },
    {
      createScopedService: createScopedBlogService,
      tenantResolver,
      baseDomain,
    },
  );

  const onboardingService = createOnboardingService(
    tenantService,
    tenantUserService,
    createScopedBlogService,
  );

  const adminRoutes = createSuperAdminRoutes(
    tenantService,
    tenantUserService,
    config.prisma,
    onboardingService,
  );

  const planService = config.billing
    ? createPlanService(config.prisma)
    : null;

  const billingService = config.billing
    ? createBillingService(config.prisma, {
        secretKey: config.billing.stripeSecretKey,
        webhookSecret: config.billing.stripeWebhookSecret,
      })
    : null;

  const billingRoutes =
    billingService && planService
      ? createBillingRoutes(billingService, planService, tenantUserService)
      : null;

  const domainService = config.domain
    ? createDomainService(config.prisma, {
        baseDomain: config.domain.baseDomain,
        vercelTeamId: config.domain.vercelTeamId,
        vercelProjectId: config.domain.vercelProjectId,
        vercelApiToken: config.domain.vercelApiToken,
      })
    : null;

  const domainRoutes = domainService
    ? createDomainRoutes(domainService, tenantUserService)
    : null;

  async function resolveScopedPrismaFromRequest(
    req: Request,
  ): Promise<ReturnType<typeof createTenantProxy> | null> {
    const tenant = await resolveTenantFromRequest(
      req,
      tenantResolver,
      baseDomain,
    );
    if (!tenant) return null;
    return createTenantProxy(config.prisma, tenant.tenantId);
  }

  // 라우트 핸들러들은 request 없이 service 메서드를 직접 호출(예: `tagService.listAll(...)`)
  // 하므로, Proxy에서 request 컨텍스트를 얻을 수 없다. 따라서 멀티 테넌트 모드에서는
  // tag/comment/search/scheduler 라우트를 null로 두고, 호스트 프로젝트가 직접 테넌트별로
  // 서비스를 만들어 createXRoutes를 호출하도록 권장한다.
  void resolveScopedPrismaFromRequest;

  return {
    blogService: null,
    authService,
    tenantService,
    tenantUserService,
    onboardingService,
    billingService,
    planService,
    domainService,
    tagService: null,
    commentService: null,
    searchService: null,
    schedulerService: null,
    routes: {
      blog: blogRoutes,
      auth: authRoutes,
      tenant: tenantRoutes,
      admin: adminRoutes,
      billing: billingRoutes,
      domain: domainRoutes,
      tag: null,
      comment: null,
      search: null,
      scheduler: null,
    },
    middleware: {
      tenantResolver: null,
      auth: null,
      adminAuth: null,
      resolveTenantFromRequest: (req: Request, overrideBaseDomain?: string) =>
        resolveTenantFromRequest(
          req,
          tenantResolver,
          overrideBaseDomain ?? baseDomain,
        ),
      requireTenantRole: (_role: TenantRole) =>
        createTenantRoleMiddleware(tenantUserService, _role),
    },
    blogConfig,
    createScopedBlogService,
  };
}
