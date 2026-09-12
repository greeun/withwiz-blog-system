import type { BlogConfig } from '@withwiz/blog-core/types';

export enum TenantRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logo: string | null;
  settings: Record<string, unknown>;
  planId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantUser {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  createdAt: Date;
}

/** JSON settings 컬럼에 저장되는 테넌트별 설정 */
export interface TenantSettings {
  blogConfig: Partial<BlogConfig>;
  theme?: {
    primaryColor?: string;
    logo?: string;
    favicon?: string;
  };
  seo?: {
    siteName?: string;
    description?: string;
    ogImage?: string;
  };
  domainVerification?: TenantDomainVerificationData;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  logo?: string;
  planId?: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantInput {
  name?: string;
  slug?: string;
  logo?: string;
  customDomain?: string;
  planId?: string;
  isActive?: boolean;
}

export type DomainVerificationStatus = 'pending' | 'verified' | 'failed';

export type DomainSslStatus = 'pending' | 'active' | 'error';

export interface DomainVerificationRecord {
  type: 'CNAME' | 'TXT';
  /** 예: "_withwiz-verify.blog.example.com" */
  name: string;
  /** 예: "verify-abc123.withwiz.com" */
  value: string;
}

export interface DomainVerification {
  domain: string;
  tenantId: string;
  status: DomainVerificationStatus;
  verificationRecord: DomainVerificationRecord;
  sslStatus: DomainSslStatus;
  verifiedAt?: Date;
  createdAt: Date;
}

export interface DomainInfo {
  domain: string;
  tenantId: string;
  tenantName: string;
  status: DomainVerificationStatus;
  sslStatus: DomainSslStatus;
  createdAt: Date;
}

/** 테넌트 settings JSON에 저장되는 도메인 인증 데이터 */
export interface TenantDomainVerificationData {
  token: string;
  status: DomainVerificationStatus;
  sslStatus: DomainSslStatus;
  /** ISO 문자열 */
  verifiedAt?: string;
  /** ISO 문자열 */
  createdAt: string;
}
