'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface UserManagerProps {
  apiBasePath: string;
}

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserDetailData {
  user: UserItem;
  memberships: Array<{
    tenant: { id: string; name: string; slug: string };
    role: string;
  }>;
}

type ViewMode = 'list' | 'detail';

export function UserManager({ apiBasePath }: UserManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const response = await fetch(
        `${apiBasePath}/admin/users?${params.toString()}`,
        { credentials: 'include' },
      );
      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message || '목록 로드에 실패했습니다.');
        return;
      }

      setUsers(result.data.items || []);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const viewDetail = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBasePath}/admin/users/${id}`, {
          credentials: 'include',
        });
        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message || '상세 조회에 실패했습니다.');
          return;
        }

        setSelectedUser(result.data);
        setViewMode('detail');
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [apiBasePath],
  );

  const updateSystemRole = useCallback(
    async (userId: string, newRole: string) => {
      setError(null);

      try {
        const response = await fetch(
          `${apiBasePath}/admin/users/${userId}/role`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role: newRole }),
          },
        );
        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message || '역할 변경에 실패했습니다.');
          return;
        }

        loadUsers();
        if (selectedUser && selectedUser.user.id === userId) {
          viewDetail(userId);
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      }
    },
    [apiBasePath, loadUsers, selectedUser, viewDetail],
  );

  const deactivateUser = useCallback(
    async (userId: string) => {
      setError(null);

      try {
        const response = await fetch(
          `${apiBasePath}/admin/users/${userId}/deactivate`,
          {
            method: 'PATCH',
            credentials: 'include',
          },
        );
        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message || '비활성화에 실패했습니다.');
          return;
        }

        loadUsers();
        if (viewMode === 'detail') {
          setViewMode('list');
          setSelectedUser(null);
        }
      } catch {
        setError('네트워크 오류가 발생했습니다.');
      }
    },
    [apiBasePath, loadUsers, viewMode],
  );

  const errorBanner = error ? (
    <div className="blog-system-admin-alert blog-system-admin-alert-error">
      {error}
    </div>
  ) : null;

  if (viewMode === 'detail' && selectedUser) {
    const { user, memberships } = selectedUser;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    return (
      <div className="blog-system-admin-user-manager">
        <div className="blog-system-admin-header">
          <h2>사용자 상세</h2>
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedUser(null);
            }}
            className="blog-system-admin-btn blog-system-admin-btn-secondary"
          >
            목록으로
          </button>
        </div>
        {errorBanner}

        <div className="blog-system-admin-detail-grid">
          <div className="blog-system-admin-detail-item">
            <strong>이메일:</strong> {user.email}
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>이름:</strong> {user.name || '-'}
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>시스템 역할:</strong>{' '}
            <span
              className={`blog-system-admin-badge ${isSuperAdmin ? 'blog-system-admin-badge-warning' : 'blog-system-admin-badge-default'}`}
            >
              {user.role}
            </span>
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>상태:</strong>{' '}
            <span
              className={`blog-system-admin-badge ${user.isActive ? 'blog-system-admin-badge-success' : 'blog-system-admin-badge-danger'}`}
            >
              {user.isActive ? '활성' : '비활성'}
            </span>
          </div>
          <div className="blog-system-admin-detail-item">
            <strong>가입일:</strong>{' '}
            {new Date(user.createdAt).toLocaleDateString('ko-KR')}
          </div>
        </div>

        <div className="blog-system-admin-section">
          <h3>역할 관리</h3>
          <div className="blog-system-admin-actions">
            <button
              onClick={() =>
                updateSystemRole(
                  user.id,
                  isSuperAdmin ? 'USER' : 'SUPER_ADMIN',
                )
              }
              className="blog-system-admin-btn blog-system-admin-btn-secondary"
            >
              {isSuperAdmin ? 'USER로 변경' : 'SUPER_ADMIN으로 변경'}
            </button>
            {user.isActive && (
              <button
                onClick={() => deactivateUser(user.id)}
                className="blog-system-admin-btn blog-system-admin-btn-danger"
              >
                비활성화
              </button>
            )}
          </div>
        </div>

        <div className="blog-system-admin-section">
          <h3>테넌트 멤버십</h3>
          {memberships.length === 0 ? (
            <p className="blog-system-admin-empty">
              소속된 테넌트가 없습니다.
            </p>
          ) : (
            <table className="blog-system-admin-table">
              <thead>
                <tr>
                  <th>테넌트</th>
                  <th>슬러그</th>
                  <th>역할</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.tenant.id}>
                    <td>{m.tenant.name}</td>
                    <td>{m.tenant.slug}</td>
                    <td>{m.role}</td>
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
    <div className="blog-system-admin-user-manager">
      <h2>사용자 관리</h2>
      {errorBanner}

      <div className="blog-system-admin-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일 또는 이름 검색..."
          className="blog-system-admin-input"
        />
      </div>

      {loading ? (
        <div className="blog-system-admin-loading">불러오는 중...</div>
      ) : users.length === 0 ? (
        <p className="blog-system-admin-empty">사용자가 없습니다.</p>
      ) : (
        <table className="blog-system-admin-table">
          <thead>
            <tr>
              <th>이메일</th>
              <th>이름</th>
              <th>역할</th>
              <th>상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.name || '-'}</td>
                <td>
                  <span
                    className={`blog-system-admin-badge ${user.role === 'SUPER_ADMIN' ? 'blog-system-admin-badge-warning' : 'blog-system-admin-badge-default'}`}
                  >
                    {user.role}
                  </span>
                </td>
                <td>
                  <span
                    className={`blog-system-admin-badge ${user.isActive ? 'blog-system-admin-badge-success' : 'blog-system-admin-badge-danger'}`}
                  >
                    {user.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => viewDetail(user.id)}
                    className="blog-system-admin-btn blog-system-admin-btn-small"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
