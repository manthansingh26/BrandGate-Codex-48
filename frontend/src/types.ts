export interface Brand {
  id: string;
  name: string;
  created_by?: string;
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
  brand_id?: string;
  version_no?: number;
  page?: number;
  lane: FindingLane;
  severity: FindingSeverity;
  citation_id: string;
  explanation: string;
  suggested_fix?: string | null;
  created_at?: string;
}

export interface ExtractedImage {
  name: string;
  page_number: number;
  data_url: string;
  sampled_colors: string[];
  is_off_palette: boolean;
}

export interface DocumentPage {
  page_number: number;
  text: string;
}

export interface DocumentParseResult {
  filename: string;
  file_type: 'docx' | 'pdf';
  text: string;
  page_count: number;
  pages: DocumentPage[];
  has_text_layer: boolean;
  honest_limit_notice?: string | null;
  has_images: boolean;
  images: ExtractedImage[];
  images_unextractable: boolean;
  unextractable_reason?: string | null;
  is_off_palette: boolean;
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
  compliance_badge?: string;
  approved_text: string;
  image_reference?: string | null;
  alt_text?: string | null;
  approver_role: string;
  approver_id?: string | null;
  timestamp: string;
  vault_version: string;
  brand_id?: string;
}

export interface ReviseDraftResponse {
  id: string;
  draft_id: string;
  brand_id?: string;
  version_no: number;
  body_text: string;
  alt_text?: string | null;
  status: DraftStatus;
}

export interface TopCitation {
  citation_id: string;
  count: number;
  title: string;
  kind: string;
}

export interface TopViolationType {
  lane: string;
  label: string;
  count: number;
}

export interface InsightsTrend {
  status: 'improving' | 'worsening' | 'stable' | 'no_data';
  description: string;
  recent_draft_findings: number;
  prior_draft_findings: number;
}

export interface DispositionsCount {
  clear_to_publish: number;
  clear_with_edits: number;
  hold_for_legal: number;
}

export interface DraftTimelineItem {
  id: string;
  title: string;
  created_at?: string;
  findings_count: number;
  disposition: 'Clear to Publish' | 'Clear with Edits' | 'Hold for Legal' | 'Pending Review';
  has_contradiction: boolean;
}

export interface InsightsData {
  brand_id?: string;
  brand_name?: string;
  generated_at?: string;
  total_drafts?: number;
  total_findings: number;
  counts_by_citation: Record<string, number>;
  counts_by_lane: Record<string, number>;
  dispositions?: DispositionsCount;
  top_citation?: TopCitation | null;
  top_violation_type?: TopViolationType | null;
  trend?: InsightsTrend;
  fix_first?: string;
  drafts_timeline?: DraftTimelineItem[];
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
  images_unextractable?: boolean | null;
  unextractable_reason?: string | null;
  document_meta?: any;
}


export type ApiConnectionStatus =
  | 'connected'
  | 'waking'
  | 'blocked_by_client'
  | 'cors_error'
  | 'offline';

export type UserRole = 'creator' | 'reviewer';

