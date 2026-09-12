import { createSchedulerRoutes } from '@withwiz/blog-core/routes';

export { createSchedulerRoutes };
export type {
  SchedulerAdminRoutes,
  SchedulerRoutesConfig,
} from '@withwiz/blog-core/routes';

export type SchedulerRoutes = ReturnType<typeof createSchedulerRoutes>;
