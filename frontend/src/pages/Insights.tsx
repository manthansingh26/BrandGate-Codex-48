import React, { useEffect, useState } from 'react';
import { Brand, InsightsData } from '../types';
import { api } from '../api/client';
import { BarChart3, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface InsightsProps {
  activeBrand: Brand | null;
}

export const Insights: React.FC<InsightsProps> = ({ activeBrand }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getInsights(activeBrand?.id);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load insights data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [activeBrand?.id]);

  const canonicalCitations = [
    { id: 'F-12', label: 'Festive Price Offer (F-12)', type: 'Fact' },
    { id: 'R-04', label: 'Superlatives & Claims Evidence (R-04)', type: 'Rule' },
    { id: 'A-02', label: 'Approved Logo Check (A-02)', type: 'Rule' },
    { id: 'R-09', label: 'Descriptive Alt Text (R-09)', type: 'Rule' },
    { id: 'P-01', label: 'Primary Brand Blue (P-01)', type: 'Palette' },
    { id: 'P-02', label: 'Secondary Accent Amber (P-02)', type: 'Palette' },
    { id: 'P-03', label: 'Surface Neutral Light (P-03)', type: 'Palette' },
    { id: 'P-04', label: 'Text Slate Dark (P-04)', type: 'Palette' },
    { id: 'T-01', label: 'Restricted Term: clinically proven (T-01)', type: 'Terminology' },
    { id: 'T-02', label: "Restricted Term: India's No. 1 (T-02)", type: 'Terminology' },
    { id: 'T-03', label: 'Approved Term: certified quality (T-03)', type: 'Terminology' },
    { id: 'T-04', label: 'Approved Term: trusted by millions (T-04)', type: 'Terminology' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 border border-zinc-800 text-teal-400">
              Database aggregation
            </span>
            <span className="text-xs text-zinc-500 font-mono">
              Live from PostgreSQL database
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-teal-400" />
            Governance Insights
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real aggregated finding counts across all drafts and reviews for{' '}
            <span className="text-white font-medium">{activeBrand?.name || 'Demo Brand (Seeded)'}</span>.
          </p>
        </div>

        <button
          onClick={fetchInsights}
          disabled={loading}
          className="btn-secondary-micro inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh Counts'}
        </button>
      </div>

      {/* Honesty Disclosure Banner */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 text-xs text-zinc-400 leading-relaxed">
        <span className="font-semibold text-zinc-300">Honesty Label:</span> These metrics reflect actual rows recorded in the database. BrandGate never invents fictitious history, fake weekly trend graphs, or simulated user activity.
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-white/[0.08]">
          <span className="text-xs font-semibold text-zinc-400 block mb-1 uppercase tracking-wider">Total Findings</span>
          {loading || !data ? (
            <div className="h-9 flex items-center">
              <span className="text-xs font-mono text-zinc-400 animate-pulse flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
                Loading counts...
              </span>
            </div>
          ) : (
            <span className="text-3xl font-black text-white font-mono">
              {data.total_findings}
            </span>
          )}
          <span className="text-[11px] text-zinc-500 mt-1 block">Across all draft reviews</span>
        </div>
        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-red-500/20">
          <span className="text-xs font-semibold text-red-400 block mb-1 uppercase tracking-wider">Contradictions</span>
          {loading || !data ? (
            <div className="h-9 flex items-center">
              <span className="text-xs font-mono text-red-400/70 animate-pulse flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                Loading counts...
              </span>
            </div>
          ) : (
            <span className="text-3xl font-black text-red-400 font-mono">
              {data.counts_by_lane['contradiction'] || 0}
            </span>
          )}
          <span className="text-[11px] text-zinc-500 mt-1 block">Factual discrepancies</span>
        </div>
        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-amber-500/20">
          <span className="text-xs font-semibold text-amber-400 block mb-1 uppercase tracking-wider">Evidence Needed</span>
          {loading || !data ? (
            <div className="h-9 flex items-center">
              <span className="text-xs font-mono text-amber-400/70 animate-pulse flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                Loading counts...
              </span>
            </div>
          ) : (
            <span className="text-3xl font-black text-amber-400 font-mono">
              {data.counts_by_lane['evidence_needed'] || 0}
            </span>
          )}
          <span className="text-[11px] text-zinc-500 mt-1 block">Unsubstantiated claims</span>
        </div>
        <div className="glass-card feature-card-micro p-5 rounded-2xl border border-sky-500/20">
          <span className="text-xs font-semibold text-sky-400 block mb-1 uppercase tracking-wider">Human Decision</span>
          {loading || !data ? (
            <div className="h-9 flex items-center">
              <span className="text-xs font-mono text-sky-400/70 animate-pulse flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                Loading counts...
              </span>
            </div>
          ) : (
            <span className="text-3xl font-black text-sky-400 font-mono">
              {data.counts_by_lane['human_decision'] || 0}
            </span>
          )}
          <span className="text-[11px] text-zinc-500 mt-1 block">Logos, palettes & tone</span>
        </div>
      </div>

      {/* Detailed Breakdown by Citation ID */}
      <div className="glass-card p-6 sm:p-7 rounded-2xl border border-white/[0.08] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Findings Distribution by Vault Citation ID (Across all draft reviews)</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Frequency of governance findings flagged against ground-truth rules.</p>
          </div>
          <span className="text-xs text-teal-400 font-mono font-semibold">Real PostgreSQL aggregation</span>
        </div>

        <div className="space-y-3">
          {canonicalCitations.map((item) => {
            const count = data?.counts_by_citation[item.id] || 0;
            const maxVal = Math.max(...Object.values(data?.counts_by_citation || {}), 1);
            const percent = Math.round((count / maxVal) * 100);

            return (
              <div key={item.id} className="row-hover-micro p-3.5 rounded-xl bg-black/40 border border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-[280px]">
                  <span className="px-2.5 py-0.5 rounded-md font-mono font-bold bg-teal-500/10 border border-teal-500/20 text-teal-300">
                    {item.id}
                  </span>
                  <div>
                    <span className="text-zinc-200 font-semibold block">{item.label}</span>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500">
                      Category: {item.type}
                    </span>
                  </div>
                </div>

                <div className="flex-1 max-w-xs mx-0 sm:mx-4 hidden sm:block">
                  <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${count > 0 ? Math.max(percent, 8) : 0}%` }}
                    ></div>
                  </div>
                </div>

                <span
                  className={`font-mono font-bold px-3 py-1 rounded-full text-xs text-right whitespace-nowrap ${
                    count > 0 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 'text-zinc-600 bg-zinc-900/60'
                  }`}
                >
                  {count} {count === 1 ? 'occurrence' : 'occurrences'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
