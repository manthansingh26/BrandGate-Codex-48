import React from 'react';
import { renderToString } from 'react-dom/server';
import { Submit } from '../frontend/src/pages/Submit';
import { Brand, Draft } from '../frontend/src/types';

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

const AVAILABLE_BRANDS: Brand[] = [BRAND_A, BRAND_B];

function runSubmitScopingTests() {
  console.log("======================================================================");
  console.log("RUNNING SUBMIT PAGE BRAND-SCOPING AUTOMATED TESTS");
  console.log("======================================================================");

  // -------------------------------------------------------------------------
  // TEST 1: Direct /submit with Brand B selected (no current draft)
  // -------------------------------------------------------------------------
  const htmlBrandB = renderToString(
    <Submit
      activeBrand={BRAND_B}
      availableBrands={AVAILABLE_BRANDS}
      currentDraft={null}
      onReviewCompleted={() => {}}
      apiStatus="connected"
    />
  );

  // Assertions for Brand B:
  // Must show Brand B rules: F-20, R-15, T-10, P-10, P-11
  if (!htmlBrandB.includes("F-20 pricing") || !htmlBrandB.includes("R-15 lab benchmarks") || !htmlBrandB.includes("T-10 terminology")) {
    console.error("FAIL: Brand B submit does not show F-20, R-15, T-10 rules");
    process.exit(1);
  }
  if (!htmlBrandB.includes("NovaTech Approved Palette (Rules P-10 &amp; P-11)") && !htmlBrandB.includes("NovaTech Approved Palette (Rules P-10 & P-11)")) {
    console.error("FAIL: Brand B submit does not show P-10 & P-11 palette rules");
    process.exit(1);
  }

  // Must NEVER show Brand A rules: R-04, R-09, A-02
  if (htmlBrandB.includes("R-04") || htmlBrandB.includes("Rule R-09") || htmlBrandB.includes("Rule A-02")) {
    console.error("FAIL: Brand A rules (R-04/R-09/A-02) leaked into Brand B submit page!");
    process.exit(1);
  }

  // Must NEVER show Brand A draft text
  if (htmlBrandB.includes("Diwali Dhamaka") || htmlBrandB.includes("cookware brand")) {
    console.error("FAIL: Brand A cookware draft leaked into Brand B submit page!");
    process.exit(1);
  }

  // Must show empty form for Brand B
  if (htmlBrandB.includes(">Experience NovaTech") || htmlBrandB.includes(">Diwali")) {
    console.error("FAIL: Brand B draft textarea is not empty on direct navigation!");
    process.exit(1);
  }

  console.log("PASS: 1 - Direct /submit with Brand B shows empty form with ONLY Brand B rules (F-20, R-15, T-10, P-10, P-11) and zero Brand A rules (0x R-04, 0x R-09, 0x A-02).");

  // -------------------------------------------------------------------------
  // TEST 2: Direct /submit with Brand A selected (no current draft)
  // -------------------------------------------------------------------------
  const htmlBrandA = renderToString(
    <Submit
      activeBrand={BRAND_A}
      availableBrands={AVAILABLE_BRANDS}
      currentDraft={null}
      onReviewCompleted={() => {}}
      apiStatus="connected"
    />
  );

  // Assertions for Brand A:
  // Must show Brand A rules: R-04, R-09, A-02
  if (!htmlBrandA.includes("Rules active: R-04 superlatives")) {
    console.error("FAIL: Brand A submit does not show R-04 rule");
    process.exit(1);
  }
  if (!htmlBrandA.includes("Rule R-09")) {
    console.error("FAIL: Brand A submit does not show Rule R-09");
    process.exit(1);
  }
  if (!htmlBrandA.includes("Rule A-02")) {
    console.error("FAIL: Brand A submit does not show Rule A-02");
    process.exit(1);
  }

  // Must show existing Brand A demo text
  if (!htmlBrandA.includes("Diwali Dhamaka! India&#x27;s No. 1 cookware brand") && !htmlBrandA.includes("Diwali Dhamaka! India's No. 1 cookware brand")) {
    console.error("FAIL: Brand A submit does not show default cookware draft text");
    process.exit(1);
  }

  // Must NEVER show Brand B rules: F-20, R-15, T-10, P-10, P-11
  if (htmlBrandA.includes("F-20") || htmlBrandA.includes("R-15") || htmlBrandA.includes("T-10") || htmlBrandA.includes("P-10")) {
    console.error("FAIL: Brand B rules leaked into Brand A submit page!");
    process.exit(1);
  }

  console.log("PASS: 2 - Direct /submit with Brand A shows existing cookware draft with Brand A rules (R-04, R-09, A-02) and zero Brand B rules.");

  // -------------------------------------------------------------------------
  // TEST 3: "Try NovaTech Draft" flow (Brand B with active Brand B draft)
  // -------------------------------------------------------------------------
  const brandBDraft: Draft = {
    id: "draft-novatech-demo",
    brand_id: BRAND_B.id,
    title: "NovaTech ANC 500 Launch Campaign",
    body_text: "Experience NovaTech ANC 500 with world's best audio and 80-hour battery life — now for just Rs. 3,499!",
    alt_text: "NovaTech ANC 500 render",
    image_url: null,
    status: "draft",
    current_version: 1,
  };

  const htmlBrandBWithDraft = renderToString(
    <Submit
      activeBrand={BRAND_B}
      availableBrands={AVAILABLE_BRANDS}
      currentDraft={brandBDraft}
      onReviewCompleted={() => {}}
      apiStatus="connected"
    />
  );

  // Must show Brand B draft content
  if (!htmlBrandBWithDraft.includes("NovaTech ANC 500 Launch Campaign")) {
    console.error("FAIL: Brand B draft title missing");
    process.exit(1);
  }
  if (!htmlBrandBWithDraft.includes("80-hour battery life")) {
    console.error("FAIL: Brand B draft body missing");
    process.exit(1);
  }

  // In Try NovaTech flow, must STILL show only Brand B rules, NEVER R-04/R-09/A-02
  if (htmlBrandBWithDraft.includes("R-04") || htmlBrandBWithDraft.includes("Rule R-09") || htmlBrandBWithDraft.includes("Rule A-02")) {
    console.error("FAIL: Brand A rules leaked into Brand B Try NovaTech Draft flow!");
    process.exit(1);
  }
  if (!htmlBrandBWithDraft.includes("F-20") || !htmlBrandBWithDraft.includes("R-15") || !htmlBrandBWithDraft.includes("T-10")) {
    console.error("FAIL: Brand B rules missing from Try NovaTech Draft flow!");
    process.exit(1);
  }

  console.log("PASS: 3 - Try NovaTech Draft flow correctly populates Brand B draft and strictly displays Brand B rules (0x R-04/R-09/A-02).");

  // -------------------------------------------------------------------------
  // TEST 4: Brand Isolation when stale draft from other brand is passed
  // -------------------------------------------------------------------------
  const brandADraft: Draft = {
    id: "draft-brand-a-stale",
    brand_id: BRAND_A.id,
    title: "Diwali Cookware",
    body_text: "Diwali cookware Rs. 999",
    status: "draft",
    current_version: 1,
  };

  // If activeBrand is Brand B, but currentDraft belongs to Brand A (e.g. from storage before clear):
  const htmlBrandBWithStaleA = renderToString(
    <Submit
      activeBrand={BRAND_B}
      availableBrands={AVAILABLE_BRANDS}
      currentDraft={brandADraft}
      onReviewCompleted={() => {}}
      apiStatus="connected"
    />
  );

  // Must NOT display Brand A's draft text
  if (htmlBrandBWithStaleA.includes("Diwali cookware Rs. 999")) {
    console.error("FAIL: Stale Brand A draft leaked into Brand B submit render!");
    process.exit(1);
  }
  if (htmlBrandBWithStaleA.includes("R-04") || htmlBrandBWithStaleA.includes("Rule R-09") || htmlBrandBWithStaleA.includes("Rule A-02")) {
    console.error("FAIL: Brand A rules leaked into Brand B submit render!");
    process.exit(1);
  }

  console.log("PASS: 4 - Stale cross-brand draft in props is strictly rejected: Brand B shows empty form with Brand B rules only.");

  console.log("======================================================================");
  console.log("ALL SUBMIT BRAND-SCOPING TESTS PASSED (100% GREEN)!");
  console.log("======================================================================");
}

runSubmitScopingTests();
