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
} from 'lucide-react';

interface ReviewProps {
  draft: Draft | null;
  findings: Finding[];
  userRole: UserRole;
  onDraftUpdated: (draft: Draft) => void;
}

export const Review: React.FC<ReviewProps> = ({ draft, findings, userRole, onDraftUpdated }) => {
  const [commentText, setCommentText] = useState('');
  const [changesComment, setChangesComment] = useState('');
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500 text-base">No draft loaded. Please submit or load a draft first.</p>
      </div>
    );
  }

  const isApproved = draft.status === 'approved';
  const isPending = draft.status === 'pending_approval';
  const isChecked = draft.status === 'checked';

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Title & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
              Version {draft.current_version}
            </span>
            <span
              className={`text-xs uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                isApproved
                  ? 'bg-teal-950 text-teal-400 border border-teal-800'
                  : isPending
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              Status: {draft.status}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">{draft.title}</h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Request Approval Button */}
          {!isApproved && (
            <button
              onClick={handleRequestApproval}
              disabled={actionLoading || isPending || !isChecked}
              title={!isChecked ? 'Review draft first' : 'Request Reviewer approval'}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {isPending ? 'Approval Pending' : 'Request Approval'}
            </button>
          )}

          {/* Approve Button */}
          {!isApproved && (
            <button
              onClick={handleApprove}
              disabled={actionLoading || userRole !== 'reviewer' || !isPending}
              title={
                userRole !== 'reviewer'
                  ? 'Reviewer approval required (switch role to Reviewer)'
                  : !isPending
                  ? 'Draft must be pending approval'
                  : 'Approve draft for publication'
              }
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-black text-sm font-bold shadow-lg shadow-teal-500/20 transition-all disabled:opacity-40 disabled:hover:bg-teal-500"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve Draft'}
            </button>
          )}

          {/* Request Changes Button */}
          {!isApproved && isPending && userRole === 'reviewer' && (
            <button
              onClick={() => setShowChangesModal(true)}
              className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800 text-sm font-semibold transition-colors"
            >
              Request Changes
            </button>
          )}
        </div>
      </div>

      {userRole === 'creator' && !isApproved && isPending && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
          <span>Reviewer approval required to approve this draft.</span>
          <span className="text-teal-400 font-medium">Switch to Reviewer in top right to approve.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Locked Approved Snapshot Box */}
      {isApproved && draft.approved_snapshot && (
        <div className="p-6 rounded-2xl bg-teal-950/30 border-2 border-teal-500/40 space-y-4">
          <div className="flex items-center justify-between border-b border-teal-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-teal-500 flex items-center justify-center text-black font-bold">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">LOCKED APPROVED SNAPSHOT</h3>
                <p className="text-[11px] text-teal-400 font-mono">
                  Approved by {draft.approved_snapshot.approver_role} on{' '}
                  {new Date(draft.approved_snapshot.timestamp).toLocaleString()} ({draft.approved_snapshot.vault_version})
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-teal-500/20 border border-teal-500/40 text-teal-400 text-xs font-mono font-bold">
              VERIFIED COMPLIANT
            </span>
          </div>

          <p className="text-sm text-zinc-200 leading-relaxed font-sans p-3 bg-black/40 rounded-xl border border-teal-500/10">
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
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Creative Content
            </h3>
            <p className="text-sm text-zinc-200 leading-relaxed p-4 bg-black rounded-xl border border-zinc-800">
              {draft.body_text}
            </p>
            {draft.image_url && (
              <div className="mt-4">
                <img
                  src={draft.image_url}
                  alt={draft.alt_text || 'Creative Image'}
                  className="rounded-xl max-h-60 object-contain border border-zinc-800"
                />
              </div>
            )}
            {draft.alt_text && (
              <p className="text-xs text-zinc-400 mt-2">
                <span className="font-semibold text-zinc-300">Alt text:</span> {draft.alt_text}
              </p>
            )}
          </div>

          {/* Decision Log Timeline */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-400" />
              Decision Audit Log
            </h3>
            <div className="space-y-3">
              {(draft.decisions || []).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No formal governance decisions recorded yet.</p>
              ) : (
                (draft.decisions || []).map((d: Decision, idx: number) => (
                  <div
                    key={d.id || `dec-${idx}`}
                    className="p-3.5 rounded-xl bg-black border border-zinc-850 flex items-start justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white uppercase font-mono">{d.decision}</span>
                        <span className="text-teal-400 font-mono">by {d.role}</span>
                        <span className="text-zinc-500">for v{d.version_no}</span>
                      </div>
                      {d.comment && <p className="text-zinc-300">{d.comment}</p>}
                    </div>
                    <span className="text-zinc-500 font-mono text-[11px]">
                      {d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Recent'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-400" />
              Collaboration Comments
            </h3>

            <div className="space-y-2.5 max-h-60 overflow-y-auto">
              {(draft.comments || []).length === 0 ? (
                <p className="text-xs text-zinc-500 italic">No comments yet.</p>
              ) : (
                (draft.comments || []).map((c: any, idx: number) => (
                  <div key={c.id || `comm-${idx}`} className="p-3 rounded-xl bg-black border border-zinc-850 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
                      <span className="font-semibold text-teal-400">{c.role}</span>
                      <span className="font-mono">
                        {c.created_at ? new Date(c.created_at).toLocaleTimeString() : 'Now'}
                      </span>
                    </div>
                    <p className="text-zinc-300">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Add a comment or governance note..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3 py-2 bg-black border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Send className="h-3 w-3" />
                Post
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar Findings Summary */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
            <h3 className="text-sm font-bold text-white mb-4">Findings Audit</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-850">
                <span className="text-zinc-400">Total Flags:</span>
                <span className="font-bold text-white font-mono">{findings.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-950/20 border border-red-900/40">
                <span className="text-red-400">Contradictions:</span>
                <span className="font-bold text-red-400 font-mono">
                  {findings.filter((f) => f.lane === 'contradiction').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/20 border border-amber-900/40">
                <span className="text-amber-400">Evidence Needed:</span>
                <span className="font-bold text-amber-400 font-mono">
                  {findings.filter((f) => f.lane === 'evidence_needed').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleRequestChanges}
            className="w-full max-w-md p-6 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Request Changes</h3>
            <p className="text-xs text-zinc-400">
              Provide required feedback explaining why this draft needs revisions.
            </p>
            <textarea
              required
              value={changesComment}
              onChange={(e) => setChangesComment(e.target.value)}
              placeholder="Explain the required revisions or missing evidence..."
              className="w-full p-3 bg-black border border-zinc-700 rounded-xl text-xs text-white h-24 focus:outline-none focus:border-teal-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowChangesModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
