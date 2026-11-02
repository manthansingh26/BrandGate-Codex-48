import React, { useState, useEffect } from 'react';
import { Draft, Finding, ApiConnectionStatus, Brand } from '../types';
import { api } from '../api/client';
import { supabase } from '../supabase';
import { runLocalDemoReview } from '../utils/localReviewEngine';
import { sampleImageColors, calculateContrastRatio, calculateSampledColorsContrast, ContrastResult, APPROVED_BRAND_PALETTE, APPROVED_BRAND_B_PALETTE } from '../utils/imageAnalysis';
import { BrandSwitcher } from '../components/BrandSwitcher';
import { ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, Image as ImageIcon, Eye, FileText, Upload, Info, AlertTriangle } from 'lucide-react';

const BRAND_B_ID = '00000000-0000-0000-0000-000000000002';

interface SubmitProps {
  currentDraft: Draft | null;
  onReviewCompleted: (draft: Draft, findings: Finding[], llmReview?: any) => void;
  apiStatus: ApiConnectionStatus;
  activeBrand?: Brand | null;
  availableBrands?: Brand[];
  onSelectBrand?: (brand: Brand) => void;
}

export const Submit: React.FC<SubmitProps> = ({
  currentDraft,
  onReviewCompleted,
  apiStatus,
  activeBrand,
  availableBrands,
  onSelectBrand,
}) => {
  const isBrandB = activeBrand?.id === BRAND_B_ID;
  const isDraftForActiveBrand = Boolean(currentDraft && currentDraft.brand_id === activeBrand?.id);

  const getInitialTitle = () => {
    if (isBrandB) {
      return isDraftForActiveBrand ? currentDraft?.title || '' : '';
    }
    return isDraftForActiveBrand ? (currentDraft?.title || 'Creative Draft') : 'Creative Draft';
  };

  const getInitialBody = () => {
    if (isBrandB) {
      return isDraftForActiveBrand ? currentDraft?.body_text || '' : '';
    }
    return isDraftForActiveBrand
      ? (currentDraft?.body_text || "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!")
      : "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!";
  };

  const [title, setTitle] = useState(getInitialTitle);
  const [bodyText, setBodyText] = useState(getInitialBody);
  const [altText, setAltText] = useState(() => (isDraftForActiveBrand ? currentDraft?.alt_text || '' : ''));
  const [imagePreview, setImagePreview] = useState<string | null>(() => (isDraftForActiveBrand ? currentDraft?.image_url || null : null));
  const [imageWasRemoved, setImageWasRemoved] = useState(false);
  const [logoConfirmed, setLogoConfirmed] = useState(false);
  const [sampledColors, setSampledColors] = useState<string[]>([]);
  const [isOffPalette, setIsOffPalette] = useState(false);
  const [contrastResult, setContrastResult] = useState<ContrastResult | null>(null);
  const [sampledContrastResult, setSampledContrastResult] = useState<ContrastResult | null>(null);
  const [paletteUnsampleable, setPaletteUnsampleable] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Document upload state (.docx / .pdf)
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPages, setDocPages] = useState<any[] | null>(null);
  const [docParsing, setDocParsing] = useState(false);
  const [docParsingElapsed, setDocParsingElapsed] = useState(0);
  const [docMeta, setDocMeta] = useState<{ filename: string; pageCount: number; fileType: string } | null>(null);
  const [unextractableImageNotice, setUnextractableImageNotice] = useState<string | null>(null);
  const [honestLimitWarning, setHonestLimitWarning] = useState<string | null>(null);

  // Timer for visible document parsing progress
  useEffect(() => {
    let timer: any = null;
    if (docParsing) {
      setDocParsingElapsed(0);
      timer = setInterval(() => {
        setDocParsingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setDocParsingElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [docParsing]);

  // Synchronize and completely reset form state when active brand or draft changes
  useEffect(() => {
    setTitle(getInitialTitle());
    setBodyText(getInitialBody());
    setAltText(isDraftForActiveBrand ? currentDraft?.alt_text || '' : '');
    setImagePreview(isDraftForActiveBrand ? currentDraft?.image_url || null : null);
    setImageWasRemoved(false);
    setLogoConfirmed(false);
    setSampledColors([]);
    setIsOffPalette(false);
    setContrastResult(null);
    setSampledContrastResult(null);
    setPaletteUnsampleable(false);
    setError(null);
    setDocFile(null);
    setDocPages(null);
    setDocParsing(false);
    setDocParsingElapsed(0);
    setDocMeta(null);
    setUnextractableImageNotice(null);
    setHonestLimitWarning(null);
  }, [activeBrand?.id, currentDraft?.id, currentDraft?.current_version, currentDraft?.image_url, currentDraft?.alt_text]);

  // Carried-over image sampling: re-sample persisted image_url so P-01 is never silently dropped
  useEffect(() => {
    if (isDraftForActiveBrand && currentDraft?.image_url && !imageWasRemoved) {
      const palette = isBrandB ? APPROVED_BRAND_B_PALETTE : APPROVED_BRAND_PALETTE;
      sampleImageColors(currentDraft.image_url, palette)
        .then((result) => {
          if (result.status === 'analyzed') {
            setSampledColors(result.sampledColors);
            setIsOffPalette(result.isOffPalette);
            if (result.sampledColors.length >= 2) {
              setSampledContrastResult(calculateSampledColorsContrast(result.sampledColors));
            }
          }
        })
        .catch((err) => {
          console.warn('Carried-over image sampling fallback:', err);
        });
    }
  }, [currentDraft?.id, currentDraft?.image_url, isDraftForActiveBrand, isBrandB, imageWasRemoved]);

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setHonestLimitWarning(null);
    setUnextractableImageNotice(null);

    // Validate document file size (<= 10MB limit shown BEFORE upload)
    if (file.size > 10 * 1024 * 1024) {
      setError('Document file exceeds the 10MB limit. Please upload a document under 10MB.');
      return;
    }

    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.docx') && !lower.endsWith('.pdf')) {
      setError('Invalid document format. Only .docx and .pdf files are accepted.');
      return;
    }

    setDocFile(file);
    setDocParsing(true);
    setError(null);
    setHonestLimitWarning(null);
    setUnextractableImageNotice(null);

    try {
      if (apiStatus === 'connected') {
        const parseResult = await api.parseDocument(file, activeBrand?.id);

        // Honest limits check: document with no text layer
        if (!parseResult.has_text_layer) {
          const msg = parseResult.file_type === 'docx'
            ? 'DOCX document contains no extractable text — please upload a document with text content.'
            : 'Scanned-image PDF with no text layer detected — OCR is not supported in this phase. The document cannot be text-checked.';
          setHonestLimitWarning(msg);
          setBodyText('');
          return;
        }

        setBodyText(parseResult.text);
        setDocPages(parseResult.pages || null);
        if (!title || title === 'Creative Draft' || title === 'Diwali Festive Cookware Campaign' || title === 'NovaTech ANC 500 Launch Campaign') {
          const autoTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          setTitle(autoTitle);
        }

        setDocMeta({
          filename: file.name,
          pageCount: parseResult.page_count,
          fileType: parseResult.file_type,
        });

        // Handle extracted images
        if (parseResult.images && parseResult.images.length > 0) {
          const firstImg = parseResult.images[0];
          setImagePreview(firstImg.data_url);
          const colors = firstImg.sampled_colors || [];
          setSampledColors(colors);
          setIsOffPalette(Boolean(firstImg.is_off_palette));
          if (colors.length >= 2) {
            setSampledContrastResult(calculateSampledColorsContrast(colors));
          } else {
            setSampledContrastResult(null);
          }
          if (colors.length === 0) {
            setPaletteUnsampleable(true);
          } else {
            setPaletteUnsampleable(false);
          }
        }

        // Handle unextractable images: honest notice, never a fake pass
        if (parseResult.images_unextractable) {
          setPaletteUnsampleable(true);
          setUnextractableImageNotice(
            parseResult.unextractable_reason || 'Could not sample — human decision'
          );
        }
      } else {
        setError('Document parsing requires active BrandGate API connection.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract text from document');
    } finally {
      setDocParsing(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate image format and file size (<= 5MB) (Blocker 3)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid image format. Allowed formats: PNG, JPEG, WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file exceeds the 5MB size limit. Please upload an image under 5MB.');
      return;
    }

    setUploading(true);

    try {
      // 1. Read file as durable Base64 Data URL (ensures image survives even without external S3)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setImagePreview(dataUrl);

      // 2. Perform client-side canvas palette extraction (Approximate)
      const currentBrandPalette = isBrandB ? ['#06B6D4', '#0B0F19'] : APPROVED_BRAND_PALETTE;
      const paletteAnalysis = await sampleImageColors(dataUrl, currentBrandPalette);
      if (paletteAnalysis.status === 'unavailable' || paletteAnalysis.sampledColors.length === 0) {
        setPaletteUnsampleable(true);
        setSampledColors([]);
        setIsOffPalette(false);
        setSampledContrastResult(null);
      } else {
        setPaletteUnsampleable(false);
        setSampledColors(paletteAnalysis.sampledColors);
        setIsOffPalette(paletteAnalysis.isOffPalette);
        setSampledContrastResult(calculateSampledColorsContrast(paletteAnalysis.sampledColors));
      }

      // 3. If Supabase client is configured, upload to public bucket "brandgate-creatives"
      if (supabase) {
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `creative-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('brandgate-creatives')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage
              .from('brandgate-creatives')
              .getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
              setImagePreview(publicUrlData.publicUrl);
            }
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload fallback to durable data URL:', storageErr);
        }
      }
    } catch (err: any) {
      console.warn('Image upload fallback to local preview:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleContrastTest = (textHex: string, bgHex: string) => {
    setContrastResult(calculateContrastRatio(textHex, bgHex));
  };

  const handleReview = async () => {
    if (reviewing || docParsing) return;
    if (!bodyText.trim() && !docFile) {
      setError('Add draft text or upload a document before reviewing.');
      return;
    }

    setReviewing(true);
    setError(null);

    try {
      const targetBrandId = activeBrand?.id || '00000000-0000-0000-0000-000000000001';
      const defaultFallbackTitle = isBrandB ? 'NovaTech ANC 500 Launch Campaign' : 'Diwali Festive Cookware Campaign';
      const imageRemoved = Boolean(imageWasRemoved || (currentDraft?.image_url && !imagePreview));
      const durableImageUrl = imageRemoved ? null : (imagePreview || null);

      if (apiStatus === 'connected') {
        // Unconditional Document Upload: .docx and .pdf uploads always create a fresh draft with target brand
        if (docFile) {
          const uploadRes = await api.uploadDraftDocument(docFile, targetBrandId, {
            title: title || defaultFallbackTitle,
            altText: altText || undefined,
            logoConfirmed: logoConfirmed,
            bodyText: bodyText,
          });
          let resolvedDraft: Draft;
          if (uploadRes.draft && uploadRes.draft.id) {
            resolvedDraft = {
              ...uploadRes.draft,
              id: uploadRes.draft.id || uploadRes.id || uploadRes.draft_id,
              brand_id: uploadRes.draft.brand_id || targetBrandId,
              title: uploadRes.draft.title || title || defaultFallbackTitle,
              body_text: uploadRes.draft.body_text || bodyText,
              status: uploadRes.draft.status || 'checked',
              findings: uploadRes.findings || uploadRes.draft.findings || [],
              versions: uploadRes.draft.versions || [
                { version_no: 1, body_text: bodyText, created_at: new Date().toISOString() },
              ],
            };
          } else {
            const uploadDraftId = uploadRes.id || uploadRes.draft_id;
            if (!uploadDraftId) {
              throw new Error('Document uploaded but no draft ID returned by server');
            }
            resolvedDraft = await api.getDraft(uploadDraftId);
          }
          const findingsList = uploadRes.findings || resolvedDraft.findings || [];
          onReviewCompleted(resolvedDraft, findingsList, uploadRes.llm_review);
          return;
        }

        // Text draft review path: after approval or brand mismatch, start a fresh draft
        let draftId =
          currentDraft?.status === 'approved' || currentDraft?.brand_id !== targetBrandId
            ? null
            : currentDraft?.id;

        // If draft hasn't been created yet, create it
        const effectiveAltText = imageRemoved ? null : altText;
        const hasImageChanged =
          imageRemoved ||
          imagePreview !== (currentDraft?.image_url || null);
        const hasAltChanged =
          (effectiveAltText || '') !== (currentDraft?.alt_text || '');
        const hasBodyChanged =
          bodyText !== currentDraft?.body_text;

        if (!draftId) {
          const created = await api.createDraft({
            brand_id: targetBrandId,
            title: title || defaultFallbackTitle,
            body_text: bodyText,
            alt_text: effectiveAltText,
            image_url: durableImageUrl,
            created_by_role: 'guest',
          });
          draftId = created.id;
        } else if (hasBodyChanged || hasImageChanged || hasAltChanged) {
          // Save latest editor text and image adjustments before review executes
          try {
            const revised = await api.reviseDraft(draftId, {
              body_text: bodyText,
              alt_text: effectiveAltText,
              image_url: durableImageUrl,
              remove_image: imageRemoved,
            });
            draftId = revised.id || (revised as any).draft_id || draftId;
          } catch (reviseErr) {
            console.warn('Revise draft failed on stale ID, falling back to fresh draft:', reviseErr);
            const created = await api.createDraft({
              brand_id: targetBrandId,
              title: title || defaultFallbackTitle,
              body_text: bodyText,
              alt_text: effectiveAltText,
              image_url: durableImageUrl,
              created_by_role: 'guest',
            });
            draftId = created.id;
          }
        }

        // Guarantee draft ID is non-null before review and image operations
        if (!draftId) {
          throw new Error('Failed to resolve draft ID for review.');
        }

        // Attach image metadata if durable image URL is present and not removed
        if (durableImageUrl && !imageRemoved) {
          await api.attachImage(draftId, {
            image_url: durableImageUrl,
            alt_text: effectiveAltText,
            logo_confirmed: logoConfirmed,
          }).catch((err) => console.warn('attachImage non-fatal fallback:', err));
        }

        // Run server-side review with image checks wired and docPages passed
        const activeContrast = sampledContrastResult ? sampledContrastResult.ratio : (contrastResult ? contrastResult.ratio : undefined);
        const reviewRes = await api.reviewDraft(draftId, {
          logo_confirmed: logoConfirmed,
          palette_off: isOffPalette,
          contrast_ratio: activeContrast,
          palette_unsampleable: paletteUnsampleable,
          pages: docPages || undefined,
          image_url: durableImageUrl,
          alt_text: effectiveAltText,
          remove_image: imageRemoved,
        });
        const updatedDraft = await api.getDraft(draftId);

        // Fix 2: Image and alt text shown on Submit at review time MUST be the image/alt stored for the NEW version
        if (imageRemoved) {
          updatedDraft.image_url = null;
          updatedDraft.alt_text = null;
        } else {
          if (durableImageUrl) {
            updatedDraft.image_url = durableImageUrl;
          }
          updatedDraft.alt_text = effectiveAltText && effectiveAltText.trim() ? effectiveAltText : null;
        }

        // Ensure latest version entry also reflects this version's image and alt text
        if (updatedDraft.versions && updatedDraft.versions.length > 0) {
          const latestV = updatedDraft.versions[updatedDraft.versions.length - 1];
          if (latestV) {
            latestV.alt_text = updatedDraft.alt_text;
          }
        }

        // Ensure image findings (R-09, P-01/P-10) are present on off-palette / blank alt, never duplicate
        let findingsList = reviewRes.findings || [];
        if (durableImageUrl && !imageRemoved) {
          if (!effectiveAltText || !effectiveAltText.trim()) {
            if (!findingsList.some((f) => f.citation_id === 'R-09')) {
              findingsList.push({
                id: `finding-r09-${Date.now()}`,
                draft_id: draftId,
                brand_id: targetBrandId,
                version_no: updatedDraft.current_version,
                lane: 'human_decision',
                severity: 'high',
                citation_id: 'R-09',
                explanation: 'Image asset attached but descriptive alt text is blank, violating accessibility rule R-09.',
                suggested_fix: 'Add concise descriptive alt text',
              });
            }
          }
          if (isOffPalette && !findingsList.some((f) => f.citation_id === 'P-01' || f.citation_id === 'P-10')) {
            findingsList.push({
              id: `finding-p01-${Date.now()}`,
              draft_id: draftId,
              brand_id: targetBrandId,
              version_no: updatedDraft.current_version,
              lane: 'human_decision',
              severity: 'low',
              citation_id: isBrandB ? 'P-10' : 'P-01',
              explanation: 'Sampling: Approximate — reviewer to confirm brand color alignment with approved palette.',
              suggested_fix: null,
            });
          }
        } else if (imageRemoved) {
          findingsList = findingsList.filter(
            (f) => !['P-01', 'P-10', 'A-02', 'R-09'].includes(f.citation_id)
          );
        }

        onReviewCompleted(updatedDraft, findingsList, reviewRes.llm_review);
      } else {
        // Local demo mode review (when API offline)
        let draftId =
          currentDraft?.status === 'approved' || currentDraft?.brand_id !== targetBrandId
            ? null
            : currentDraft?.id;
        const effectiveImg = imageRemoved ? null : imagePreview;
        const localAlt = imageRemoved ? null : (altText.trim() ? altText : null);
        const hasImageChanged =
          imageRemoved ||
          imagePreview !== (currentDraft?.image_url || null);
        const hasAltChanged =
          (localAlt || '') !== (currentDraft?.alt_text || '');
        const hasBodyChanged =
          bodyText !== currentDraft?.body_text;
        const shouldIncrementVersion = Boolean(
          currentDraft && (hasBodyChanged || hasImageChanged || hasAltChanged)
        );
        const newVersion = shouldIncrementVersion
          ? (currentDraft?.current_version || 1) + 1
          : (currentDraft?.current_version || 1);

        const localFindings = runLocalDemoReview(
          bodyText,
          localAlt,
          effectiveImg,
          undefined,
          targetBrandId,
          isOffPalette
        );
        const localDraft: Draft = {
          id: draftId || `local-${Date.now()}`,
          brand_id: targetBrandId,
          title: title || defaultFallbackTitle,
          body_text: bodyText,
          alt_text: localAlt,
          image_url: effectiveImg,
          status: 'checked',
          current_version: newVersion,
          created_by_role: 'guest',
          versions: shouldIncrementVersion && currentDraft?.versions
            ? [
                ...currentDraft.versions,
                {
                  version_no: newVersion,
                  body_text: bodyText,
                  alt_text: localAlt,
                  created_at: new Date().toISOString(),
                },
              ]
            : (currentDraft?.versions || [
                {
                  version_no: 1,
                  body_text: bodyText,
                  alt_text: localAlt,
                  created_at: new Date().toISOString(),
                },
              ]),
        };
        onReviewCompleted(localDraft, localFindings);
      }
    } catch (err: any) {
      console.error('Submit review failure:', err);
      setError(err.message || 'Review failed');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-teal-400" />
            Submit Creative for Review
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Validate ad copy, promotions, and creative assets against brand vault rules prior to publication.
          </p>
        </div>

        {availableBrands && availableBrands.length > 0 && onSelectBrand && (
          <BrandSwitcher
            availableBrands={availableBrands}
            activeBrand={activeBrand || null}
            onSelectBrand={onSelectBrand}
            variant="compact"
          />
        )}
      </div>

      {/* API Status Banner */}
      <div className="mb-6 p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs bg-zinc-950 border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-400">Review Engine:</span>
          {apiStatus === 'connected' && (
            <span className="text-teal-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              API connected (FastAPI server-side validation)
            </span>
          )}
          {apiStatus === 'waking' && (
            <span className="text-amber-400 flex items-center gap-1 font-medium">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Waking up server... please wait, retrying...
            </span>
          )}
          {apiStatus === 'blocked_by_client' && (
            <span className="text-red-400 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Connection blocked by browser extension — disable ad blocker / Brave Shield for this site, then click Retry
            </span>
          )}
          {apiStatus === 'cors_error' && (
            <span className="text-red-400 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              Connection blocked (CORS) — check FRONTEND_URL in Render
            </span>
          )}
          {apiStatus === 'offline' && (
            <span className="text-amber-500 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              API offline — local demo mode (Deterministic browser check)
            </span>
          )}
        </div>

        {apiStatus !== 'connected' && (
          <button
            onClick={handleReview}
            disabled={reviewing}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-teal-400 border border-zinc-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry Review
          </button>
        )}
      </div>

      {currentDraft?.status === 'approved' && (
        <div className="mb-6 p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
          <span>
            {`Previous draft was approved (Version ${currentDraft.current_version}, LOCKED APPROVED SNAPSHOT). Submitting here will create a fresh draft.`}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300">Review Request Failed</p>
              <p className="text-xs text-red-200/80 mt-0.5">{error}. You can retry the review immediately.</p>
            </div>
          </div>
          <button
            onClick={() => {
              setError(null);
              handleReview();
            }}
            disabled={reviewing || docParsing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-800/80 hover:bg-red-700 text-white text-xs font-bold transition-colors flex-shrink-0 border border-red-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reviewing ? 'animate-spin' : ''}`} />
            Retry Review
          </button>
        </div>
      )}

      {/* Submission Form Container */}
      <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/[0.08] space-y-6 shadow-2xl">
        {/* Document Draft Ingestion Dropzone */}
        <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload Document Draft (.docx or .pdf)
              </span>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                DOCX paragraphs and PDF pages go through the same deterministic brand governance gate.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-mono font-bold bg-teal-950/60 text-teal-300 border border-teal-800/60">
                Max file size: 10MB • Formats: .docx, .pdf
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-teal-300 border border-teal-500/30 text-xs font-bold transition-colors">
              {docParsing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-400" />
                  <span>{`Extracting document... (${docParsingElapsed}s)`}</span>
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>Choose .docx or .pdf file</span>
                </>
              )}
              <input
                type="file"
                accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleDocumentChange}
                disabled={docParsing}
                className="hidden"
              />
            </label>

            {docMeta && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-950/40 border border-teal-800/50 text-xs font-mono text-teal-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
                <span>{docMeta.filename}</span>
                {docMeta.fileType === 'pdf' && (
                  <span className="text-teal-400/80">({docMeta.pageCount} page{docMeta.pageCount > 1 ? 's' : ''})</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDocMeta(null);
                    setDocFile(null);
                    setUnextractableImageNotice(null);
                    setHonestLimitWarning(null);
                  }}
                  className="text-zinc-500 hover:text-red-400 ml-1 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Honest Limits Notice */}
          <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-zinc-300 font-semibold">Honest Governance Limit:</strong> A scanned-image PDF with no text layer is NOT text-checked in this phase (no OCR). Only documents with an extractable text layer are checked against vault rules. Embedded images are extracted for palette and accessibility checks where possible.
            </span>
          </div>

          {honestLimitWarning && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-400" />
              <span>{honestLimitWarning}</span>
            </div>
          )}

          {unextractableImageNotice && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400" />
              <span>{unextractableImageNotice}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
            Campaign / Creative Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 bg-black/60 border border-zinc-800 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none transition-colors"
            placeholder={isBrandB ? "e.g. NovaTech ANC 500 Launch Campaign" : "e.g. Diwali Cookware Festive Promotion"}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
              Creative Body Copy <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
              <span>{bodyText.trim() ? bodyText.trim().split(/\s+/).length : 0} words</span>
              <span>•</span>
              <span>{bodyText.length} chars</span>
              <span>•</span>
              {isBrandB ? (
                <span className="text-teal-400 font-medium">Rules active: F-20 pricing • R-15 lab benchmarks • T-10 terminology</span>
              ) : (
                <span className="text-teal-400">Rules active: R-04 superlatives</span>
              )}
            </div>
          </div>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="w-full p-4 bg-black/60 border border-zinc-800 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none h-36 leading-relaxed font-sans transition-colors"
            placeholder={
              isBrandB
                ? "Enter NovaTech audio advertising, promotional specs, or launch copy (enforces F-20, R-15, T-10)..."
                : "Enter advertising, promotional, or social post copy..."
            }
          />
        </div>

        {/* Image & Alt-Text Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Left Column: Image Upload & Visual Analysis */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Creative Image Asset
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">Max 5MB • PNG, JPEG, WebP</span>
              </div>
              <div className="border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-center bg-black/40 transition-colors">
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Creative Preview"
                      className="max-h-40 mx-auto rounded-lg object-contain border border-zinc-800 bg-black/60"
                    />
                    <div className="flex items-center justify-center gap-4 text-xs font-mono">
                      {imagePreview.startsWith('http') && (
                        <a
                          href={imagePreview}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Eye className="h-3 w-3" />
                          Public Asset URL
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview(null);
                          setImageWasRemoved(true);
                          setSampledColors([]);
                          setIsOffPalette(false);
                          setSampledContrastResult(null);
                          setContrastResult(null);
                        }}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block py-6">
                    <ImageIcon className="h-10 w-10 text-zinc-600 mx-auto mb-2" />
                    <span className="text-xs text-zinc-300 font-semibold block">
                      {uploading ? 'Uploading to Supabase Storage...' : 'Click or drop creative file to attach'}
                    </span>
                    <span className="text-[11px] text-zinc-500 mt-1 block">
                      Enforces color palette, contrast ratio, and logo compliance
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageChange}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Unsampleable Palette Notice */}
            {paletteUnsampleable && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-200 block">Could not sample — human decision</span>
                  <p className="text-[11px] text-amber-400/80 mt-0.5">
                    Image color palette could not be automatically extracted. Reviewer manual verification required against approved brand palette.
                  </p>
                </div>
              </div>
            )}

            {/* Extracted Color Palette Preview */}
            {sampledColors.length > 0 && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-300">Dominant Sampled Colors</span>
                  <span className="text-[10px] text-zinc-400 font-mono">Sampling: Approximate</span>
                </div>
                <div className="flex items-center gap-2">
                  {sampledColors.map((hex, idx) => (
                    <div key={idx} className="flex-1 text-center">
                      <div className="h-8 rounded-lg mb-1 border border-white/10" style={{ backgroundColor: hex }}></div>
                      <span className="text-[10px] font-mono text-zinc-400 block">{hex}</span>
                    </div>
                  ))}
                </div>

                {/* Sampled Contrast Check showing AA 4.5:1 threshold */}
                {sampledContrastResult && (
                  <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-1 text-xs font-mono">
                    <span className="text-zinc-400">Sampled Contrast:</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sampledContrastResult.passesAA
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950/80 text-red-400 border border-red-800'
                      }`}
                    >
                      {sampledContrastResult.ratioString} ({sampledContrastResult.passesAA ? 'Passes AA' : 'Fails AA'}) • Threshold: 4.5:1
                    </span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                  <span>WCAG AA 4.5:1 contrast threshold</span>
                  <span>Logo (A-02): Reviewer-confirmed only</span>
                </div>

                {isOffPalette && (
                  <p className="text-[11px] text-amber-400 flex items-center gap-1 font-medium pt-1">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    Sampling: Approximate — Human Decision required (Rule {isBrandB ? 'P-10' : 'P-01'}). Never an automatic contradiction.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Alt Text & Logo Check */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Image Alt Text {!isBrandB && <span className="text-zinc-500 font-normal font-mono">(Rule R-09)</span>}
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {isBrandB ? 'Accessibility standard' : 'Accessibility mandatory'}
                </span>
              </div>
              <textarea
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder={
                  isBrandB
                    ? "Descriptive text for accessibility image asset..."
                    : "Descriptive text for accessibility. Rule R-09 requires descriptive alt text when an image is present..."
                }
                className="w-full p-3 bg-black/60 border border-zinc-800 rounded-xl text-white text-xs focus:border-teal-500 focus:outline-none h-24 leading-relaxed font-sans transition-colors"
              />
            </div>

            {!isBrandB ? (
              /* Logo Check Reviewer Confirmation Checkbox (A-02) */
              <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={logoConfirmed}
                    onChange={(e) => setLogoConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 text-teal-400 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">
                      Confirm approved current logo file (Rule A-02)
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-normal mt-0.5">
                      Archived logos are rejected. Logo checking is reviewer-confirmed only — automatic logo verification is never claimed.
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              /* NovaTech Brand B Visual Palette Rules (P-10 & P-11) */
              <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 space-y-1.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
                  NovaTech Approved Palette (Rules P-10 & P-11)
                </div>
                <p className="text-[11px] text-zinc-400 leading-normal">
                  Visual checks enforce Cyan Accent (<span className="text-cyan-400 font-mono">#06B6D4</span>) and Obsidian Deep (<span className="text-zinc-300 font-mono">#0B0F19</span>) with WCAG 2.1 contrast ratio verification.
                </p>
              </div>
            )}

            {/* WCAG Contrast Ratio Checker Tool */}
            <div className="p-4 rounded-xl bg-black/40 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-300">WCAG 2.1 Contrast Benchmark Tool</span>
                {contrastResult ? (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      contrastResult.passesAA
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
                        : 'bg-red-950/80 text-red-400 border border-red-800'
                    }`}
                  >
                    {contrastResult.ratioString} ({contrastResult.passesAA ? 'Passes AA' : 'Fails AA'})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800">
                    Not tested yet — run a test
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => handleContrastTest('#000000', '#FFFFFF')}
                  className="px-2.5 py-1 rounded bg-black border border-zinc-700 text-white hover:border-teal-500"
                >
                  Test Baseline: Black on White (21:1)
                </button>
                <button
                  type="button"
                  onClick={() => handleContrastTest('#888888', '#FFFFFF')}
                  className="px-2.5 py-1 rounded bg-black border border-zinc-700 text-zinc-400 hover:border-red-500"
                >
                  Test Low Contrast: Gray on White (3.5:1)
                </button>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Standard baseline: Black on white = 21:1. Minimum AA threshold = 4.5:1.
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-zinc-500 font-mono flex items-center gap-3">
            <span>Deterministic engine</span>
            <span>•</span>
            <span>Grounded Gemini review</span>
            <span>•</span>
            <span>Citation validator</span>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            {!bodyText.trim() && !docParsing && (
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Add draft text or upload a document before reviewing.
              </span>
            )}
            <button
              onClick={handleReview}
              disabled={reviewing || docParsing || (!bodyText.trim() && !docFile)}
              className="btn-primary-micro inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-sm shadow-xl shadow-teal-500/20 disabled:opacity-50"
            >
              {docParsing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-teal-900" />
                  Extracting Document...
                </>
              ) : reviewing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Analyzing against Brand Vault...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Review Draft
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

