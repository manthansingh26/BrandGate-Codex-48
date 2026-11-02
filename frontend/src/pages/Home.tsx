import React, { useState, useEffect } from 'react';
import { Brand, Draft, ApiConnectionStatus } from '../types';
import { api } from '../api/client';
import { BrandGateLogo } from '../components/BrandGateLogo';
import { BrandSwitcher } from '../components/BrandSwitcher';
import { ArrowRight, ShieldCheck, FileText, Sparkles, Loader2, BookOpen, CheckCircle2, Lock, Zap, AlertTriangle, X } from 'lucide-react';

interface HomeProps {
  activeBrand: Brand | null;
  availableBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void | Promise<void>;
  onDraftCreated: (draft: Draft) => void;
  onNavigateToVault?: () => void;
  apiStatus: ApiConnectionStatus;
  currentDraft?: Draft | null;
}

export const Home: React.FC<HomeProps> = ({
  activeBrand,
  availableBrands,
  onSelectBrand,
  onDraftCreated,
  onNavigateToVault,
  apiStatus,
  currentDraft,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [targetBrandForReplace, setTargetBrandForReplace] = useState<Brand | null>(null);

  // Close replace modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowReplaceModal(false);
    };
    if (showReplaceModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReplaceModal]);

  const handleTryDemoDraft = (targetBrand?: Brand | React.MouseEvent | unknown) => {
    const brandToUse = (targetBrand && typeof targetBrand === 'object' && 'id' in targetBrand)
      ? (targetBrand as Brand)
      : activeBrand;
    if (currentDraft && currentDraft.brand_id === brandToUse?.id && currentDraft.status === 'approved') {
      setTargetBrandForReplace(brandToUse || null);
      setShowReplaceModal(true);
      return;
    }
    executeTryDemoDraft(brandToUse);
  };

  const handleJudgeStep1 = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const demoBrand = availableBrands?.find(
      (b) => b.id === '00000000-0000-0000-0000-000000000001'
    ) || { id: '00000000-0000-0000-0000-000000000001', name: 'Demo Brand (Seeded)', created_by: 'system' };

    // Force brand switch to Demo Brand first using the existing brand-switch mechanism
    if (onSelectBrand && activeBrand?.id !== demoBrand.id) {
      await onSelectBrand(demoBrand);
    }
    handleTryDemoDraft(demoBrand);
  };

  const executeTryDemoDraft = async (targetBrand?: Brand | null) => {
    setShowReplaceModal(false);
    setLoading(true);
    setError(null);
    setTargetBrandForReplace(null);

    const brandToUse = targetBrand || activeBrand;
    const isBrandB = brandToUse?.id === '00000000-0000-0000-0000-000000000002';
    const exactDemoText = isBrandB
      ? "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!"
      : "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!";
    const demoTitle = isBrandB
      ? "NovaTech ANC 500 Launch Campaign"
      : "Diwali Festive Cookware Campaign";

    try {
      let brandId = brandToUse?.id;

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
          title: demoTitle,
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
          title: demoTitle,
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

  const navigateTo = (path: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (typeof window !== 'undefined') {
      window.history.pushState({ path }, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-20 space-y-8 sm:space-y-16">
      {/* Hero Header */}
      <div className="flex flex-col items-center text-center space-y-3.5 sm:space-y-6 max-w-4xl mx-auto">
        <div className="order-1 inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 text-teal-300 text-[10px] sm:text-[11px] font-semibold tracking-wide uppercase shadow-sm">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
          Pre-Publication Brand Governance Gate
        </div>

        <h1 className="order-2 text-3xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.12] sm:leading-[1.08]">
          Protect Your Brand <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-teal-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
            Before It Goes Public.
          </span>
        </h1>

        <p className="order-3 text-xs sm:text-base lg:text-lg text-[#A2B0BD] font-normal max-w-2xl mx-auto leading-relaxed">
          The intelligent governance gate that halts pricing discrepancies, unsubstantiated rank superlatives, and accessibility defects before customer exposure.
        </p>

        {/* Workspace Brand Switcher */}
        {availableBrands && availableBrands.length > 0 && onSelectBrand && (
          <div className="order-3 w-fit max-w-full mx-auto p-2 sm:p-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 shadow-lg shadow-black/40">
            <BrandSwitcher
              availableBrands={availableBrands}
              activeBrand={activeBrand}
              onSelectBrand={onSelectBrand}
              variant="pills"
            />
          </div>
        )}

        {/* Double-Bezel Guarantee Card — order-5 on narrow mobile so CTA is above fold; sm:order-4 on desktop */}
        <div className="order-5 sm:order-4 double-bezel max-w-xl mx-auto text-left sm:text-center mt-3 sm:mt-6 w-full">
          <div className="double-bezel-inner p-5 sm:p-7 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl pointer-events-none"></div>
            <div className="flex items-center justify-start sm:justify-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-teal-400">
                Core Governance Guarantee
              </span>
            </div>
            <div className="text-xl sm:text-3xl font-black text-white tracking-tight">
              "No citation, no flag."
            </div>
            <p className="text-xs sm:text-sm text-[#A2B0BD] mt-2 leading-relaxed">
              Every flagged issue is strictly anchored to an active Brand Vault rule or fact record. Uncited opinions are never presented as governance policy.
            </p>
          </div>
        </div>

        {/* Call to Action Buttons — order-4 on narrow mobile (above fold); sm:order-5 on desktop */}
        <div className="order-4 sm:order-5 pt-1 sm:pt-2 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={handleTryDemoDraft}
            disabled={loading}
            className="btn-primary-micro group inline-flex items-center justify-center gap-3 pl-7 pr-2.5 py-2.5 rounded-full bg-teal-400 text-black font-extrabold text-sm shadow-xl shadow-teal-500/20 disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center gap-2 py-1 pr-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Preparing Demo Draft...
              </span>
            ) : (
              <>
                <span>Try {activeBrand?.name ? `${activeBrand.name} Draft` : 'the demo draft'}</span>
                <span className="w-8 h-8 rounded-full bg-black/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4 text-black" />
                </span>
              </>
            )}
          </button>

          {onNavigateToVault && (
            <button
              onClick={onNavigateToVault}
              className="btn-secondary-micro inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-zinc-900/90 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 text-sm font-semibold"
            >
              <BookOpen className="h-4 w-4 text-zinc-400" />
              Explore Brand Vault
            </button>
          )}
        </div>

        {error && (
          <p className="order-6 text-xs sm:text-sm text-red-400 bg-red-950/40 border border-red-900/60 p-3 rounded-xl max-w-md mx-auto">
            {error}
          </p>
        )}
      </div>

      {/* Judge? Start here in 60 seconds. Card */}
      <div
        id="judge-start-card"
        className="glass-card feature-card-micro max-w-2xl mx-auto w-full p-4 sm:p-5 rounded-2xl border border-teal-500/30 bg-[#0B1118]/90 shadow-xl shadow-black/40"
      >
        <div className="flex items-center gap-2 mb-2 pb-2.5 border-b border-white/[0.06]">
          <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse"></span>
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
            Judge? Start here in 60 seconds.
          </h2>
        </div>
        <ol className="space-y-1 text-left text-xs sm:text-sm">
          <li>
            <a
              href="/submit"
              onClick={handleJudgeStep1}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
            >
              <span className="font-medium break-words group-hover:underline decoration-teal-400/50 underline-offset-2">
                1. Try Demo Draft (goes to Submit with Demo draft)
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-teal-400 shrink-0 transition-colors" />
            </a>
          </li>
          <li>
            <a
              href="/report"
              onClick={(e) => navigateTo('/report', e)}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
            >
              <span className="font-medium break-words group-hover:underline decoration-teal-400/50 underline-offset-2">
                2. Review Draft (shows 1x F-12 + 2x R-04)
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-teal-400 shrink-0 transition-colors" />
            </a>
          </li>
          <li>
            <a
              href="/report"
              onClick={(e) => navigateTo('/report', e)}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
            >
              <span className="font-medium break-words group-hover:underline decoration-teal-400/50 underline-offset-2">
                3. Apply Fix (price, then superlatives)
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-teal-400 shrink-0 transition-colors" />
            </a>
          </li>
          <li>
            <a
              href="/review"
              onClick={(e) => navigateTo('/review', e)}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
            >
              <span className="font-medium break-words group-hover:underline decoration-teal-400/50 underline-offset-2">
                4. Request Approval (as Creator)
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-teal-400 shrink-0 transition-colors" />
            </a>
          </li>
          <li>
            <a
              href="/review"
              onClick={(e) => navigateTo('/review', e)}
              className="group flex items-center justify-between gap-3 p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-teal-500/10 border border-transparent hover:border-teal-500/20 transition-all"
            >
              <span className="font-medium break-words group-hover:underline decoration-teal-400/50 underline-offset-2">
                5. Switch to Reviewer → Approve → Locked Snapshot
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500 group-hover:text-teal-400 shrink-0 transition-colors" />
            </a>
          </li>
        </ol>
      </div>

      {/* Proof / Verification Metrics Strip (Linear-Style Ground Truth) */}
      <div className="pt-8 sm:pt-10 border-t border-[#1B2732] grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="feature-card-micro p-4 rounded-2xl bg-[#0B1118]/80 border border-white/[0.05]">
          <div className="text-xl sm:text-2xl font-black text-white font-mono">4 Categories</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">Facts • Rules • Terms • Palette</div>
        </div>
        <div className="feature-card-micro p-4 rounded-2xl bg-[#0B1118]/80 border border-white/[0.05]">
          <div className="text-xl sm:text-2xl font-black text-teal-400 font-mono">0 Uncited by design</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">Strict Evidence Filter</div>
        </div>
        <div className="feature-card-micro p-4 rounded-2xl bg-[#0B1118]/80 border border-white/[0.05]">
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">Deterministic</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">Server Verification Gate</div>
        </div>
        <div className="feature-card-micro p-4 rounded-2xl bg-[#0B1118]/80 border border-white/[0.05]">
          <div className="text-xl sm:text-2xl font-black text-[#5AF0D1] font-mono">Advisory AI</div>
          <div className="text-[11px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">Grounded Gemini Layer</div>
        </div>
      </div>

      {/* Feature Pillars — Double-Bezel Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="double-bezel feature-card-micro flex flex-col">
          <div className="double-bezel-inner p-7 flex-1 flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-5">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Brand Vault Truth Engine</h3>
              <p className="text-xs sm:text-sm text-[#A2B0BD] mt-2.5 leading-relaxed">
                Centralized ground-truth repository grouping promotional pricing facts (F-12), claim rules (R-04, A-02, R-09), restricted terminology, and approved hex color palettes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-teal-400 font-semibold font-mono">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Single Source of Truth
            </div>
          </div>
        </div>

        <div className="double-bezel feature-card-micro flex flex-col">
          <div className="double-bezel-inner p-7 flex-1 flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Deterministic Safety Gate</h3>
              <p className="text-xs sm:text-sm text-[#A2B0BD] mt-2.5 leading-relaxed">
                Primary server-side verification executing regex price matching, superlative claim checking, and alt-text accessibility rules — deterministic checks do not use model output.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-cyan-400 font-semibold font-mono">
              <Zap className="h-3.5 w-3.5" />
              Deterministic Enforcement
            </div>
          </div>
        </div>

        <div className="double-bezel feature-card-micro flex flex-col">
          <div className="double-bezel-inner p-7 flex-1 flex flex-col justify-between">
            <div>
              <div className="h-11 w-11 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-5">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">Grounded AI & Fix Engine</h3>
              <p className="text-xs sm:text-sm text-[#A2B0BD] mt-2.5 leading-relaxed">
                Secondary advisory suggestions powered by Google Gemini, grounded strictly in retrieved items, paired with instant one-click remediation and atomic versioning.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center gap-2 text-xs text-sky-400 font-semibold font-mono">
              <Lock className="h-3.5 w-3.5" />
              Citation-Validated Fixes
            </div>
          </div>
        </div>
      </div>

      {/* Refined Brand & Governance Footer */}
      <div className="pt-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#718190]">
        <BrandGateLogo size="xs" variant="full" />
        <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[11px]">
          <span>Single Source of Truth</span>
          <span className="hidden sm:inline">•</span>
          <span>Deterministic Primary Gate</span>
          <span className="hidden sm:inline">•</span>
          <span className="text-teal-400">Deterministic gate first; AI is advisory only and citation-validated</span>
        </div>
      </div>

      {/* Fix 2: Confirmation Modal when replacing an APPROVED draft */}
      {showReplaceModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowReplaceModal(false)}
        >
          <div
            className="glass-card p-6 sm:p-7 rounded-2xl border border-teal-500/30 max-w-lg w-full space-y-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-modal-title"
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="replace-modal-title" className="text-base font-bold text-white tracking-tight">
                    Replace Approved Draft?
                  </h3>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    LOCKED APPROVED SNAPSHOT active
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="icon-btn-micro p-1.5 rounded-lg text-zinc-400 hover:text-white"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed">
              {`This will replace your approved draft (Version ${currentDraft?.current_version || 1}, LOCKED APPROVED SNAPSHOT). Continue with a fresh demo draft, or Keep approved draft?`}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                className="btn-secondary-micro px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 text-xs font-semibold"
              >
                Keep approved draft
              </button>
              <button
                type="button"
                onClick={() => executeTryDemoDraft(targetBrandForReplace)}
                className="btn-primary-micro px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-xs shadow-lg shadow-teal-500/20"
              >
                Continue with a fresh demo draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
