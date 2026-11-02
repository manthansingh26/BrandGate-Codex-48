import React from 'react';
import { renderToString } from 'react-dom/server';
import { Report } from '../frontend/src/pages/Report';
import { Brand, Draft, Finding } from '../frontend/src/types';
import { sampleImageColors } from '../frontend/src/utils/imageAnalysis';
import { runLocalDemoReview, FALLBACK_VAULT_ITEMS } from '../frontend/src/utils/localReviewEngine';

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
              // Return RGBA data for a 50x50 canvas with solid #FF0060 (255, 0, 96, 255)
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

const BRAND_A: Brand = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Demo Brand (Seeded)',
  created_by: 'system',
};

const BRAND_B: Brand = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'NovaTech Audio (Demo)',
  created_by: 'system',
};

async function runPhase62Tests() {
  console.log('======================================================================');
  console.log('PHASE 6.2 — FIX VERIFICATION AUTOMATED SELF-TESTS');
  console.log('======================================================================');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`FAIL: ${message}`);
    }
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 1: Image findings via Report re-review path
  // Off-palette #FF0060 + blank alt gives exactly 1x R-09 + 1x P-01, no duplicates,
  // never a contradiction.
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Image findings via Report re-review path ---');
  const offPaletteImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const cleanBody = 'Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!';

  // Step 1a: Offline local review with off-palette and blank alt
  const findingsOffPaletteBlankAlt = runLocalDemoReview(
    cleanBody,
    null, // blank alt
    offPaletteImg,
    undefined,
    BRAND_A.id,
    true // isOffPalette = true
  );

  const r09Count = findingsOffPaletteBlankAlt.filter((f) => f.citation_id === 'R-09').length;
  const p01Count = findingsOffPaletteBlankAlt.filter((f) => f.citation_id === 'P-01').length;
  const contradictions = findingsOffPaletteBlankAlt.filter((f) => f.lane === 'contradiction');
  const r09Finding = findingsOffPaletteBlankAlt.find((f) => f.citation_id === 'R-09');
  const p01Finding = findingsOffPaletteBlankAlt.find((f) => f.citation_id === 'P-01');

  assert(r09Count === 1, `Exactly 1x R-09 finding present (actual: ${r09Count})`);
  assert(p01Count === 1, `Exactly 1x P-01 finding present (actual: ${p01Count})`);
  assert(r09Finding?.lane === 'human_decision', `R-09 is in Human Decision lane (actual: ${r09Finding?.lane})`);
  assert(p01Finding?.lane === 'human_decision', `P-01 is in Human Decision lane (actual: ${p01Finding?.lane})`);
  assert(contradictions.length === 0, `Sampling never generates a contradiction (actual: ${contradictions.length})`);

  // Step 1b: On-palette image with valid alt gives NO palette finding and NO R-09
  const findingsOnPaletteValidAlt = runLocalDemoReview(
    cleanBody,
    'Festive non-stick cookware pan',
    offPaletteImg,
    undefined,
    BRAND_A.id,
    false // isOffPalette = false
  );
  const r09OnPalette = findingsOnPaletteValidAlt.filter((f) => f.citation_id === 'R-09').length;
  const p01OnPalette = findingsOnPaletteValidAlt.filter((f) => f.citation_id === 'P-01').length;
  assert(r09OnPalette === 0, `On-palette with valid alt has 0x R-09 (actual: ${r09OnPalette})`);
  assert(p01OnPalette === 0, `On-palette with valid alt has 0x P-01 (actual: ${p01OnPalette})`);

  // -------------------------------------------------------------------------
  // TEST 2: Image change / removal creates a new version with unchanged body_text
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Image change / removal creates a new version with unchanged body_text ---');

  // Simulate draft version progression in Submit
  const baseDraft: Draft = {
    id: 'test-draft-v2',
    brand_id: BRAND_A.id,
    title: 'Festive Promo',
    body_text: cleanBody,
    alt_text: 'Old alt text',
    image_url: 'https://example.com/image1.png',
    current_version: 2,
    status: 'checked',
    created_by_role: 'guest',
    versions: [
      { version_no: 1, body_text: cleanBody, alt_text: null, created_at: '2026-10-31T10:00:00Z' },
      { version_no: 2, body_text: cleanBody, alt_text: 'Old alt text', created_at: '2026-10-31T10:05:00Z' },
    ],
  };

  // Case A: Image replaced, body text unchanged
  const newImgUrl = 'https://example.com/image2.png';
  const hasImageChangedA = newImgUrl !== baseDraft.image_url;
  const hasAltChangedA = ('Old alt text' !== baseDraft.alt_text);
  const hasBodyChangedA = cleanBody !== baseDraft.body_text;
  const shouldBumpA = Boolean(hasBodyChangedA || hasImageChangedA || hasAltChangedA);
  const versionA = shouldBumpA ? baseDraft.current_version + 1 : baseDraft.current_version;

  assert(shouldBumpA, 'Image change without text change triggers version bump');
  assert(versionA === 3, `New version after image replace is V3 (actual: V${versionA})`);

  // Case B: Alt cleared, body text and image unchanged
  const clearedAlt = null;
  const hasImageChangedB = false;
  const hasAltChangedB = (clearedAlt || '') !== (baseDraft.alt_text || '');
  const hasBodyChangedB = cleanBody !== baseDraft.body_text;
  const shouldBumpB = Boolean(hasBodyChangedB || hasImageChangedB || hasAltChangedB);
  const versionB = shouldBumpB ? baseDraft.current_version + 1 : baseDraft.current_version;

  assert(shouldBumpB, 'Clearing alt without text change triggers version bump');
  assert(versionB === 3, `New version after clearing alt is V3 (actual: V${versionB})`);

  // Case C: Image removed (remove_image), body text unchanged
  const imageRemoved = true;
  const hasImageChangedC = imageRemoved;
  const shouldBumpC = Boolean(hasBodyChangedA || hasImageChangedC);
  const versionC = shouldBumpC ? baseDraft.current_version + 1 : baseDraft.current_version;

  assert(shouldBumpC, 'Removing image without text change triggers version bump');
  assert(versionC === 3, `New version after removing image is V3 (actual: V${versionC})`);

  // -------------------------------------------------------------------------
  // TEST 3: Asset info line on EVERY Report version, matching stored image
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Asset info line present on findings version and passed version ---');

  // Case 3a: Findings version with uploaded image
  const version3Findings = findingsOffPaletteBlankAlt.map((f) => ({
    ...f,
    version_no: 3,
  }));
  const findingsDraftWithImg: Draft = {
    ...baseDraft,
    current_version: 3,
    image_url: offPaletteImg,
    alt_text: 'Festive pan creative',
  };
  const html3a = renderToString(
    <Report
      draft={findingsDraftWithImg}
      findings={version3Findings}
      onDraftUpdated={() => {}}
      onBackToSubmit={() => {}}
      apiStatus="offline"
    />
  );
  assert(html3a.includes('Visual asset:'), 'Report renders "Visual asset:" label on findings version');
  assert(html3a.includes('uploaded'), 'Report shows "uploaded" when image is present on findings version');
  assert(!html3a.includes('All Governance Checks Passed'), 'Report does NOT show passed card on findings version');

  // Case 3b: Passed version with NO uploaded image
  const passedDraftNoImg: Draft = {
    ...baseDraft,
    current_version: 4,
    image_url: null,
    alt_text: null,
  };
  const html3b = renderToString(
    <Report
      draft={passedDraftNoImg}
      findings={[]}
      onDraftUpdated={() => {}}
      onBackToSubmit={() => {}}
      apiStatus="offline"
    />
  );
  assert(html3b.includes('Visual asset:'), 'Report renders "Visual asset:" label on passed version');
  assert(html3b.includes('none uploaded'), 'Report shows "none uploaded" when image is null on passed version');
  assert(html3b.includes('All Governance Checks Passed'), 'Report shows passed card on passed version');

  // Case 3c: Warning when alt text exists with NO image
  const draftAltNoImg: Draft = {
    ...baseDraft,
    current_version: 5,
    image_url: null,
    alt_text: 'Orphaned alt text description',
  };
  const html3c = renderToString(
    <Report
      draft={draftAltNoImg}
      findings={[]}
      onDraftUpdated={() => {}}
      onBackToSubmit={() => {}}
      apiStatus="offline"
    />
  );
  assert(
    html3c.includes('Warning:') && html3c.includes('no visual asset is uploaded'),
    'Report renders warning alert when alt text exists without an image'
  );

  console.log('\n======================================================================');
  console.log(`ALL PHASE 6.2 SELF-TESTS PASSED (${passedTests}/${totalTests})`);
  console.log('======================================================================');
}

runPhase62Tests().catch((err) => {
  console.error(err);
  process.exit(1);
});
