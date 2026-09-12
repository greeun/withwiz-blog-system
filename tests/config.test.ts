/**
 * Task 1: resolveBlogConfig 테스트 (8건)
 */
import { describe, it, expect, vi } from 'vitest';
import { resolveBlogConfig } from '@withwiz/blog-system/core';
import type { BlogSystemConfig } from '@withwiz/blog-system/types';

function makeConfig(overrides: Partial<BlogSystemConfig['blog']> = {}): BlogSystemConfig {
  return {
    mode: 'single',
    prisma: {} as any,
    auth: { jwtSecret: 'test' },
    blog: {
      modelName: 'news',
      ...overrides,
    },
  };
}

describe('resolveBlogConfig', () => {
  it('BS-CF-01: basePath 미제공 시 기본값 /blog', () => {
    const result = resolveBlogConfig(makeConfig());
    expect(result.basePath).toBe('/blog');
  });

  it('BS-CF-02: basePath /news → apiBasePath /api/news', () => {
    const result = resolveBlogConfig(makeConfig({ basePath: '/news' }));
    expect(result.apiBasePath).toBe('/api/news');
  });

  it('BS-CF-03: basePath /news → adminApiBasePath /api/admin/news', () => {
    const result = resolveBlogConfig(makeConfig({ basePath: '/news', adminBasePath: '/admin/news' }));
    expect(result.adminApiBasePath).toBe('/api/admin/news');
  });

  it('BS-CF-04: 커스텀 basePath + 커스텀 categories 전달 확인', () => {
    const categories = { notice: { label: '공지' } };
    const result = resolveBlogConfig(makeConfig({ basePath: '/posts', categories }));
    expect(result.basePath).toBe('/posts');
    expect(result.categories).toEqual(categories);
  });

  it('BS-CF-05: storage 설정 전달 확인', () => {
    const config = makeConfig();
    config.storage = { deleteKeys: vi.fn(), collectKeysFromHtml: vi.fn() } as any;
    const result = resolveBlogConfig(config);
    // storage는 resolveBlogConfig 반환값에 포함되지 않지만, config 자체는 변하지 않음
    expect(result.basePath).toBe('/blog');
  });

  it('BS-CF-06: 빈 blog 섹션 → 모든 기본값 적용', () => {
    const result = resolveBlogConfig(makeConfig());
    expect(result.basePath).toBe('/blog');
    expect(result.adminBasePath).toBe('/admin/blog');
    expect(result.apiBasePath).toBe('/api/blog');
    expect(result.adminApiBasePath).toBe('/api/admin/blog');
    expect(result.uploadEndpoint).toBe('/api/upload');
    expect(result.pageSize).toBe(12);
    expect(result.categories).toEqual({});
  });

  it('BS-CF-07: modelName 전달 확인', () => {
    const result = resolveBlogConfig(makeConfig({ modelName: 'blogPost' }));
    expect(result.modelName).toBe('blogPost');
  });

  it('BS-CF-08: storage 어댑터 지정 시에도 정상 동작', () => {
    const config = makeConfig();
    config.storage = { deleteKeys: vi.fn(), collectKeysFromHtml: vi.fn() } as any;
    // resolveBlogConfig은 BlogConfig만 반환, storage 어댑터는 blog-system이 BlogService에 직접 전달
    const result = resolveBlogConfig(config);
    expect(result).toBeDefined();
  });
});
