import React, { useState } from 'react';
import { Brand, Draft, ApiConnectionStatus } from '../types';
import { api } from '../api/client';
import { ArrowRight, ShieldCheck, FileText, Sparkles, Loader2, BookOpen, CheckCircle2, Lock, Zap } from 'lucide-react';

interface HomeProps {
  activeBrand: Brand | null;
  onDraftCreated: (draft: Draft) => void;
  onNavigateToVault?: () => void;
  apiStatus: ApiConnectionStatus;
}

export const Home: React.FC<HomeProps> = ({ activeBrand, onDraftCreated, onNavigateToVault, apiStatus }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTryDemoDraft = async () => {
    setLoading(true);
    setError(null);

    const exactDemoText =
      "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!";

    try {
      let brandId = activeBrand?.id;

      if (!brandId) {
        const brands = await api.getBrands().catch(() => []);
        if (brands.length > 0) {
          brandId = brands[0].id;
        } else {
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      {/* Hero Header */}
      <div className="text-center space-y-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-semibold tracking-wide uppercase shadow-sm shadow-teal-500/10">
          <ShieldCheck className="h-4 w-4 text-teal-400" />
          Pre-Publication Brand Governance Gate
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
          Protect Your Brand <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-teal-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Before It Goes Public.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 font-normal max-w-2xl mx-auto leading-relaxed">
          The intelligent governance gate that halts pricing discrepancies, unsubstantiated rank superlatives, and accessibility defects before customer exposure.
        </p>

        {/* Hero Principle Banner */}
        <div className="glass-card p-6 sm:p-7 rounded-2xl border border-teal-500/20 shadow-2xl max-w-xl mx-auto relative overflow-hidden text-left sm:text-center">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl pointer-events-none"></div>
          <div className="flex items-center justify-start sm:justify-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-teal-400">
              Core Guarantee
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            "No citation, no flag."
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            A finding with no valid vault citation ID must NEVER be shown. Every flag is strictly grounded in an active brand-vault record.
          </p>
        </div>

        {/* Call to Action Buttons */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={handleTryDemoDraft}
            disabled={loading}
            className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-base shadow-xl shadow-teal-500/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Preparing Demo Draft...
              </>
            ) : (
              <>
                Try the demo draft
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          {onNavigateToVault && (
            <button
              onClick={onNavigateToVault}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-base font-semibold transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:outline-none"
            >
              <BookOpen className="h-5 w-5 text-zinc-400" />
              Explore Brand Vault
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-900/60 p-3 rounded-xl max-w-md mx-auto">
            {error}
          </p>
        )}
      </div>

      {/* Proof / Verification Metrics Strip */}
      <div className="mt-16 pt-10 border-t border-zinc-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900">
          <div className="text-2xl font-black text-white font-mono">4 Types</div>
          <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Vault Ground Truth</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900">
          <div className="text-2xl font-black text-teal-400 font-mono">0 Uncited</div>
          <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Flags Allowed</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900">
          <div className="text-2xl font-black text-emerald-400 font-mono">100%</div>
          <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Server-Side Verified</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900">
          <div className="text-2xl font-black text-white font-mono">₹0.00</div>
          <div className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">Free-Tier Cost</div>
        </div>
      </div>

      {/* Feature Pillars — Linear/Stripe Bento Grid */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card glass-card-hover p-7 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-5">
              <FileText className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Brand Vault Truth Engine</h3>
            <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed">
              Centralized ground-truth repository grouping promotional pricing facts (F-12), claim rules (R-04, A-02, R-09), restricted terminology, and approved hex color palettes.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-teal-400 font-semibold font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Single Source of Truth
          </div>
        </div>

        <div className="glass-card glass-card-hover p-7 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-5">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Deterministic Safety Gate</h3>
            <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed">
              Primary server-side verification executing regex price matching, superlative claim checking, and alt-text accessibility rules without model hallucinations.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-blue-400 font-semibold font-mono">
            <Zap className="h-3.5 w-3.5" />
            Deterministic Enforcement
          </div>
        </div>

        <div className="glass-card glass-card-hover p-7 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-5">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Grounded AI & One-Click Fixes</h3>
            <p className="text-sm text-zinc-400 mt-2.5 leading-relaxed">
              Secondary advisory suggestions powered by Google Gemini, grounded strictly in retrieved items, paired with instant one-click remediation and atomic versioning.
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-purple-400 font-semibold font-mono">
            <Lock className="h-3.5 w-3.5" />
            Citation-Validated Fixes
          </div>
        </div>
      </div>
    </div>
  );
};
