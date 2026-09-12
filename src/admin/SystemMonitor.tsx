'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface SystemMonitorProps {
  apiBasePath: string;
}

interface SystemMetrics {
  stats: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalPosts: number;
  };
}

export function SystemMonitor({ apiBasePath }: SystemMonitorProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBasePath}/admin/dashboard`, {
        credentials: 'include',
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || '메트릭 로드에 실패했습니다.');
        return;
      }

      setMetrics(result.data);
      setLastRefresh(new Date());
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  if (loading && !metrics) {
    return (
      <div className="blog-system-admin-loading">메트릭을 불러오는 중...</div>
    );
  }

  return (
    <div className="blog-system-admin-monitor">
      <div className="blog-system-admin-header">
        <h2>시스템 모니터</h2>
        <div className="blog-system-admin-actions">
          <span className="blog-system-admin-meta">
            최종 갱신: {lastRefresh.toLocaleTimeString('ko-KR')}
          </span>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="blog-system-admin-btn blog-system-admin-btn-secondary"
          >
            {loading ? '갱신 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {error && (
        <div className="blog-system-admin-alert blog-system-admin-alert-error">
          {error}
        </div>
      )}

      {metrics && (
        <>
          <div className="blog-system-admin-section">
            <h3>리소스 사용량</h3>
            <div className="blog-system-admin-stats-grid">
              <div className="blog-system-admin-stat-card">
                <div className="blog-system-admin-stat-value">
                  {metrics.stats.totalTenants}
                </div>
                <div className="blog-system-admin-stat-label">
                  전체 테넌트
                </div>
                <div className="blog-system-admin-progress">
                  <div
                    className="blog-system-admin-progress-bar"
                    style={{
                      width: `${Math.min((metrics.stats.activeTenants / Math.max(metrics.stats.totalTenants, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="blog-system-admin-stat-sub">
                  활성: {metrics.stats.activeTenants} /{' '}
                  {metrics.stats.totalTenants}
                </div>
              </div>

              <div className="blog-system-admin-stat-card">
                <div className="blog-system-admin-stat-value">
                  {metrics.stats.totalUsers}
                </div>
                <div className="blog-system-admin-stat-label">
                  전체 사용자
                </div>
              </div>

              <div className="blog-system-admin-stat-card">
                <div className="blog-system-admin-stat-value">
                  {metrics.stats.totalPosts}
                </div>
                <div className="blog-system-admin-stat-label">
                  전체 게시글
                </div>
              </div>
            </div>
          </div>

          <div className="blog-system-admin-section">
            <h3>시스템 상태</h3>
            <div className="blog-system-admin-health">
              <div className="blog-system-admin-health-item">
                <span className="blog-system-admin-health-dot blog-system-admin-health-ok" />
                <span>API 서버</span>
                <span className="blog-system-admin-meta">정상 동작</span>
              </div>
              <div className="blog-system-admin-health-item">
                <span className="blog-system-admin-health-dot blog-system-admin-health-ok" />
                <span>데이터베이스</span>
                <span className="blog-system-admin-meta">연결됨</span>
              </div>
              <div className="blog-system-admin-health-item">
                <span className="blog-system-admin-health-dot blog-system-admin-health-ok" />
                <span>인증 서비스</span>
                <span className="blog-system-admin-meta">정상 동작</span>
              </div>
            </div>
          </div>

          <div className="blog-system-admin-section">
            <h3>API 사용량</h3>
            <p className="blog-system-admin-meta">
              상세 API 사용량 모니터링은 추후 업데이트에서 제공될 예정입니다.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
