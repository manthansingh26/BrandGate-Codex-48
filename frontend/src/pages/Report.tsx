import React, { useState, useEffect } from 'react';
import { Draft, Finding, ApiConnectionStatus, LlmReviewResult } from '../types';
import { api } from '../api/client';
import { runLocalDemoReview } from '../utils/localReviewEngine';
import { Check, ArrowRight, RefreshCw, Sparkles, AlertCircle, AlertTriangle, ShieldCheck, CheckCircle2, Bot, Info } from 'lucide-react';

interface ReportProps {
  draft: Draft | null;
  findings: Finding[];
  llmReview?: LlmReviewResult | null;
  onDraftUpdated: (draft: Draft, findings: Finding[], llmReview?: LlmReviewResult | null) => void;
  onNavigateToReview: () => void;
  onNavigateToSubmit?: () => void;
  apiStatus: ApiConnectionStatus;
  isRestoringDraft?: boolean;
}

export const Report: React.FC<ReportProps> = ({
  draft,
  findings,
  llmReview,
  onDraftUpdated,
  onNavigateToReview,
  onNavigateToSubmit,
  apiStatus,
  isRestoringDraft,
}) => {
  const [applyingFixId, setApplyingFixId] = useState<string | null>(null);
  const [applyFixElapsed, setApplyFixElapsed] = useState<number>(0);
  const [isAiReviewUpdating, setIsAiReviewUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: any = null;
    if (applyingFixId) {
      setApplyFixElapsed(0);
      timer = setInterval(() => {
        setApplyFixElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setApplyFixElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [applyingFixId]);

  if (!draft) {
    if (isRestoringDraft) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-zinc-900/80 border border-teal-500/30 text-teal-300 text-sm font-medium">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-400" />
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

  const handleApplyFix = async (finding: Finding) => {
    if (!finding.id || !finding.suggested_fix) return;
    setApplyingFixId(finding.id);
    setError(null);

    try {
      if (apiStatus === 'connected') {
        setIsAiReviewUpdating(true);
        // Call backend deterministic fix
        const fixRes = await api.applyFix(draft.id, finding.id);
        const receiptTime = new Date().toISOString();

        // Immediate deterministic version creation from response
        const remainingFindings = findings.filter((f) => f.id !== finding.id);
        const newVersionNo = fixRes.version_no || (draft.current_version + 1);
        const newBody = fixRes.body_text;

        const immediateDraft: Draft = {
          ...draft,
          body_text: newBody,
          current_version: newVersionNo,
          status: (fixRes.status as any) || draft.status,
          versions: [
            ...(draft.versions || []),
            {
              version_no: newVersionNo,
              body_text: newBody,
              alt_text: draft.alt_text,
              created_at: receiptTime,
            },
          ],
        };

        // Render deterministic new version immediately, keeping previous AI review count
        onDraftUpdated(immediateDraft, remainingFindings, llmReview);

        // Run re-review in background
        try {
          const reviewRes = await api.reviewDraft(draft.id);
          const updatedDraft = await api.getDraft(draft.id);
          // Sync versions so receipt timestamp remains aligned
          const synchronizedDraft: Draft = {
            ...updatedDraft,
            versions:
              updatedDraft.versions && updatedDraft.versions.length >= (immediateDraft.versions?.length || 0)
                ? updatedDraft.versions
                : immediateDraft.versions,
          };
          onDraftUpdated(synchronizedDraft, reviewRes.findings, reviewRes.llm_review);
        } catch (pollErr) {
          console.warn('Background AI re-review poll deferred, deterministic version authoritative:', pollErr);
        } finally {
          setIsAiReviewUpdating(false);
        }
      } else {
        let newBody = draft.body_text;
        if (finding.citation_id === 'F-12' || finding.suggested_fix.includes('Rs.')) {
          newBody = newBody.replace(/(?:Rs\.?|INR|₹)\s*[\d,]+/gi, finding.suggested_fix);
        } else if (
          finding.citation_id === 'R-04' &&
          (finding.explanation.toLowerCase().includes('no. 1') || finding.suggested_fix === 'trusted')
        ) {
          newBody = newBody.replace(/India['’]?s\s+No\.?\s*1|No\.?\s*1/gi, 'trusted');
        } else if (
          finding.citation_id === 'R-04' &&
          (finding.explanation.toLowerCase().includes('clinically') || finding.suggested_fix === 'certified quality')
        ) {
          newBody = newBody.replace(/clinically\s+proven/gi, 'certified quality');
        } else if (finding.suggested_fix) {
          const match = finding.explanation.match(/Claim\s+['"](.*?)['"]\s+is/);
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
        onDraftUpdated(localUpdatedDraft, localNewFindings, llmReview);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to apply fix');
    } finally {
      setApplyingFixId(null);
      setIsAiReviewUpdating(false);
    }
  };

  const contradictions = findings.filter((f) => f.lane === 'contradiction');
  const evidenceNeeded = findings.filter((f) => f.lane === 'evidence_needed');
  const humanDecision = findings.filter((f) => f.lane === 'human_decision');
  const aiFindings = llmReview?.findings || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-teal-500/20 text-teal-400 border border-teal-500/30">
              Version {draft.current_version}
            </span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
              Status: <span className="text-zinc-300 font-bold">{draft.status}</span>
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{draft.title}</h1>
        </div>

        <button
          onClick={onNavigateToReview}
          className="btn-primary-micro inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-sm shadow-lg shadow-teal-500/20"
        >
          Proceed to Approval Workflow
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-red-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Contradictions</span>
            <AlertCircle className="h-4 w-4 text-red-400" />
          </div>
          <span className="text-3xl font-black text-white font-mono mt-2 block">
            {draft.status === 'draft' ? '-' : contradictions.length}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {draft.status === 'draft' ? 'Pending draft review' : 'Factual & Pricing mismatches'}
          </span>
        </div>

        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-amber-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Evidence Needed</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <span className="text-3xl font-black text-white font-mono mt-2 block">
            {draft.status === 'draft' ? '-' : evidenceNeeded.length}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {draft.status === 'draft' ? 'Pending draft review' : 'Unsubstantiated superlatives'}
          </span>
        </div>

        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-sky-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">Human Decision</span>
            <ShieldCheck className="h-4 w-4 text-sky-400" />
          </div>
          <span className="text-3xl font-black text-white font-mono mt-2 block">
            {draft.status === 'draft' ? '-' : humanDecision.length}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {draft.status === 'draft' ? 'Pending draft review' : 'Logos, palettes & tone'}
          </span>
        </div>

        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-teal-500/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">AI Suggestions</span>
            <Sparkles className="h-4 w-4 text-teal-400" />
          </div>
          <span className="text-3xl font-black text-white font-mono mt-2 block">
            {draft.status === 'draft' ? '-' : aiFindings.length}
          </span>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {draft.status === 'draft' ? 'Pending draft review' : 'Grounded Gemini review'}
          </span>
        </div>
      </div>

      {/* Current Draft Text Display */}
      <div className="glass-card p-6 sm:p-7 rounded-2xl border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Creative Copy Under Evaluation (Version {draft.current_version})
          </h3>
          <span className="text-xs text-zinc-500 font-mono">
            {draft.body_text.length} characters
          </span>
        </div>
        <div className="p-4 rounded-xl bg-black/60 border border-zinc-800 text-sm sm:text-base text-zinc-100 font-sans leading-relaxed">
          {draft.body_text}
        </div>
        {draft.alt_text && (
          <div className="text-xs text-zinc-400 flex items-center gap-2 pt-1">
            <span className="font-semibold text-zinc-300">Image Alt Text:</span> {draft.alt_text}
          </div>
        )}
      </div>

      {/* Findings Breakdown */}
      <div className="space-y-8">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Governance Findings</span>
            <span className="text-sm font-mono font-normal text-zinc-400">
              {draft.status === 'draft' ? '(— pending review)' : `(${findings.length} active)`}
            </span>
          </h2>
          <span className="text-xs text-teal-400 font-mono font-bold">"No citation, no flag"</span>
        </div>

        {draft.status === 'draft' ? (
          <div className="glass-card p-10 rounded-2xl border border-zinc-800 text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Not yet reviewed</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              This draft has not been evaluated against the active Brand Vault rules. Click <span className="text-teal-400 font-semibold">Review Draft</span> to check this draft.
            </p>
            <button
              onClick={() => {
                if (onNavigateToSubmit) {
                  onNavigateToSubmit();
                } else if (typeof window !== 'undefined') {
                  window.history.pushState({ tab: 'submit' }, '', '/submit');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }}
              className="btn-primary-micro inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-400 text-black font-extrabold text-xs shadow-lg shadow-teal-500/20"
            >
              Go to Submit & Review Draft
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : findings.length === 0 ? (
          <div className="glass-card p-10 rounded-2xl border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">All Governance Checks Passed!</h3>
            <p className="text-sm text-zinc-400 max-w-md mx-auto">
              {draft.status === 'approved' ? (
                'Approved and locked — see Review for the locked snapshot'
              ) : (
                'Creative copy and visual assets align with all active Brand Vault rules. Proceed to the review tab to request final reviewer sign-off.'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Lane 1: Contradictions */}
            {contradictions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-red-400 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-red-400"></span>
                  Lane: Contradictions ({contradictions.length})
                </div>
                <div className="space-y-3">
                  {contradictions.map((f, i) => (
                    <FindingCard
                      key={f.id || i}
                      finding={f}
                      onApplyFix={handleApplyFix}
                      applyingFixId={applyingFixId}
                      applyFixElapsed={applyFixElapsed}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Lane 2: Evidence Needed */}
            {evidenceNeeded.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                  Lane: Evidence Needed ({evidenceNeeded.length})
                </div>
                <div className="space-y-3">
                  {evidenceNeeded.map((f, i) => (
                    <FindingCard
                      key={f.id || i}
                      finding={f}
                      onApplyFix={handleApplyFix}
                      applyingFixId={applyingFixId}
                      applyFixElapsed={applyFixElapsed}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Lane 3: Human Decisions */}
            {humanDecision.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-sky-400 uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-sky-400"></span>
                  Lane: Human Decisions ({humanDecision.length})
                </div>
                <div className="space-y-3">
                  {humanDecision.map((f, i) => (
                    <FindingCard
                      key={f.id || i}
                      finding={f}
                      onApplyFix={handleApplyFix}
                      applyingFixId={applyingFixId}
                      applyFixElapsed={applyFixElapsed}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grounded AI Review Panel (Secondary Advisory Layer) */}
      <div className="glass-card p-6 sm:p-7 rounded-2xl border border-teal-500/20 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white">Secondary Advisory Intelligence</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/25">
                  Advisory only — unapproved alternative, not the Approved Replacement
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Model exploratory recommendations powered by Google Gemini (gemini-2.5-flash-lite). Never overrides authoritative Brand Vault deterministic gate.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-teal-400">
            {draft.status === 'draft' || !llmReview
              ? 'Pending Draft Review'
              : isAiReviewUpdating
              ? 'Updating...'
              : llmReview?.status || 'Advisory Layer Active'}
          </span>
        </div>

        {/* AI Findings List */}
        {draft.status === 'draft' || !llmReview ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            AI compliance review has not run yet. Run Review Draft on the Submit page to generate grounded advisory intelligence.
          </p>
        ) : isAiReviewUpdating ? (
          <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 flex items-center gap-3 text-xs text-teal-300">
            <RefreshCw className="h-4 w-4 animate-spin text-teal-400" />
            <span>Deterministic fix applied — AI review updating in background...</span>
          </div>
        ) : aiFindings.length > 0 ? (
          <div className="space-y-3">
            {aiFindings.map((f, i) => (
              <div
                key={i}
                className="row-hover-micro p-4 rounded-xl bg-black/40 border border-zinc-800 flex flex-wrap sm:flex-nowrap items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                      Grounded in {f.citation_id}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{f.lane}</span>
                    <span className="text-[10px] text-amber-400/90 font-mono">(Advisory Only)</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{f.explanation}</p>
                </div>
                {f.suggested_fix && (
                  <div className="flex flex-col sm:items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      AI Alternative (Unapproved):
                    </span>
                    <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 whitespace-nowrap">
                      {f.suggested_fix}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">
            {llmReview?.status === 'timeout' || llmReview?.reason?.toLowerCase().includes('timeout')
              ? 'Advisory AI review timed out on background re-evaluation. Deterministic review remains fully authoritative.'
              : 'Grounded LLM review detected no additional secondary compliance risks.'}
          </p>
        )}

        {/* Honest Disclosure Note */}
        <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-850">
          <Info className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
          <span>Deterministic review is the primary safety gate. AI analysis is advisory and subject to the same citation validation.</span>
        </div>
      </div>
    </div>
  );
};

interface FindingCardProps {
  finding: Finding;
  onApplyFix: (f: Finding) => void;
  applyingFixId: string | null;
  applyFixElapsed: number;
}

const FindingCard: React.FC<FindingCardProps> = ({ finding, onApplyFix, applyingFixId, applyFixElapsed }) => {
  const isApplying = applyingFixId === finding.id;

  const severityColor = {
    high: 'text-red-400 bg-red-950/30 border-red-800/40',
    medium: 'text-amber-400 bg-amber-950/30 border-amber-800/40',
    low: 'text-sky-400 bg-sky-950/30 border-sky-800/40',
  }[finding.severity] || 'text-zinc-400 bg-zinc-900 border-zinc-800';

  return (
    <div className="glass-card row-hover-micro p-5 rounded-2xl border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-2 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
            {finding.citation_id}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${severityColor}`}>
            {finding.severity} Severity
          </span>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed font-sans">{finding.explanation}</p>
        {finding.suggested_fix && (
          <div className="text-xs font-mono text-zinc-400 flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-teal-400 font-semibold font-sans">Approved Replacement (Authoritative):</span>
            <span className="px-2 py-0.5 rounded bg-black/60 border border-teal-500/30 text-teal-300 font-bold">
              "{finding.suggested_fix}"
            </span>
          </div>
        )}
      </div>

      {finding.suggested_fix && (
        <button
          onClick={() => onApplyFix(finding)}
          disabled={applyingFixId !== null}
          className="btn-primary-micro inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-400 text-black font-bold text-xs shadow-md shadow-teal-500/20 disabled:opacity-50"
        >
          {isApplying ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Applying fix... {applyFixElapsed}s
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
  );
};