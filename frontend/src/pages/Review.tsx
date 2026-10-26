import React from 'react';
import { Draft, Finding } from '../types';
import { Clock, ShieldCheck } from 'lucide-react';

interface ReviewProps {
  draft: Draft | null;
  findings: Finding[];
}

export const Review: React.FC<ReviewProps> = ({ draft, findings }) => {
  if (!draft) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-500 text-base">No draft selected. Please load or create a draft first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Phase 5 Notice Banner */}
      <div className="mb-8 p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 text-teal-400 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2.5 font-medium">
          <ShieldCheck className="h-5 w-5 text-teal-400 flex-shrink-0" />
          <span>Reviewer Preview Mode — Approval workflow arrives in Phase 5</span>
        </div>
        <span className="text-xs text-zinc-400 font-mono">Phase 4 Preview</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Creative Overview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold text-teal-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                Version {draft.current_version}
              </span>
              <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">
                Status: {draft.status}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white mb-4">{draft.title}</h1>

            <div className="p-4 rounded-xl bg-black border border-zinc-800 text-zinc-200 text-sm leading-relaxed mb-4">
              {draft.body_text}
            </div>

            {draft.image_url && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-400">Attached Image Creative:</span>
                <img
                  src={draft.image_url}
                  alt={draft.alt_text || 'Creative Image'}
                  className="rounded-xl max-h-64 object-contain border border-zinc-800"
                />
              </div>
            )}

            {draft.alt_text && (
              <div className="text-xs text-zinc-400 mt-2">
                <span className="font-semibold text-zinc-300">Alt text:</span> {draft.alt_text}
              </div>
            )}
          </div>

          {/* Version History Summary */}
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-teal-400" />
              Version History
            </h3>
            <div className="space-y-3">
              {(draft.versions || []).map((v) => (
                <div
                  key={v.version_no}
                  className="p-3 rounded-xl bg-black border border-zinc-850 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-teal-400 mr-2">v{v.version_no}</span>
                    <span className="text-zinc-300 truncate max-w-md inline-block align-bottom">
                      {v.body_text}
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono">
                    {v.created_at ? new Date(v.created_at).toLocaleTimeString() : 'Initial'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Findings Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800">
            <h3 className="text-sm font-bold text-white mb-4">Governance Audit Summary</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-850">
                <span className="text-zinc-400">Total Findings:</span>
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

            <div className="mt-6 pt-4 border-t border-zinc-850 text-[11px] text-zinc-500 leading-normal">
              Hero rule enforced: Findings without active vault citations are strictly excluded from reviewer inspection.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
