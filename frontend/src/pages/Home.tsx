import React, { useState } from 'react';
import { Brand, Draft, ApiConnectionStatus } from '../types';
import { api } from '../api/client';
import { ArrowRight, ShieldCheck, FileText, Sparkles, Loader2 } from 'lucide-react';

interface HomeProps {
  activeBrand: Brand | null;
  onDraftCreated: (draft: Draft) => void;
  apiStatus: ApiConnectionStatus;
}

export const Home: React.FC<HomeProps> = ({ activeBrand, onDraftCreated, apiStatus }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTryDemoDraft = async () => {
    setLoading(true);
    setError(null);

    const exactDemoText =
      "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!";

    try {
      let brandId = activeBrand?.id;

      // CRITICAL: Do NOT hard-code any brand ID. Dynamically resolve from API.
      if (!brandId) {
        const brands = await api.getBrands().catch(() => []);
        if (brands.length > 0) {
          brandId = brands[0].id;
        } else {
          // Fallback demo UUID for local demo mode if backend is unreachable
          brandId = '00000000-0000-0000-0000-000000000001';
        }
      }

      if (apiStatus === 'connected') {
        const newDraft = await api.createDraft({
          brand_id: brandId,
          title: 'Diwali Festive Cookware Campaign',
          body_text: exactDemoText,
          alt_text: null,
          image_url: null,
          created_by_role: 'guest',
        });
        onDraftCreated(newDraft);
      } else {
        // Local demo mode draft
        const localDraft: Draft = {
          id: `local-draft-${Date.now()}`,
          brand_id: brandId,
          title: 'Diwali Festive Cookware Campaign',
          body_text: exactDemoText,
          alt_text: null,
          image_url: null,
          status: 'draft',
          current_version: 1,
          created_by_role: 'guest',
          created_at: new Date().toISOString(),
          versions: [
            {
              version_no: 1,
              body_text: exactDemoText,
              alt_text: null,
              created_at: new Date().toISOString(),
            },
          ],
        };
        onDraftCreated(localDraft);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize demo draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
      {/* Hero Header */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-semibold tracking-wide uppercase">
          <ShieldCheck className="h-4 w-4" />
          Pre-Publication Brand Governance Gate
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-white">
          Brand<span className="text-teal-400">Gate</span>
        </h1>

        <p className="text-xl sm:text-2xl text-zinc-400 font-light max-w-2xl mx-auto">
          The gate every post must pass before it goes public.
        </p>

        {/* Hero Principle Banner */}
        <div className="inline-block p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-2xl">
          <div className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Core Guarantee
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            "No citation, no flag."
          </div>
          <p className="text-xs text-zinc-500 mt-1 max-w-md">
            A finding with no valid vault citation ID must NEVER be shown. Every flag is grounded in an approved rule.
          </p>
        </div>

        {/* Call to Action */}
        <div className="pt-6">
          <button
            onClick={handleTryDemoDraft}
            disabled={loading}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-lg shadow-xl shadow-teal-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing Draft...
              </>
            ) : (
              <>
                Try the demo draft
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/30 border border-red-900 p-2 rounded-lg max-w-md mx-auto">
            {error}
          </p>
        )}
      </div>

      {/* Feature Pillars */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-teal-400 mb-4 border border-zinc-800">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Brand Vault</h3>
          <p className="text-sm text-zinc-400 mt-2">
            Centralized truth for facts, guidelines, restricted terminology, and approved hex palettes.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-teal-400 mb-4 border border-zinc-800">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Deterministic Review</h3>
          <p className="text-sm text-zinc-400 mt-2">
            Instant server-side checks for pricing contradictions, ungrounded superlatives, and image alt text.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition-colors">
          <div className="h-10 w-10 rounded-lg bg-zinc-900 flex items-center justify-center text-teal-400 mb-4 border border-zinc-800">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold text-white">One-Click Fixes</h3>
          <p className="text-sm text-zinc-400 mt-2">
            Apply automated corrections to resolve contradictions while preserving clean version histories.
          </p>
        </div>
      </div>
    </div>
  );
};
