import { Brand, GroupedVault, VaultItem, Draft, Finding, ApiConnectionStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Operational timing constants
export const HEALTH_TIMEOUT_MS = 70000;      // 70 seconds: Render free-tier cold start window
export const RETRY_INTERVAL_MS = 10000;      // 10 seconds: delay between health retry attempts
export const MAX_RETRY_DURATION_MS = 90000;  // 90 seconds: maximum total retry window before falling back to local demo mode

/**
 * Classifies a fetch failure to distinguish browser-blocked calls (ad blocker / Brave Shield),
 * CORS misconfigurations, cold-start timeouts, and network offline conditions.
 */
export function classifyFetchError(err: any, elapsedMs: number): ApiConnectionStatus {
  const msg = (err?.message || '').toLowerCase();
  const name = err?.name || '';

  // 1. Direct or message match for browser extension block
  if (
    msg.includes('err_blocked_by_client') ||
    msg.includes('blocked_by_client') ||
    msg.includes('blocked by client') ||
    msg.includes('extension')
  ) {
    return 'blocked_by_client';
  }

  // 2. CORS error match
  if (
    msg.includes('cors') ||
    msg.includes('cross-origin') ||
    msg.includes('access-control')
  ) {
    return 'cors_error';
  }

  // 3. Abort / timeout match
  if (name === 'AbortError' || elapsedMs >= HEALTH_TIMEOUT_MS) {
    return 'waking';
  }

  // 4. Browser extension / Shield instant rejection heuristic:
  // When an ad blocker or Brave Shield blocks a cross-origin call at the network layer,
  // the browser immediately rejects the promise (typically in < 250ms) with a generic
  // TypeError: "Failed to fetch" while the workstation is online.
  if (
    elapsedMs < 250 &&
    typeof navigator !== 'undefined' &&
    navigator.onLine
  ) {
    return 'blocked_by_client';
  }

  return 'waking';
}

class ApiClient {
  private base: string;
  private token: string | null = null;

  constructor() {
    this.base = API_BASE.replace(/\/+$/, '');
  }

  getBaseUrl(): string {
    return this.base;
  }

  setAuthToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Health check with 70s timeout, 10s retry cadence, and up to 90s total retry duration.
   * Reports live state transitions ('waking', 'blocked_by_client', 'cors_error', 'connected', 'offline')
   * and logs strictly safe diagnostic fields (URL, failure type, retry count) to console.
   */
  async checkHealth(
    onStatusChange?: (status: ApiConnectionStatus) => void
  ): Promise<ApiConnectionStatus> {
    const startTime = Date.now();
    let retryCount = 0;
    let lastFailureType: ApiConnectionStatus = 'waking';

    while (Date.now() - startTime < MAX_RETRY_DURATION_MS) {
      retryCount++;
      const reqStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const res = await fetch(`${this.base}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          console.info(
            `[BrandGate Health] URL: ${this.base}/health | Status: Connected | Retries: ${retryCount}`
          );
          if (onStatusChange) onStatusChange('connected');
          return 'connected';
        }

        lastFailureType = 'waking';
        console.warn(
          `[BrandGate Health] URL: ${this.base}/health | Failure: HTTP ${res.status} | Retry: ${retryCount}`
        );
      } catch (err: any) {
        clearTimeout(timeoutId);
        const elapsed = Date.now() - reqStart;
        lastFailureType = classifyFetchError(err, elapsed);

        console.warn(
          `[BrandGate Health] URL: ${this.base}/health | Failure: ${lastFailureType} | Retry: ${retryCount}`
        );

        // If explicitly blocked by client extension, signal immediately so user can see actionable guidance
        if (lastFailureType === 'blocked_by_client') {
          if (onStatusChange) onStatusChange('blocked_by_client');
          return 'blocked_by_client';
        }

        // If explicit CORS error, surface actionable guidance
        if (lastFailureType === 'cors_error') {
          if (onStatusChange) onStatusChange('cors_error');
          return 'cors_error';
        }
      }

      // Check if we still have time to retry within the 90s window
      const totalElapsed = Date.now() - startTime;
      if (totalElapsed + RETRY_INTERVAL_MS >= MAX_RETRY_DURATION_MS) {
        break;
      }

      // Indicate waking state during ongoing retries
      if (onStatusChange) onStatusChange('waking');
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }

    // After 90 seconds of failed retries, conclude with offline local demo mode
    const finalStatus: ApiConnectionStatus = 'offline';


    console.warn(
      `[BrandGate Health] URL: ${this.base}/health | Failure: ${finalStatus} | Total Elapsed: ${Math.round((Date.now() - startTime) / 1000)}s`
    );
    if (onStatusChange) onStatusChange(finalStatus);
    return finalStatus;
  }


  // Brands
  async getBrands(): Promise<Brand[]> {
    const res = await fetch(`${this.base}/api/brands`);
    if (!res.ok) throw new Error('Failed to fetch brands');
    return res.json();
  }

  // Vault
  async getVault(brandId: string): Promise<GroupedVault> {
    const res = await fetch(`${this.base}/api/brands/${brandId}/vault`);
    if (!res.ok) throw new Error('Failed to fetch vault items');
    return res.json();
  }

  async createVaultItem(brandId: string, item: Omit<VaultItem, 'id' | 'brand_id'>): Promise<VaultItem> {
    const res = await fetch(`${this.base}/api/brands/${brandId}/vault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create vault item');
    }
    return res.json();
  }

  async updateVaultItem(brandId: string, itemId: string, payload: Partial<VaultItem>): Promise<VaultItem> {
    const res = await fetch(`${this.base}/api/brands/${brandId}/vault/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to update vault item');
    }
    return res.json();
  }

  async deleteVaultItem(brandId: string, itemId: string): Promise<void> {
    const res = await fetch(`${this.base}/api/brands/${brandId}/vault/${itemId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete vault item');
  }

  async resetDemoVault(brandId: string): Promise<{ status: string; restored_count: number }> {
    const res = await fetch(`${this.base}/api/brands/${brandId}/vault/reset-demo`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to reset demo vault');
    return res.json();
  }

  // Drafts
  async createDraft(payload: {
    brand_id: string;
    title: string;
    body_text: string;
    alt_text?: string | null;
    image_url?: string | null;
    created_by_role?: 'creator' | 'reviewer' | 'guest';
  }): Promise<Draft> {
    const res = await fetch(`${this.base}/api/drafts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create draft');
    }
    return res.json();
  }

  async getDraft(draftId: string): Promise<Draft> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch draft');
    return res.json();
  }

  async reviewDraft(draftId: string, options?: { logo_confirmed?: boolean; palette_off?: boolean; contrast_ratio?: number }): Promise<{
    findings: Finding[];
    llm_review?: any;
  }> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/review`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to review draft');
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return { findings: data };
    }
    return {
      findings: data.findings || data.deterministic_findings || [],
      llm_review: data.llm_review,
    };
  }


  async applyFix(draftId: string, findingId: string): Promise<{
    draft_id: string;
    version_no: number;
    body_text: string;
    status: string;
  }> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/apply-fix`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ finding_id: findingId }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to apply fix');
    }
    return res.json();
  }

  async reviseDraft(draftId: string, payload: { body_text: string; alt_text?: string | null }): Promise<Draft> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/revise`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to revise draft');
    }
    return res.json();
  }

  // Phase 5 Approval Workflow Methods
  async requestApproval(draftId: string, comment?: string, role: string = 'creator'): Promise<any> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/request-approval`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ comment, role }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to request approval');
    }
    return res.json();
  }

  async approveDraft(draftId: string, comment?: string, role: string = 'demo_reviewer'): Promise<any> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ comment, role }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Approval failed');
    }
    return res.json();
  }

  async requestChanges(draftId: string, comment: string): Promise<any> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/request-changes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to request changes');
    }
    return res.json();
  }

  async addComment(draftId: string, text: string, role: string = 'guest'): Promise<any> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/comments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ text, role }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to add comment');
    }
    return res.json();
  }

  // Phase 6 Image and Insights Endpoints
  async attachImage(draftId: string, payload: { image_url: string; alt_text?: string | null; logo_confirmed?: boolean }): Promise<any> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/image`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to attach image');
    }
    return res.json();
  }

  async getInsights(brandId?: string): Promise<{
    total_findings: number;
    counts_by_citation: Record<string, number>;
    counts_by_lane: Record<string, number>;
  }> {
    const url = brandId ? `${this.base}/api/insights?brand_id=${brandId}` : `${this.base}/api/insights`;
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) {
      throw new Error('Failed to fetch insights data');
    }
    return res.json();
  }
}

export const api = new ApiClient();

