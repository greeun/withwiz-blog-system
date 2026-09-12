import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const slugSchema = z
  .string()
  .min(3, '슬러그는 최소 3자 이상이어야 합니다')
  .max(63, '슬러그는 최대 63자까지 허용됩니다')
  .regex(
    SLUG_PATTERN,
    '슬러그는 영소문자, 숫자, 하이픈만 사용 가능하며 하이픈으로 시작/끝날 수 없습니다',
  );

const tenantSettingsSchema = z
  .object({
    blogConfig: z.record(z.string(), z.unknown()).optional(),
    theme: z
      .object({
        primaryColor: z.string().optional(),
        logo: z.string().url('올바른 URL 형식이 아닙니다').optional(),
        favicon: z.string().url('올바른 URL 형식이 아닙니다').optional(),
      })
      .optional(),
    seo: z
      .object({
        siteName: z.string().optional(),
        description: z.string().max(300, '설명은 최대 300자까지 허용됩니다').optional(),
        ogImage: z.string().url('올바른 URL 형식이 아닙니다').optional(),
      })
      .optional(),
  })
  .optional();

export const CreateTenantSchema = z.object({
  name: z
    .string()
    .min(1, '이름은 필수 항목입니다')
    .max(100, '이름은 최대 100자까지 허용됩니다'),
  slug: slugSchema,
  logo: z.string().url('올바른 URL 형식이 아닙니다').optional(),
  planId: z.string().cuid('올바른 플랜 ID 형식이 아닙니다').optional(),
  settings: tenantSettingsSchema,
});

export const UpdateTenantSchema = z.object({
  name: z
    .string()
    .min(1, '이름은 비어있을 수 없습니다')
    .max(100, '이름은 최대 100자까지 허용됩니다')
    .optional(),
  slug: slugSchema.optional(),
  logo: z.string().url('올바른 URL 형식이 아닙니다').optional(),
  customDomain: z.string().optional(),
  planId: z.string().cuid('올바른 플랜 ID 형식이 아닙니다').optional(),
  isActive: z.boolean().optional(),
});

export type CreateTenantSchemaType = z.infer<typeof CreateTenantSchema>;
export type UpdateTenantSchemaType = z.infer<typeof UpdateTenantSchema>;
