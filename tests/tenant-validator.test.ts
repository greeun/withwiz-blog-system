/**
 * Task 3: tenant-validator (Zod 스키마) 테스트 (18건)
 */
import { describe, it, expect } from 'vitest';
import { CreateTenantSchema, UpdateTenantSchema } from '@withwiz/blog-system/validators';

describe('CreateTenantSchema', () => {
  const validData = {
    name: '테스트 테넌트',
    slug: 'test-tenant',
  };

  it('BS-TV-01: 유효 데이터 통과', () => {
    const result = CreateTenantSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('BS-TV-02: name 빈 문자열 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, name: '' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-03: name 101자 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('BS-TV-04: slug 2자 실패, 3자 통과', () => {
    const fail = CreateTenantSchema.safeParse({ ...validData, slug: 'ab' });
    expect(fail.success).toBe(false);

    const pass = CreateTenantSchema.safeParse({ ...validData, slug: 'abc' });
    expect(pass.success).toBe(true);
  });

  it('BS-TV-05: slug 63자 통과, 64자 실패', () => {
    const pass = CreateTenantSchema.safeParse({ ...validData, slug: 'a'.repeat(63) });
    expect(pass.success).toBe(true);

    const fail = CreateTenantSchema.safeParse({ ...validData, slug: 'a'.repeat(64) });
    expect(fail.success).toBe(false);
  });

  it('BS-TV-06: slug 하이픈 시작 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, slug: '-test' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-07: slug 하이픈 끝 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, slug: 'test-' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-08: slug 대문자 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, slug: 'Test' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-09: slug 특수문자 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, slug: 'te_st' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-10: logo 유효 URL 통과, 무효 URL 실패', () => {
    const pass = CreateTenantSchema.safeParse({ ...validData, logo: 'https://example.com/logo.png' });
    expect(pass.success).toBe(true);

    const fail = CreateTenantSchema.safeParse({ ...validData, logo: 'not-a-url' });
    expect(fail.success).toBe(false);
  });

  it('BS-TV-11: planId 비 cuid 실패', () => {
    const result = CreateTenantSchema.safeParse({ ...validData, planId: 'not-a-cuid' });
    expect(result.success).toBe(false);
  });

  it('BS-TV-12: settings.seo.description 301자 실패', () => {
    const result = CreateTenantSchema.safeParse({
      ...validData,
      settings: { seo: { description: 'a'.repeat(301) } },
    });
    expect(result.success).toBe(false);
  });

  it('BS-TV-13: settings.theme.logo 유효하지 않은 URL 실패', () => {
    const result = CreateTenantSchema.safeParse({
      ...validData,
      settings: { theme: { logo: 'invalid-url' } },
    });
    expect(result.success).toBe(false);
  });

  it('BS-TV-14: settings.blogConfig 임의 객체 통과 (passthrough)', () => {
    const result = CreateTenantSchema.safeParse({
      ...validData,
      settings: { blogConfig: { custom: 'value', nested: { key: 123 } } },
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateTenantSchema', () => {
  it('BS-TV-15: 빈 객체 통과 (모두 optional)', () => {
    const result = UpdateTenantSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('BS-TV-16: slug만 변경 가능', () => {
    const result = UpdateTenantSchema.safeParse({ slug: 'new-slug' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe('new-slug');
    }
  });

  it('BS-TV-17: customDomain 형식이 틀리면 실패하고, 올바른 도메인은 통과한다', () => {
    expect(UpdateTenantSchema.safeParse({ customDomain: '' }).success).toBe(false);
    expect(UpdateTenantSchema.safeParse({ customDomain: 'invalid domain!!!' }).success).toBe(false);
    expect(UpdateTenantSchema.safeParse({ customDomain: 'localhost' }).success).toBe(false);
    expect(UpdateTenantSchema.safeParse({ customDomain: 'blog.custom.com' }).success).toBe(true);
  });

  it('BS-TV-18: 스키마에 없는 필드(settings 등)는 결과에서 제거된다', () => {
    const result = UpdateTenantSchema.safeParse({
      name: '새 이름',
      settings: { domainVerification: { status: 'verified' } },
      createdAt: '2020-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: '새 이름' });
    }
  });
});
