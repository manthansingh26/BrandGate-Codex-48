import React, { useState } from 'react';
import { Draft, Finding, ApiConnectionStatus } from '../types';
import { api } from '../api/client';
import { runLocalDemoReview } from '../utils/localReviewEngine';
import { ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, Image as ImageIcon } from 'lucide-react';

interface SubmitProps {
  currentDraft: Draft | null;
  onReviewCompleted: (draft: Draft, findings: Finding[]) => void;
  apiStatus: ApiConnectionStatus;
}

export const Submit: React.FC<SubmitProps> = ({ currentDraft, onReviewCompleted, apiStatus }) => {
  const [title, setTitle] = useState(currentDraft?.title || 'Creative Draft');
  const [bodyText, setBodyText] = useState(
    currentDraft?.body_text ||
      "Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"
  );
  const [altText, setAltText] = useState(currentDraft?.alt_text || '');
  const [imagePreview, setImagePreview] = useState<string | null>(currentDraft?.image_url || null);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReview = async () => {
    if (!bodyText.trim()) {
      setError('Body text cannot be empty');
      return;
    }

    setReviewing(true);
    setError(null);

    try {
      let draftId = currentDraft?.id;

      if (apiStatus === 'connected') {
        // If draft hasn't been saved yet, create it first
        if (!draftId) {
          const created = await api.createDraft({
            brand_id: '00000000-0000-0000-0000-000000000001',
            title,
            body_text: bodyText,
            alt_text: altText || null,
            image_url: imagePreview,
          });
          draftId = created.id;
        }

        // Run server-side review
        const findings = await api.reviewDraft(draftId);
        const updatedDraft = await api.getDraft(draftId);
        onReviewCompleted(updatedDraft, findings);
      } else {
        // Local demo mode review (when API offline)
        const localFindings = runLocalDemoReview(bodyText, altText, imagePreview);
        const localDraft: Draft = {
          id: draftId || `local-${Date.now()}`,
          brand_id: '00000000-0000-0000-0000-000000000001',
          title,
          body_text: bodyText,
          alt_text: altText,
          image_url: imagePreview,
          status: 'checked',
          current_version: currentDraft?.current_version || 1,
          created_by_role: 'guest',
          versions: currentDraft?.versions || [
            {
              version_no: 1,
              body_text: bodyText,
              alt_text: altText,
              created_at: new Date().toISOString(),
            },
          ],
        };
        onReviewCompleted(localDraft, localFindings);
      }
    } catch (err: any) {
      setError(err.message || 'Review failed');
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-teal-400" />
          Submit Creative for Review
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Validate ad copy, promotions, and creative assets against brand vault rules prior to publication.
        </p>
      </div>

      {/* API Status Banner */}
      <div className="mb-6 p-3 rounded-xl border flex items-center justify-between text-xs bg-zinc-950 border-zinc-800">
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
              Waking up server...
            </span>
          )}
          {apiStatus === 'offline' && (
            <span className="text-amber-500 flex items-center gap-1 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              API offline — local demo mode (Deterministic browser check)
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submission Form */}
      <div className="space-y-6 bg-zinc-950 p-6 sm:p-8 rounded-2xl border border-zinc-800">
        <div>
          <label className="block text-sm font-semibold text-zinc-300 mb-1">Campaign Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
            placeholder="e.g. Diwali Cookware Festive Promotion"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-zinc-300">
              Creative Body Text <span className="text-red-400">*</span>
            </label>
            <span className="text-xs text-zinc-500">Tone checking: Rule-based phrase matching</span>
          </div>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="w-full p-4 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none h-32 leading-relaxed"
            placeholder="Enter advertising or social post copy..."
          />
        </div>

        {/* Image & Alt-Text Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-1">
              Creative Image (Optional)
            </label>
            <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center bg-black hover:border-zinc-700 transition-colors">
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Creative Preview"
                    className="max-h-36 mx-auto rounded-lg object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center justify-center py-4">
                  <ImageIcon className="h-8 w-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-zinc-400">Click to upload PNG or JPEG</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Logo checking: Reviewer-confirmed only — automatic logo verification is not claimed.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-1">
              Image Alt Text
            </label>
            <textarea
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descriptive text for accessibility (Rule R-09 requires alt text when image is present)..."
              className="w-full p-3 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none h-36 leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Review Button */}
        <div className="pt-4 border-t border-zinc-800 flex justify-end">
          <button
            onClick={handleReview}
            disabled={reviewing}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-bold text-base shadow-lg shadow-teal-500/20 active:scale-98 transition-all disabled:opacity-50"
          >
            {reviewing ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Analyzing against Brand Vault...
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5" />
                Review Draft
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
