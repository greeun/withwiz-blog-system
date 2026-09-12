'use client';

import React, { useState, useCallback } from 'react';
import type { OnboardingResult } from './onboarding-service';

interface OnboardingWizardProps {
  apiBasePath: string;
  onComplete: (result: OnboardingResult) => void;
}

const DEFAULT_CATEGORY_OPTIONS = [
  { key: 'general', label: '일반' },
  { key: 'notice', label: '공지사항' },
  { key: 'tech', label: '기술' },
  { key: 'design', label: '디자인' },
  { key: 'marketing', label: '마케팅' },
  { key: 'news', label: '뉴스' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function OnboardingWizard({
  apiBasePath,
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(1);

  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<
    Array<{ key: string; label: string }>
  >([DEFAULT_CATEGORY_OPTIONS[0], DEFAULT_CATEGORY_OPTIONS[1]]);
  const [customCategoryKey, setCustomCategoryKey] = useState('');
  const [customCategoryLabel, setCustomCategoryLabel] = useState('');
  const [createSamplePost, setCreateSamplePost] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value;
      setTenantName(name);
      if (!slugManuallyEdited) {
        setTenantSlug(generateSlug(name));
      }
    },
    [slugManuallyEdited],
  );

  const handleSlugChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTenantSlug(e.target.value);
      setSlugManuallyEdited(true);
    },
    [],
  );

  const toggleCategory = useCallback(
    (cat: { key: string; label: string }) => {
      setSelectedCategories((prev) => {
        const exists = prev.find((c) => c.key === cat.key);
        if (exists) {
          return prev.filter((c) => c.key !== cat.key);
        }
        return [...prev, cat];
      });
    },
    [],
  );

  const addCustomCategory = useCallback(() => {
    if (!customCategoryKey || !customCategoryLabel) return;
    const newCat = { key: customCategoryKey, label: customCategoryLabel };
    setSelectedCategories((prev) => [...prev, newCat]);
    setCustomCategoryKey('');
    setCustomCategoryLabel('');
  }, [customCategoryKey, customCategoryLabel]);

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const goPrev = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBasePath}/admin/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tenantName,
          tenantSlug,
          ownerUserId: '', // 서버에서 현재 사용자로 설정
          categories: selectedCategories,
          createSamplePost,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error?.message || '온보딩에 실패했습니다.');
        return;
      }

      onComplete(data.data);
    } catch {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    apiBasePath,
    tenantName,
    tenantSlug,
    selectedCategories,
    createSamplePost,
    onComplete,
  ]);

  return (
    <div className="blog-system-admin-onboarding">
      <div className="blog-system-admin-onboarding-steps">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`blog-system-admin-onboarding-step ${s === step ? 'active' : ''} ${s < step ? 'completed' : ''}`}
          >
            <span className="blog-system-admin-onboarding-step-number">
              {s}
            </span>
            <span className="blog-system-admin-onboarding-step-label">
              {s === 1
                ? '기본 정보'
                : s === 2
                  ? '카테고리'
                  : s === 3
                    ? '샘플 게시글'
                    : '확인'}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="blog-system-admin-alert blog-system-admin-alert-error">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="blog-system-admin-onboarding-content">
          <h3>블로그 기본 정보</h3>
          <p>블로그의 이름과 URL 슬러그를 입력해 주세요.</p>

          <div className="blog-system-admin-form-group">
            <label htmlFor="tenant-name">블로그 이름</label>
            <input
              id="tenant-name"
              type="text"
              value={tenantName}
              onChange={handleNameChange}
              placeholder="예: 나의 기술 블로그"
              className="blog-system-admin-input"
            />
          </div>

          <div className="blog-system-admin-form-group">
            <label htmlFor="tenant-slug">URL 슬러그</label>
            <input
              id="tenant-slug"
              type="text"
              value={tenantSlug}
              onChange={handleSlugChange}
              placeholder="예: my-tech-blog"
              className="blog-system-admin-input"
            />
            <small>블로그 URL에 사용됩니다: /{tenantSlug || '...'}</small>
          </div>

          <div className="blog-system-admin-onboarding-actions">
            <button
              onClick={goNext}
              disabled={!tenantName || !tenantSlug}
              className="blog-system-admin-btn blog-system-admin-btn-primary"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="blog-system-admin-onboarding-content">
          <h3>카테고리 설정</h3>
          <p>블로그에서 사용할 카테고리를 선택하세요.</p>

          <div className="blog-system-admin-category-grid">
            {DEFAULT_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.key}
                onClick={() => toggleCategory(cat)}
                className={`blog-system-admin-category-chip ${
                  selectedCategories.find((c) => c.key === cat.key)
                    ? 'selected'
                    : ''
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="blog-system-admin-form-row">
            <input
              type="text"
              value={customCategoryKey}
              onChange={(e) => setCustomCategoryKey(e.target.value)}
              placeholder="키 (영문)"
              className="blog-system-admin-input"
            />
            <input
              type="text"
              value={customCategoryLabel}
              onChange={(e) => setCustomCategoryLabel(e.target.value)}
              placeholder="표시 이름"
              className="blog-system-admin-input"
            />
            <button
              onClick={addCustomCategory}
              disabled={!customCategoryKey || !customCategoryLabel}
              className="blog-system-admin-btn blog-system-admin-btn-secondary"
            >
              추가
            </button>
          </div>

          <div className="blog-system-admin-onboarding-actions">
            <button
              onClick={goPrev}
              className="blog-system-admin-btn blog-system-admin-btn-secondary"
            >
              이전
            </button>
            <button
              onClick={goNext}
              disabled={selectedCategories.length === 0}
              className="blog-system-admin-btn blog-system-admin-btn-primary"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="blog-system-admin-onboarding-content">
          <h3>샘플 게시글</h3>
          <p>환영 게시글을 자동으로 생성할까요?</p>

          <div className="blog-system-admin-form-group">
            <label className="blog-system-admin-checkbox-label">
              <input
                type="checkbox"
                checked={createSamplePost}
                onChange={(e) => setCreateSamplePost(e.target.checked)}
              />
              샘플 환영 게시글 생성
            </label>
            <small>
              블로그에 첫 번째 게시글이 자동으로 작성됩니다.
              나중에 수정하거나 삭제할 수 있습니다.
            </small>
          </div>

          <div className="blog-system-admin-onboarding-actions">
            <button
              onClick={goPrev}
              className="blog-system-admin-btn blog-system-admin-btn-secondary"
            >
              이전
            </button>
            <button
              onClick={goNext}
              className="blog-system-admin-btn blog-system-admin-btn-primary"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="blog-system-admin-onboarding-content">
          <h3>확인</h3>
          <p>아래 내용으로 블로그를 생성합니다.</p>

          <div className="blog-system-admin-summary">
            <div className="blog-system-admin-summary-item">
              <strong>이름:</strong> {tenantName}
            </div>
            <div className="blog-system-admin-summary-item">
              <strong>슬러그:</strong> {tenantSlug}
            </div>
            <div className="blog-system-admin-summary-item">
              <strong>카테고리:</strong>{' '}
              {selectedCategories.map((c) => c.label).join(', ')}
            </div>
            <div className="blog-system-admin-summary-item">
              <strong>샘플 게시글:</strong>{' '}
              {createSamplePost ? '생성' : '생성 안 함'}
            </div>
          </div>

          <div className="blog-system-admin-onboarding-actions">
            <button
              onClick={goPrev}
              disabled={isSubmitting}
              className="blog-system-admin-btn blog-system-admin-btn-secondary"
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="blog-system-admin-btn blog-system-admin-btn-primary"
            >
              {isSubmitting ? '생성 중...' : '블로그 생성'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
