/**
 * Task 8: auth-fetch (createAuthFetch) 테스트 (5건)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthFetch } from '@withwiz/blog-system/auth';

describe('createAuthFetch', () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const config = {
    refreshEndpoint: '/api/auth/refresh',
    loginPath: '/admin/login',
  };

  it('BS-AF-01: 정상 200 응답 → 그대로 반환', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
    const authFetch = createAuthFetch(config);
    const response = await authFetch('/api/data');
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('BS-AF-02: 401 + 갱신 성공 → 재시도 → 원래 요청 결과 반환', async () => {
    // 1번째: 원래 요청 → 401
    // 2번째: refresh → 200 (성공)
    // 3번째: 재시도 → 200
    mockFetch
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('OK', { status: 200 })) // refresh
      .mockResolvedValueOnce(new Response('Success', { status: 200 })); // retry

    const authFetch = createAuthFetch(config);
    const response = await authFetch('/api/data');
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('BS-AF-03: 401 + 갱신 실패 → 원본 401 반환', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Fail', { status: 401 })); // refresh fail

    const authFetch = createAuthFetch(config);
    const response = await authFetch('/api/data');
    expect(response.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('BS-AF-04: credentials same-origin 자동 설정', async () => {
    mockFetch.mockResolvedValue(new Response('OK', { status: 200 }));
    const authFetch = createAuthFetch(config);
    await authFetch('/api/data', { method: 'POST' });
    expect(mockFetch).toHaveBeenCalledWith('/api/data', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('BS-AF-05: 비-401 에러 (500) → 그대로 반환', async () => {
    mockFetch.mockResolvedValue(new Response('Error', { status: 500 }));
    const authFetch = createAuthFetch(config);
    const response = await authFetch('/api/data');
    expect(response.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
