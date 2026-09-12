'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface SuperAdminDashboardProps {
  apiBasePath: string;
}

interface DashboardData {
  stats: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalPosts: number;
  };
  recentTenants: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    createdAt: string;
  }>;
}

export function SuperAdminDashboard({ apiBasePath }: SuperAdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBasePath}/admin/dashboard`, {
        credentials: 'include',
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || '데이터 로드에 실패했습니다.');
        return;
      }

      setData(result.data);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="blog-system-admin-loading">데이터를 불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="blog-system-admin-alert blog-system-admin-alert-error">
        {error}
        <button onClick={loadData} className="blog-system-admin-btn blog-system-admin-btn-secondary">
          재시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="blog-system-admin-dashboard">
      <h2>시스템 대시보드</h2>

      <div className="blog-system-admin-stats-grid">
        <div className="blog-system-admin-stat-card">
          <div className="blog-system-admin-stat-value">
            {data.stats.totalTenants}
          </div>
          <div className="blog-system-admin-stat-label">전체 테넌트</div>
        </div>

        <div className="blog-system-admin-stat-card">
          <div className="blog-system-admin-stat-value">
            {data.stats.activeTenants}
          </div>
          <div className="blog-system-admin-stat-label">활성 테넌트</div>
        </div>

        <div className="blog-system-admin-stat-card">
          <div className="blog-system-admin-stat-value">
            {data.stats.totalUsers}
          </div>
          <div className="blog-system-admin-stat-label">전체 사용자</div>
        </div>

        <div className="blog-system-admin-stat-card">
          <div className="blog-system-admin-stat-value">
            {data.stats.totalPosts}
          </div>
          <div className="blog-system-admin-stat-label">전체 게시글</div>
        </div>
      </div>

      <div className="blog-system-admin-section">
        <h3>최근 등록 테넌트</h3>
        {data.recentTenants.length === 0 ? (
          <p className="blog-system-admin-empty">등록된 테넌트가 없습니다.</p>
        ) : (
          <table className="blog-system-admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>슬러그</th>
                <th>상태</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {data.recentTenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>{tenant.name}</td>
                  <td>{tenant.slug}</td>
                  <td>
                    <span
                      className={`blog-system-admin-badge ${tenant.isActive ? 'blog-system-admin-badge-success' : 'blog-system-admin-badge-danger'}`}
                    >
                      {tenant.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="blog-system-admin-section">
        <h3>시스템 상태</h3>
        <div className="blog-system-admin-health">
          <div className="blog-system-admin-health-item">
            <span className="blog-system-admin-health-dot blog-system-admin-health-ok" />
            <span>API 서버: 정상</span>
          </div>
          <div className="blog-system-admin-health-item">
            <span className="blog-system-admin-health-dot blog-system-admin-health-ok" />
            <span>데이터베이스: 연결됨</span>
          </div>
        </div>
      </div>
    </div>
  );
}
