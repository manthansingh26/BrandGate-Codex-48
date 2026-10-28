import React, { useState } from 'react';
import { Draft, Finding, UserRole, Decision } from '../types';
import { api } from '../api/client';
import {
  Lock,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  FileCheck,
  ArrowRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface ReviewProps {
  draft: Draft | null;
  findings: Finding[];
  userRole: UserRole;
  onDraftUpdated: (draft: Draft) => void;
  onRoleChange?: (role: UserRole) => void;
  isRestoringDraft?: boolean;
}

export const Review: React.FC<ReviewProps> = ({ draft, findings, userRole, onDraftUpdated, onRoleChange, isRestoringDraft }) => {
  const [commentText, setCommentText] = useState('');
  const [changesComment, setChangesComment] = useState('');
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    if (isRestoringDraft) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-900/80 border border-teal-500/30 text-teal-300 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
            Restoring draft session from BrandGate backend...
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-zinc-400 text-sm">Draft not found — start a new demo draft</p>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({ tab: 'home' }, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          className="btn-primary-micro inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-bold text-xs"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const isApproved = draft.status === 'approved';
  const isPending = draft.status === 'pending_approval';
  const isChecked = draft.status === 'checked';
  const isNeedsChanges = draft.status === 'needs_changes';

  const openFindings = findings.filter(
    (f) => f.lane === 'contradiction' || f.lane === 'evidence_needed'
  );
  const hasOpenFindings = openFindings.length > 0;

  // Request Approval
  const handleRequestApproval = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await api.requestApproval(draft.id, 'Submitted for reviewer verification', userRole);
      const updated = await api.getDraft(draft.id);
      onDraftUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to request approval');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve Draft
  const handleApprove = async () => {
    if (hasOpenFindings) {
      setError('Cannot approve: open findings remain');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await api.approveDraft(draft.id, 'Approved for brand publication', 'demo_reviewer');
      const updated = await api.getDraft(draft.id);
      onDraftUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Request Changes
  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changesComment.trim()) return;

    setActionLoading(true);
    setError(null);
    try {
      await api.requestChanges(draft.id, changesComment);
      setShowChangesModal(false);
      setChangesComment('');
      const updated = await api.getDraft(draft.id);
      onDraftUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to request changes');
    } finally {
      setActionLoading(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await api.addComment(draft.id, commentText, userRole);
      setCommentText('');
      const updated = await api.getDraft(draft.id);
      onDraftUpdated(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to add comment');
    }
  };

  const steps = [
    { num: 1, label: 'Draft Created', done: true, current: draft.status === 'draft' },
    { num: 2, label: 'Checked & Reviewed', done: isChecked || isPending || isApproved || isNeedsChanges, current: isChecked },
    { num: 3, label: 'Pending Approval', done: isPending || isApproved, current: isPending || isNeedsChanges },
    { num: 4, label: 'Approved & Locked', done: isApproved, current: isApproved },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 4-Step Workflow Stepper Bar (Linear/Stripe Style) */}
      <div className="glass-card p-4 sm:p-5 rounded-2xl border border-white/[0.08]">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    step.done
                      ? 'bg-teal-500 text-black shadow-md shadow-teal-500/20'
                      : step.current
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                  }`}
                >
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                </div>
                <span
                  className={`text-xs font-semibold hidden sm:inline ${
                    step.done || step.current ? 'text-white' : 'text-zinc-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${step.done ? 'bg-teal-500/50' : 'bg-zinc-800'}`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Title & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
              Version {draft.current_version}
            </span>
            <span
              className={`text-xs uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full border ${
                isApproved
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : isPending
                  ? 'bg-amber-950/60 text-amber-400 border-amber-800'
                  : isNeedsChanges
                  ? 'bg-red-950/60 text-red-400 border-red-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
              }`}
            >
              Status: {draft.status}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{draft.title}</h1>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Fix 4: Visible Switch to Reviewer action next to disabled Demo Reviewer Approve */}
          {onRoleChange && !isApproved && userRole !== 'reviewer' && (
            <button
              onClick={() => onRoleChange('reviewer')}
              className="btn-secondary-micro inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold"
              title="Switch demo persona to Reviewer"
            >
              <UserCheck className="h-4 w-4 text-teal-400" />
              Switch to Reviewer
            </button>
          )}

          {/* Request Approval Button */}
          {!isApproved && (
            <button
              onClick={handleRequestApproval}
              disabled={actionLoading || isPending || (!isChecked && !isNeedsChanges)}
              title={!isChecked && !isNeedsChanges ? 'Review draft first' : 'Request Reviewer approval'}
              className="btn-secondary-micro px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-bold disabled:opacity-40"
            >
              {isPending ? 'Approval Pending' : 'Request Approval'}
            </button>
          )}

          {/* Approve Button */}
          {!isApproved && (
            <div className="flex flex-col items-start gap-1">
              <button
                onClick={handleApprove}
                disabled={actionLoading || userRole !== 'reviewer' || !isPending || hasOpenFindings}
                title={
                  hasOpenFindings
                    ? 'Cannot approve: open findings remain'
                    : userRole !== 'reviewer'
                    ? 'Reviewer approval required (switch role to Reviewer)'
                    : !isPending
                    ? 'Draft must be pending approval'
                    : 'Approve draft for publication'
                }
                className="btn-primary-micro inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-teal-400 text-black text-xs font-extrabold shadow-lg shadow-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                <span>Demo Reviewer Approve</span>
              </button>
              {hasOpenFindings && (
                <span className="text-[11px] text-amber-400 font-mono font-medium">
                  Cannot approve: open findings remain
                </span>
              )}
            </div>
          )}

          {/* Request Changes Button */}
          {!isApproved && isPending && userRole === 'reviewer' && (
            <button
              onClick={() => setShowChangesModal(true)}
              className="btn-secondary-micro px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-semibold"
            >
              Request Changes
            </button>
          )}
        </div>
      </div>

      {userRole === 'creator' && !isApproved && isPending && (
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
          <span>Reviewer approval required to approve this draft.</span>
          {onRoleChange ? (
            <button
              onClick={() => onRoleChange('reviewer')}
              className="btn-secondary-micro inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-mono font-bold"
            >
              <UserCheck className="h-3.5 w-3.5 text-teal-400" />
              Switch to Reviewer
            </button>
          ) : (
            <span className="text-teal-400 font-medium font-mono">Switch to Reviewer role above to approve.</span>
          )}
        </div>
      )}

      {hasOpenFindings && !isApproved && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800 text-xs text-amber-300 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
            <span className="font-semibold text-amber-200">Cannot approve: open findings remain</span>
            <span className="text-amber-400/80 hidden sm:inline">— apply fixes or request changes first.</span>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({ tab: 'report' }, '', '/report');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="btn-secondary-micro px-3 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold whitespace-nowrap"
          >
            View Findings in Report
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Locked Approved Snapshot Box */}
      {isApproved && draft.approved_snapshot && (
        <div className="glass-card p-6 sm:p-7 rounded-2xl border-2 border-emerald-500/40 space-y-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none"></div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-500 flex items-center justify-center text-black font-bold">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight">LOCKED APPROVED SNAPSHOT</h3>
                <p className="text-[11px] text-emerald-400 font-mono">
                  Approved by {draft.approved_snapshot.approver_role} on{' '}
                  {new Date(draft.approved_snapshot.timestamp).toLocaleString()}
                  {draft.approved_snapshot.vault_version ? ` • ${draft.approved_snapshot.vault_version}` : ''}
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              {draft.approved_snapshot.compliance_badge || 'VERIFIED COMPLIANT'}
            </span>
          </div>

          <p className="text-sm text-zinc-100 leading-relaxed font-sans p-4 bg-black/60 rounded-xl border border-emerald-500/20">
            {draft.approved_snapshot.approved_text}
          </p>

          <p className="text-xs text-zinc-400 italic">
            Notice: Any editing or revision made to this copy will create a new version and automatically reset status to Draft server-side.
          </p>
        </div>
      )}

      {/* Creative Copy & Versions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 sm:p-7 rounded-2xl border border-white/[0.08]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Creative Content (v{draft.current_version})
            </h3>
            <p className="text-sm sm:text-base text-zinc-200 leading-relaxed p-4 bg-black/60 rounded-xl border border-zinc-800">
              {draft.body_text}
            </p>
            {draft.image_url && (
              <div className="mt-4">
                <img
                  src={draft.image_url}
                  alt={draft.alt_text || 'Creative Image'}
                  className="rounded-xl max-h-64 object-contain border border-zinc-800 bg-black/40"
                />
              </div>
            )}
            {draft.alt_text && (
              <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
                <span className="font-semibold text-zinc-300">Alt text:</span> {draft.alt_text}
              </p>
            )}
          </div>

          {/* Decision Log Timeline */}
          <div className="glass-card p-6 sm:p-7 rounded-2xl border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-400" />
              Decision Audit Log ({draft.decisions?.length || 0})
            </h3>
            <div className="space-y-3">
              {(draft.decisions || []).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No formal governance decisions recorded yet.</p>
              ) : (
                (draft.decisions || []).map((d: Decision, idx: number) => (
                  <div
                    key={d.id || `dec-${idx}`}
                    className="row-hover-micro p-3.5 rounded-xl bg-black/60 border border-zinc-850 flex items-start justify-between text-xs gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase font-mono">{d.decision}</span>
                        <span className="text-teal-400 font-mono">by {d.role}</span>
                        <span className="text-zinc-500 font-mono">for v{d.version_no}</span>
                      </div>
                      {d.comment && <p className="text-zinc-300 font-sans">{d.comment}</p>}
                    </div>
                    <span className="text-zinc-500 font-mono text-[11px] whitespace-nowrap">
                      {d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Recent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="glass-card p-6 sm:p-7 rounded-2xl border border-white/[0.08] space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-400" />
              Collaboration & Annotations ({draft.comments?.length || 0})
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {(draft.comments || []).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No comments yet. Add an annotation below.</p>
              ) : (
                (draft.comments || []).map((c: any, idx: number) => (
                  <div key={c.id || idx} className="row-hover-micro p-3 rounded-xl bg-black/40 border border-zinc-850 text-xs space-y-1">
                    <div className="flex items-center justify-between text-zinc-400">
                      <span className="font-semibold text-zinc-300 font-mono">
                        {c.role || 'guest'} (v{c.version_no})
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {c.created_at ? new Date(c.created_at).toLocaleTimeString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-zinc-200">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add reviewer annotation or comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3.5 py-2 bg-black border border-zinc-800 rounded-xl text-white text-xs placeholder:text-zinc-500 focus:border-teal-500 focus:outline-none"
              />
              <button
                type="submit"
                className="btn-secondary-micro px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-teal-400 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Send className="h-3 w-3" />
                Post
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar: Versions and Findings Summary */}
        <div className="space-y-6">
          {/* Version History Card */}
          <div className="glass-card p-6 rounded-2xl border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Immutable Version Tree
            </h3>
            <div className="space-y-2">
              {(draft.versions || []).map((v) => (
                <div
                  key={v.version_no}
                  className={`row-hover-micro p-3 rounded-xl border text-xs flex items-center justify-between ${
                    v.version_no === draft.current_version
                      ? 'bg-teal-500/10 border-teal-500/30 text-white'
                      : 'bg-black/40 border-zinc-850 text-zinc-400'
                  }`}
                >
                  <span className="font-mono font-bold">Version {v.version_no}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {v.created_at ? new Date(v.created_at).toLocaleTimeString() : 'Current'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Governance Checklist Summary */}
          <div className="glass-card p-6 rounded-2xl border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Pre-Publication Gate Status
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Contradictions</span>
                <span className="font-bold text-white font-mono">
                  {findings.filter((f) => f.lane === 'contradiction').length}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Evidence Needed</span>
                <span className="font-bold text-white font-mono">
                  {findings.filter((f) => f.lane === 'evidence_needed').length}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-850">
                <span className="text-zinc-400">Human Decisions</span>
                <span className="font-bold text-white font-mono">
                  {findings.filter((f) => f.lane === 'human_decision').length}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-400">Locked Snapshot</span>
                <span className={`font-bold font-mono ${isApproved ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {isApproved ? 'Active (Locked)' : 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRequestChanges}
            className="glass-card p-6 rounded-2xl border border-red-500/30 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Request Copy Changes
            </h3>
            <p className="text-xs text-zinc-400">
              Please specify the required adjustments for the creative author. A descriptive reason is mandatory.
            </p>
            <textarea
              required
              value={changesComment}
              onChange={(e) => setChangesComment(e.target.value)}
              placeholder="Explain required changes before this copy can be approved..."
              className="w-full p-3 bg-black border border-zinc-700 rounded-xl text-white text-xs focus:border-red-500 focus:outline-none h-28"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="btn-secondary-micro px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !changesComment.trim()}
                className="btn-secondary-micro px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs disabled:opacity-50"
              >
                Submit Changes Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};