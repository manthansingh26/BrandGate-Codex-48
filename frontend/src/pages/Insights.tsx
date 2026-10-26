import React, { useEffect, useState } from 'react';
import { Brand, InsightsData } from '../types';
import { api } from '../api/client';
import { BarChart3, RefreshCw, AlertCircle } from 'lucide-react';

interface InsightsProps {
  activeBrand: Brand | null;
}

export const Insights: React.FC<InsightsProps> = ({ activeBrand }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
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
              Session counts
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Counts
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-xs font-semibold text-zinc-400 block mb-1">Total Findings</span>
          <span className="text-3xl font-black text-white font-mono">
            {data ? data.total_findings : 0}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-xs font-semibold text-red-400 block mb-1">Contradictions</span>
          <span className="text-3xl font-black text-red-400 font-mono">
            {data ? data.counts_by_lane['contradiction'] || 0 : 0}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-xs font-semibold text-amber-400 block mb-1">Evidence Needed</span>
          <span className="text-3xl font-black text-amber-400 font-mono">
            {data ? data.counts_by_lane['evidence_needed'] || 0 : 0}
          </span>
        </div>
        <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800">
          <span className="text-xs font-semibold text-blue-400 block mb-1">Human Decision</span>
          <span className="text-3xl font-black text-blue-400 font-mono">
            {data ? data.counts_by_lane['human_decision'] || 0 : 0}
          </span>
        </div>
      </div>

      {/* Detailed Breakdown by Citation ID */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-855 pb-3">
          <h3 className="text-base font-bold text-white">Violations & Findings by Vault Citation ID</h3>
          <span className="text-xs text-zinc-500 font-mono">Zero counts shown explicitly</span>
        </div>

        <div className="divide-y divide-zinc-900">
          {canonicalCitations.map((item) => {
            const count = data?.counts_by_citation[item.id] || 0;
            return (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-zinc-900 border border-zinc-800 text-teal-400">
                    {item.id}
                  </span>
                  <span className="text-zinc-200 font-medium">{item.label}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold text-zinc-500 bg-zinc-900">
                    {item.type}
                  </span>
                </div>
                <span
                  className={`font-mono font-bold px-2.5 py-0.5 rounded ${
                    count > 0 ? 'bg-teal-950 text-teal-400 border border-teal-800' : 'text-zinc-600'
                  }`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
