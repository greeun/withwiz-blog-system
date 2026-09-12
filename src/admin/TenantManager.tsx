'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface TenantManagerProps {
  apiBasePath: string;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  planId: string | null;
}

interface TenantDetail extends TenantItem {
  customDomain: string | null;
  logo: string | null;
  settings: Record<string, unknown>;
}

interface TenantDetailView {
  tenant: TenantDetail;
  users: Array<{
    id: string;
    userId: string;
    role: string;
    user: { id: string; email: string; name: string | null };
  }>;
  userCount: number;
}

type ViewMode = 'list' | 'detail' | 'create';

export function TenantManager({ apiBasePath }: TenantManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetailView | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(
        `${apiBasePath}/admin/tenants?${params.toString()}`,
        { credentials: 'include' },
      );
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || '목록 로드에 실패했습니다.');
        return;
      }

      setTenants(result.data.items || []);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, search, statusFilter]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const viewDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBasePath}/admin/tenants/${id}`, {
          credentials: 'include',
        });
        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message || '상세 조회에 실패했습니다.');
          return;
        }

        setSelectedTenant(result.data);
        setViewMode('detail');
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [apiBasePath],
  );

  const handleCreate = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch(`${apiBasePath}/admin/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: formName, slug: formSlug }),
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || '생성에 실패했습니다.');
        return;
      }

      setFormName('');
      setFormSlug('');
      setViewMode('list');
      loadTenants();
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    }
  }, [apiBasePath, formName, formSlug, loadTenants]);

  const toggleActive = useCallback(
    async (id: string, currentActive: boolean) => {
      setError(null);

      try {
        if (currentActive) {
          await fetch(`${apiBasePath}/admin/tenants/${id}/deactivate`, {
            method: 'PATCH',
            credentials: 'include',
          });
        } else {
          await fetch(`${apiBasePath}/admin/tenants/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ isActive: true }),
          });
        }

        loadTenants();
      } catch {
        setError('상태 변경에 실패했습니다.');
      }
    },
    [apiBasePath, loadTenants],
  );

  const errorBanner = error ? (
    <div className="blog-system-admin-alert blog-system-admin-alert-error">
      {error}
    </div>
  ) : null;

  if (viewMode === 'create') {
    return (
      <div className="blog-system-admin-tenant-manager">
        <h2>테넌트 생성</h2>
        {errorBanner}

        <div className="blog-system-admin-form-group">
          <label htmlFor="create-name">이름</label>
          <input
            id="create-name"
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="테넌트 이름"
            className="blog-system-admin-input"
          />
        </div>

        <div className="blog-system-admin-form-group">
          <label htmlFor="create-slug">슬러그</label>
          <input
            id="create-slug"
            type="text"
            value={formSlug}
            onChange={(e) => setFormSlug(e.target.value)}
            placeholder="url-slug"
            className="blog-system-admin-input"
          />
        </div>

        <div className="blog-system-admin-actions">
          <button
            onClick={() => setViewMode('list')}
            className="blog-system-admin-btn blog-system-admin-btn-secondary"
          >
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={!formName || !formSlug}
            className="blog-system-admin-btn blog-system-admin-btn-primary"
          >
            생성
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedTenant) {
    const { tenant, users, userCount } = selectedTenant;

    return (
      <div className="blog-system-admin-tenant-manager">
        <div className="blog-system-admin-header">
          <h2>{tenant.name}</h2>
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedTenant(null);
            }}
            className="blog-system-admin-btn blog-system-admin-btn-secondary"
          >
            목록으로
          </button>
        </div>
        {errorBanner}

        <div className="blog-system-admin-detail-grid">
          <div className="blog-system-admin-detail-item">
            <strong>슬러그:</strong> {tenant.slug}
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>상태:</strong>{' '}
            <span
              className={`blog-system-admin-badge ${tenant.isActive ? 'blog-system-admin-badge-success' : 'blog-system-admin-badge-danger'}`}
            >
              {tenant.isActive ? '활성' : '비활성'}
            </span>
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>커스텀 도메인:</strong>{' '}
            {tenant.customDomain || '없음'}
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>등록일:</strong>{' '}
            {new Date(tenant.createdAt).toLocaleDateString('ko-KR')}
          </div>
        </div>

        <div className="blog-system-admin-section">
          <h3>소속 사용자 ({userCount}명)</h3>
          {users.length === 0 ? (
            <p className="blog-system-admin-empty">소속된 사용자가 없습니다.</p>
          ) : (
            <table className="blog-system-admin-table">
              <thead>
                <tr>
                  <th>이메일</th>
                  <th>이름</th>
                  <th>역할</th>
                </tr>
              </thead>
              <tbody>
                {users.map((tu) => (
                  <tr key={tu.id}>
                    <td>{tu.user.email}</td>
                    <td>{tu.user.name || '-'}</td>
                    <td>{tu.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="blog-system-admin-tenant-manager">
      <div className="blog-system-admin-header">
        <h2>테넌트 관리</h2>
        <button
          onClick={() => setViewMode('create')}
          className="blog-system-admin-btn blog-system-admin-btn-primary"
        >
          새 테넌트
        </button>
      </div>
      {errorBanner}

      <div className="blog-system-admin-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름 또는 슬러그 검색..."
          className="blog-system-admin-input"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
          }
          className="blog-system-admin-select"
        >
          <option value="all">전체</option>
          <option value="active">활성</option>
          <option value="inactive">비활성</option>
        </select>
      </div>

      {loading ? (
        <div className="blog-system-admin-loading">불러오는 중...</div>
      ) : tenants.length === 0 ? (
        <p className="blog-system-admin-empty">테넌트가 없습니다.</p>
      ) : (
        <table className="blog-system-admin-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>슬러그</th>
              <th>상태</th>
              <th>등록일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
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
                <td>
                  <div className="blog-system-admin-actions">
                    <button
                      onClick={() => viewDetail(tenant.id)}
                      className="blog-system-admin-btn blog-system-admin-btn-small"
                    >
                      상세
                    </button>
                    <button
                      onClick={() =>
                        toggleActive(tenant.id, tenant.isActive)
                      }
                      className="blog-system-admin-btn blog-system-admin-btn-small blog-system-admin-btn-secondary"
                    >
                      {tenant.isActive ? '비활성화' : '활성화'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
