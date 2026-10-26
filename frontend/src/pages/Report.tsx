import React, { useState } from 'react';
import { Draft, Finding, ApiConnectionStatus } from '../types';
import { api } from '../api/client';
import { runLocalDemoReview } from '../utils/localReviewEngine';
import { Check, ArrowRight, RefreshCw } from 'lucide-react';

interface ReportProps {
  draft: Draft | null;
  findings: Finding[];
  onDraftUpdated: (draft: Draft, findings: Finding[]) => void;
  onNavigateToReview: () => void;
  apiStatus: ApiConnectionStatus;
}

export const Report: React.FC<ReportProps> = ({
  draft,
  findings,
  onDraftUpdated,
  onNavigateToReview,
  apiStatus,
}) => {
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500 text-base">No draft loaded. Please submit or load a draft to view its governance report.</p>
      </div>
    );
  }

  const handleApplyFix = async (finding: Finding) => {
    if (!finding.id || !finding.suggested_fix) return;
    setApplyingFixId(finding.id);
    setError(null);

    try {
      if (apiStatus === 'connected') {
        // 1. Apply fix via API (increments version, returns updated draft)
        await api.applyFix(draft.id, finding.id);

        // 2. Re-run review on updated draft
        const newFindings = await api.reviewDraft(draft.id);
        const updatedDraft = await api.getDraft(draft.id);
        onDraftUpdated(updatedDraft, newFindings);
      } else {
        // Local demo mode fix
        let newBody = draft.body_text;
        if (finding.citation_id === 'F-12' || finding.suggested_fix.includes('Rs.')) {
          newBody = newBody.replace(/(?:Rs\.?|INR|₹)\s*[\d,]+/gi, finding.suggested_fix);
        } else if (finding.suggested_fix) {
          const match = finding.explanation.match(/'(.*?)'/);
          if (match) {
            newBody = newBody.replace(new RegExp(match[1], 'gi'), finding.suggested_fix);
          }
        }

        const newVersionNo = draft.current_version + 1;
        const localUpdatedDraft: Draft = {
          ...draft,
          body_text: newBody,
          current_version: newVersionNo,
          versions: [
            ...(draft.versions || []),
            {
              version_no: newVersionNo,
              body_text: newBody,
              alt_text: draft.alt_text,
              created_at: new Date().toISOString(),
            },
          ],
        };

        const localNewFindings = runLocalDemoReview(newBody, draft.alt_text, draft.image_url);
        onDraftUpdated(localUpdatedDraft, localNewFindings);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply fix');
    } finally {
      setApplyingFixId(null);
    }
  };

  const contradictions = findings.filter((f) => f.lane === 'contradiction');
  const evidenceNeeded = findings.filter((f) => f.lane === 'evidence_needed');
  const humanDecision = findings.filter((f) => f.lane === 'human_decision');

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
              Version {draft.current_version}
            </span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
              Status: {draft.status}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">{draft.title}</h1>
        </div>

        <button
          onClick={onNavigateToReview}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-sm font-semibold transition-colors"
        >
          Reviewer Preview
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Current Draft Text Display */}
      <div className="mb-8 p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
          Current Creative Copy (v{draft.current_version})
        </h3>
        <p className="text-base text-zinc-200 font-sans leading-relaxed">{draft.body_text}</p>
        {draft.alt_text && (
          <div className="mt-3 pt-3 border-t border-zinc-850 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">Alt text:</span> {draft.alt_text}
          </div>
        )}
      </div>

      {/* Findings Breakdown */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Governance Findings ({findings.length})</h2>
          <span className="text-xs text-zinc-500 font-mono">Hero rule: No citation, no flag</span>
        </div>

        {findings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-zinc-950 border border-zinc-800 text-center text-teal-400 font-medium">
            <Check className="h-8 w-8 mx-auto mb-2 text-teal-400" />
            All checks passed! No contradictions or evidence violations detected.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contradictions */}
            {contradictions.map((f, idx) => (
              <FindingCard
                key={f.id || `contra-${idx}`}
                finding={f}
                onApplyFix={handleApplyFix}
                applyingFixId={applyingFixId}
              />
            ))}

            {/* Evidence Needed */}
            {evidenceNeeded.map((f, idx) => (
              <FindingCard
                key={f.id || `evi-${idx}`}
                finding={f}
                onApplyFix={handleApplyFix}
                applyingFixId={applyingFixId}
              />
            ))}

            {/* Human Decision */}
            {humanDecision.map((f, idx) => (
              <FindingCard
                key={f.id || `hum-${idx}`}
                finding={f}
                onApplyFix={handleApplyFix}
                applyingFixId={applyingFixId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface FindingCardProps {
  finding: Finding;
  onApplyFix: (f: Finding) => void;
  applyingFixId: string | null;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding, onApplyFix, applyingFixId }) => {
  const isApplying = applyingFixId === finding.id;

  const getLaneBadge = (lane: string) => {
    switch (lane) {
      case 'contradiction':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-red-950/60 border border-red-800 text-red-400">Contradiction</span>;
      case 'evidence_needed':
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-amber-950/60 border border-amber-800 text-amber-400">Evidence Needed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-blue-950/60 border border-blue-800 text-blue-400">Human Decision</span>;
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {getLaneBadge(finding.lane)}
          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-teal-400 text-xs font-mono font-bold">
            Citation: {finding.citation_id}
          </span>
          <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
            {finding.severity} severity
          </span>
        </div>

        {finding.suggested_fix && (
          <button
            onClick={() => onApplyFix(finding)}
            disabled={isApplying}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Applying Fix...
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Apply Fix: "{finding.suggested_fix}"
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-200 leading-relaxed font-sans">{finding.explanation}</p>

      {finding.suggested_fix && (
        <div className="mt-3 pt-3 border-t border-zinc-900 text-xs text-zinc-400 flex items-center gap-2">
          <span className="text-zinc-500 font-medium">Suggested correction:</span>
          <span className="font-mono text-teal-400 font-semibold">{finding.suggested_fix}</span>
        </div>
      )}
    </div>
  );
};
