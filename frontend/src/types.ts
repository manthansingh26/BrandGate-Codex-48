export interface Brand {
  id: string;
  name: string;
  created_at?: string;
}

export type VaultKind = 'fact' | 'rule' | 'terminology' | 'palette';

export interface VaultItem {
  id?: string;
  brand_id?: string;
  item_id: string;
  kind: VaultKind;
  title: string;
  text: string;
  status: 'active' | 'archived';
  created_at?: string;
}

export interface GroupedVault {
  fact: VaultItem[];
  rule: VaultItem[];
  terminology: VaultItem[];
  palette: VaultItem[];
}

export type DraftStatus = 'draft' | 'checked' | 'pending_approval' | 'approved' | 'needs_changes';
export type FindingLane = 'contradiction' | 'evidence_needed' | 'human_decision';
export type FindingSeverity = 'high' | 'medium' | 'low';

export interface Finding {
  id?: string;
  draft_id?: string;
  version_no?: number;
  lane: FindingLane;
  severity: FindingSeverity;
  citation_id: string;
  explanation: string;
  suggested_fix?: string | null;
  created_at?: string;
}

export interface DraftVersion {
  id?: string;
  draft_id?: string;
  version_no: number;
  body_text: string;
  alt_text?: string | null;
  created_at?: string;
}

export interface Decision {
  id?: string;
  draft_id?: string;
  version_no: number;
  role: string;
  decision: 'approve' | 'request_changes' | 'request_approval' | 'edit' | 're_review';
  comment?: string | null;
  created_at?: string;
}

export interface CommentItem {
  id?: string;
  draft_id?: string;
  version_no: number;
  role: string;
  text: string;
  created_at?: string;
}

export interface ApprovedSnapshot {
  locked: boolean;
  approved_text: string;
  image_reference?: string | null;
  alt_text?: string | null;
  approver_role: string;
  approver_id?: string | null;
  timestamp: string;
  vault_version: string;
}

export interface InsightsData {
  total_findings: number;
  counts_by_citation: Record<string, number>;
  counts_by_lane: Record<string, number>;
}

export interface LlmReviewResult {
  available: boolean;
  status: string;
  reason?: string | null;
  provider?: string;
  model: string;
  retrieved_citation_ids: string[];
  findings: Finding[];
}


export interface Draft {


  id: string;
  brand_id: string;
  title: string;
  body_text: string;
  alt_text?: string | null;
  image_url?: string | null;
  status: DraftStatus;
  current_version: number;
  created_by_role: 'creator' | 'reviewer' | 'guest';
  created_by_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  versions?: DraftVersion[];
  findings?: Finding[];
  comments?: CommentItem[];
  decisions?: Decision[];
  approved_snapshot?: ApprovedSnapshot | null;
}


export type ApiConnectionStatus = 'connected' | 'waking' | 'offline';
export type UserRole = 'creator' | 'reviewer';
