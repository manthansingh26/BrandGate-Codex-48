import { Brand, GroupedVault, VaultItem, Draft, Finding, ApiConnectionStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class ApiClient {
  private base: string;

  constructor() {
    this.base = API_BASE.replace(/\/+$/, '');
  }

  // Health check with timeout
  async checkHealth(): Promise<ApiConnectionStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${this.base}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return 'connected';
      }
      return 'waking';
    } catch (err) {
      return 'offline';
    }
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create draft');
    }
    return res.json();
  }

  async getDraft(draftId: string): Promise<Draft> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}`);
    if (!res.ok) throw new Error('Failed to fetch draft');
    return res.json();
  }

  async reviewDraft(draftId: string): Promise<Finding[]> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/review`, {
      method: 'POST',
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to review draft');
    }
    return res.json();
  }

  async applyFix(draftId: string, findingId: string): Promise<{
    draft_id: string;
    version_no: number;
    body_text: string;
    status: string;
  }> {
    const res = await fetch(`${this.base}/api/drafts/${draftId}/apply-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to revise draft');
    }
    return res.json();
  }
}

export const api = new ApiClient();
