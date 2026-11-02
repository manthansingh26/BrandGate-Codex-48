import React from 'react';
import { renderToString } from 'react-dom/server';
import { Report } from '../frontend/src/pages/Report';
import { Draft, Finding, VaultItem } from '../frontend/src/types';
import { sampleImageColors } from '../frontend/src/utils/imageAnalysis';
import { runLocalDemoReview } from '../frontend/src/utils/localReviewEngine';
import {
  applyImageUpload,
  applyImageRemoval,
  resolveReviewImage,
} from '../frontend/src/utils/imageUploadState';
import {
  extractHexCodesFromVaultPalette,
  fallbackPaletteHexesForBrand,
} from '../frontend/src/utils/brandPalette';

// Lightweight DOM mock for Node.js environment to test sampleImageColors
if (typeof (global as any).Image === 'undefined') {
  (global as any).Image = class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    crossOrigin: string = '';
    private _src: string = '';
    set src(value: string) {
      this._src = value;
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
    get src() {
      return this._src;
    }
  };
}
if (typeof (global as any).document === 'undefined') {
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: () => {},
            getImageData: () => {
              // Solid #FF0060 (255, 0, 96, 255)
              const length = 50 * 50 * 4;
              const data = new Uint8ClampedArray(length);
              for (let i = 0; i < length; i += 4) {
                data[i] = 255;
                data[i + 1] = 0;
                data[i + 2] = 96;
                data[i + 3] = 255;
              }
              return { data };
            },
          }),
        };
      }
      return {};
    },
  };
}

const BRAND_A_ID = '00000000-0000-0000-0000-000000000001';
const BRAND_B_ID = '00000000-0000-0000-0000-000000000002';

const offPalettePinkPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const onPaletteBluePng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const cleanBody =
  'Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!';

async function runPhase63Tests() {
  console.log('======================================================================');
  console.log('PHASE 6.3 — FIX VERIFICATION AUTOMATED SELF-TESTS');
  console.log('======================================================================');

  let passed = 0;
  let total = 0;
  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      console.error(`FAIL: ${message}`);
      throw new Error(`FAIL: ${message}`);
    }
    passed++;
    console.log(`PASS: ${message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 1: Remove-then-reupload in the same session gives R-09 + P-01
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Remove Image -> re-upload off-palette in the same session ---');

  // Version 3 starts with an on-palette image and valid alt text.
  let sessionImageState = applyImageUpload(onPaletteBluePng);
  let v3ReviewImage = resolveReviewImage({
    ...sessionImageState,
    currentDraftImageUrl: onPaletteBluePng,
  });
  assert(v3ReviewImage.imageRemoved === false, 'Initial on-palette image is NOT treated as removed');
  assert(v3ReviewImage.durableImageUrl === onPaletteBluePng, 'Initial on-palette image is the review image');

  // Remove Image with no re-upload: still removed.
  sessionImageState = applyImageRemoval();
  const removedReviewImage = resolveReviewImage({
    ...sessionImageState,
    currentDraftImageUrl: onPaletteBluePng,
  });
  assert(removedReviewImage.imageRemoved === true, 'Remove Image without re-upload stays removed');
  assert(removedReviewImage.durableImageUrl === null, 'Remove Image without re-upload has no image URL');

  const removalFindings = runLocalDemoReview(
    cleanBody,
    null,
    removedReviewImage.durableImageUrl,
    undefined,
    BRAND_A_ID,
    false
  );
  const removalImageFindings = removalFindings.filter((f) =>
    ['R-09', 'P-01', 'A-02'].includes(f.citation_id)
  );
  assert(
    removalImageFindings.length === 0,
    `Removal with no re-upload gives 0 image findings (actual: ${removalImageFindings.length})`
  );

  // Re-upload an off-palette image in the same session and clear alt to blank.
  sessionImageState = applyImageUpload(offPalettePinkPng);
  const reuploadReviewImage = resolveReviewImage({
    ...sessionImageState,
    currentDraftImageUrl: onPaletteBluePng,
  });
  assert(
    reuploadReviewImage.imageRemoved === false,
    'Re-upload clears the earlier imageRemoved flag in the same session'
  );
  assert(
    reuploadReviewImage.durableImageUrl === offPalettePinkPng,
    'Re-uploaded off-palette image is the review image'
  );

  const pinkSample = await sampleImageColors(offPalettePinkPng, ['#1E3A8A', '#D97706']);
  assert(pinkSample.status === 'analyzed', 'Off-palette PNG is sampled');
  assert(pinkSample.sampledColors.includes('#FF0060'), `Sampled off-palette colour is #FF0060 (actual: ${pinkSample.sampledColors.join(', ')})`);
  assert(pinkSample.isOffPalette === true, 'Sampled off-palette PNG is detected as off-palette');

  const reuploadFindings = runLocalDemoReview(
    cleanBody,
    null, // alt text cleared to blank
    reuploadReviewImage.durableImageUrl,
    undefined,
    BRAND_A_ID,
    pinkSample.isOffPalette
  );
  const r09Count = reuploadFindings.filter((f) => f.citation_id === 'R-09').length;
  const p01Count = reuploadFindings.filter((f) => f.citation_id === 'P-01').length;
  const a02Count = reuploadFindings.filter((f) => f.citation_id === 'A-02').length;
  assert(r09Count === 1, `Re-uploaded off-palette + blank alt gives exactly 1x R-09 (actual: ${r09Count})`);
  assert(p01Count === 1, `Re-uploaded off-palette + blank alt gives exactly 1x P-01 (actual: ${p01Count})`);
  assert(a02Count === 1, `Re-uploaded off-palette + blank alt gives exactly 1x A-02 (actual: ${a02Count})`);

  // Final removal after the re-upload, still in the same session.
  sessionImageState = applyImageRemoval();
  const finalRemovalReviewImage = resolveReviewImage({
    ...sessionImageState,
    currentDraftImageUrl: onPaletteBluePng,
  });
  assert(finalRemovalReviewImage.imageRemoved === true, 'Second removal after re-upload stays removed');
  assert(finalRemovalReviewImage.durableImageUrl === null, 'Second removal has no review image URL');

  const finalRemovalFindings = runLocalDemoReview(
    cleanBody,
    null,
    finalRemovalReviewImage.durableImageUrl,
    undefined,
    BRAND_A_ID,
    false
  );
  const finalRemovalImageFindings = finalRemovalFindings.filter((f) =>
    ['R-09', 'P-01', 'A-02'].includes(f.citation_id)
  );
  assert(
    finalRemovalImageFindings.length === 0,
    `Final removal after re-upload gives 0 image findings (actual: ${finalRemovalImageFindings.length})`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Report palette is brand-scoped
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Report palette is active-brand scoped ---');

  const novaVaultPalette: VaultItem[] = [
    {
      item_id: 'P-10',
      kind: 'palette',
      title: 'NovaTech Accent (#0EA5E9)',
      text: '#0EA5E9 - NovaTech accent colour.',
      status: 'active',
    },
    {
      item_id: 'P-11',
      kind: 'palette',
      title: 'NovaTech Surface (#FFFFFF)',
      text: '#FFFFFF - NovaTech surface colour.',
      status: 'active',
    },
  ];
  const novaExtracted = extractHexCodesFromVaultPalette(novaVaultPalette);
  assert(
    novaExtracted.length === 2 &&
      novaExtracted.includes('#0EA5E9') &&
      novaExtracted.includes('#FFFFFF'),
    `NovaTech vault palette extracts only P-10/P-11 colours (actual: ${novaExtracted.join(', ')})`
  );
  const demoHexes = ['#1E3A8A', '#D97706', '#F8FAFC', '#0F172A'];
  assert(
    novaExtracted.every((hex) => !demoHexes.includes(hex)),
    'NovaTech extracted palette contains no Demo palette colours'
  );

  const demoVaultPalette: VaultItem[] = demoHexes.map((hex, index) => ({
    item_id: `P-0${index + 1}`,
    kind: 'palette',
    title: `Demo palette ${index + 1} (${hex})`,
    text: `${hex} - Demo palette colour.`,
    status: 'active',
  }));
  const demoExtracted = extractHexCodesFromVaultPalette(demoVaultPalette);
  assert(
    demoExtracted.length === 4 && demoExtracted.every((hex) => demoHexes.includes(hex)),
    `Demo vault palette extracts only P-01..P-04 colours (actual: ${demoExtracted.join(', ')})`
  );
  assert(
    demoExtracted.every((hex) => !['#06B6D4', '#0B0F19'].includes(hex)),
    'Demo extracted palette contains no NovaTech palette colours'
  );

  const novaDraft: Draft = {
    id: 'nova-report-draft',
    brand_id: BRAND_B_ID,
    title: 'NovaTech ANC 500 Launch Campaign',
    body_text: 'NovaTech ANC 500 — Rs. 3,499.',
    alt_text: null,
    image_url: null,
    status: 'checked',
    current_version: 1,
    created_by_role: 'guest',
    versions: [{ version_no: 1, body_text: 'NovaTech ANC 500 — Rs. 3,499.', alt_text: null }],
  };
  const novaReportHtml = renderToString(
    <Report
      draft={novaDraft}
      findings={[]}
      onDraftUpdated={() => {}}
      onNavigateToReview={() => {}}
      apiStatus="offline"
    />
  ).replace(/<!--.*?-->/g, '');

  assert(novaReportHtml.includes('Brand palette:'), 'NovaTech Report renders a "Brand palette:" line');
  const novaFallback = fallbackPaletteHexesForBrand(BRAND_B_ID);
  assert(
    novaFallback.length === 2 && novaReportHtml.includes(novaFallback.join(' · ')),
    `NovaTech Report shows only its P-10/P-11 fallback palette (actual line contains: ${novaFallback.join(' · ')})`
  );
  assert(
    demoHexes.every((hex) => !novaReportHtml.includes(hex)),
    'NovaTech Report contains none of the Demo palette hex codes'
  );

  const demoDraft: Draft = {
    ...novaDraft,
    id: 'demo-report-draft',
    brand_id: BRAND_A_ID,
    title: 'Diwali Festive Cookware Campaign',
    body_text: cleanBody,
  };
  const demoReportHtml = renderToString(
    <Report
      draft={demoDraft}
      findings={[]}
      onDraftUpdated={() => {}}
      onNavigateToReview={() => {}}
      apiStatus="offline"
    />
  ).replace(/<!--.*?-->/g, '');
  const demoFallback = fallbackPaletteHexesForBrand(BRAND_A_ID);
  assert(
    demoFallback.length === 4 && demoReportHtml.includes(demoFallback.join(' · ')),
    `Demo Report shows only its P-01..P-04 fallback palette (actual line contains: ${demoFallback.join(' · ')})`
  );
  assert(
    ['#06B6D4', '#0B0F19'].every((hex) => !demoReportHtml.includes(hex)),
    'Demo Report contains none of the NovaTech palette hex codes'
  );

  // -------------------------------------------------------------------------
  // TEST 3: Report R-09 action is honest — navigate to Submit, never a silent no-op
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Report R-09 action is a Submit navigation, not Apply Fix ---');

  const r09Finding: Finding = {
    id: 'artifact-r09',
    version_no: 4,
    lane: 'human_decision',
    severity: 'high',
    citation_id: 'R-09',
    explanation: 'Image asset attached but descriptive alt text is blank, violating accessibility rule R-09.',
    suggested_fix: 'Add concise descriptive alt text',
  };
  const r04Finding: Finding = {
    id: 'artifact-r04',
    version_no: 4,
    lane: 'evidence_needed',
    severity: 'high',
    citation_id: 'R-04',
    explanation: "Claim 'clinically proven' is a superlative/performance claim requiring approved evidence under rule R-04.",
    suggested_fix: 'certified quality',
  };
  const r09Draft: Draft = {
    id: 'r09-report-draft',
    brand_id: BRAND_A_ID,
    title: 'Diwali Festive Cookware Campaign',
    body_text: cleanBody,
    image_url: offPalettePinkPng,
    alt_text: null,
    status: 'checked',
    current_version: 4,
    created_by_role: 'guest',
    versions: [{ version_no: 4, body_text: cleanBody, alt_text: null }],
  };
  const r09Html = renderToString(
    <Report
      draft={r09Draft}
      findings={[r09Finding, r04Finding]}
      onDraftUpdated={() => {}}
      onNavigateToReview={() => {}}
      onNavigateToSubmit={() => {}}
      apiStatus="offline"
    />
  ).replace(/<!--.*?-->/g, '');

  assert(r09Html.includes('Add alt text on Submit'), 'R-09 renders "Add alt text on Submit" action');
  assert(
    r09Html.includes('Required action:'),
    'R-09 presents its suggestion as a required action, not an auto-applied replacement'
  );
  assert(
    !r09Html.includes('Apply Fix: &quot;Add concise descriptive alt text&quot;') &&
      !r09Html.includes('Apply Fix: "Add concise descriptive alt text"'),
    'R-09 does NOT render the old Apply Fix button'
  );
  assert(
    r09Html.includes('Apply Fix: &quot;certified quality&quot;') ||
      r09Html.includes('Apply Fix: "certified quality"'),
    'Non-R-09 findings (R-04) still render their Apply Fix button'
  );

  console.log('\n======================================================================');
  console.log(`ALL PHASE 6.3 SELF-TESTS PASSED (${passed}/${total})`);
  console.log('======================================================================');
}

runPhase63Tests().catch((err) => {
  console.error('\nFAILED PHASE 6.3 TESTS:', err);
  process.exit(1);
});
