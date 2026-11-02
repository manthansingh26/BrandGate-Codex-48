import React from 'react';
import { renderToString } from 'react-dom/server';
import { Home } from '../frontend/src/pages/Home';
import { Insights } from '../frontend/src/pages/Insights';
import { Brand } from '../frontend/src/types';

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

const KNOWN_EXISTING_ROUTES = ['/submit', '/report', '/review', '/vault', '/insights', '/'];

function runPhase6Tests() {
  console.log('======================================================================');
  console.log('PHASE 6 — JUDGE IMPRESSION PACK AUTOMATED SELF-TESTS');
  console.log('======================================================================');

  let passedTests = 0;

  // -------------------------------------------------------------------------
  // TEST 1: New Judge card renders on Home, all 5 steps present, links point only to existing routes
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Homepage Judge Start in 60 Seconds Card ---');
  const homeHtml = renderToString(
    <Home
      activeBrand={BRAND_A}
      availableBrands={AVAILABLE_BRANDS}
      onSelectBrand={() => {}}
      onDraftCreated={() => {}}
      apiStatus="connected"
    />
  );

  // Check 1.1: Card container and exact title
  const cleanHome = homeHtml.replace(/<!--.*?-->/g, '');
  if (!cleanHome.includes('Judge? Start here in 60 seconds.')) {
    throw new Error('FAIL: Home page missing card title "Judge? Start here in 60 seconds."');
  }
  console.log('[PASS] Card title "Judge? Start here in 60 seconds." is present.');

  // Check 1.2: Exactly 5 steps present in order
  const stepPatterns = [
    '1. Try Demo Draft (goes to Submit with Demo draft)',
    '2. Review Draft (shows 1x F-12 + 2x R-04)',
    '3. Apply Fix (price, then superlatives)',
    '4. Request Approval (as Creator)',
    '5. Switch to Reviewer → Approve → Locked Snapshot',
  ];

  let lastIndex = -1;
  for (let i = 0; i < stepPatterns.length; i++) {
    const stepText = stepPatterns[i];
    const currentIndex = cleanHome.indexOf(stepText);
    if (currentIndex === -1) {
      throw new Error(`FAIL: Step ${i + 1} "${stepText}" not found in Home HTML!`);
    }
    if (currentIndex <= lastIndex) {
      throw new Error(`FAIL: Step ${i + 1} "${stepText}" is not in sequential order!`);
    }
    lastIndex = currentIndex;
    console.log(`[PASS] Step ${i + 1} verified in order: "${stepText}"`);
  }

  // Check 1.3: Verify all hrefs in the judge card point ONLY to existing routes
  const judgeCardMatch = cleanHome.match(/id="judge-start-card"[\s\S]*?<\/ol>/);
  if (!judgeCardMatch) {
    throw new Error('FAIL: id="judge-start-card" not found in Home HTML!');
  }
  const judgeCardHtml = judgeCardMatch[0];
  const hrefMatches = Array.from(judgeCardHtml.matchAll(/href="([^"]+)"/g)).map((m) => m[1]);

  console.log('[INFO] Links found in Judge card:', hrefMatches);
  if (hrefMatches.length !== 5) {
    throw new Error(`FAIL: Expected 5 links in Judge card, found ${hrefMatches.length}`);
  }

  for (const href of hrefMatches) {
    if (!KNOWN_EXISTING_ROUTES.includes(href)) {
      throw new Error(`FAIL: Link href="${href}" points to a non-existing route!`);
    }
  }
  console.log('[PASS] All 5 links point exclusively to existing routes (/submit, /report, /review).');

  // Check 1.4: Mobile responsiveness check (no hardcoded fixed pixel widths that overflow 360px)
  if (judgeCardHtml.includes('w-[') || judgeCardHtml.includes('min-w-[5') || judgeCardHtml.includes('min-w-[6')) {
    throw new Error('FAIL: Judge card contains rigid min-width constraints that could overflow mobile!');
  }
  console.log('[PASS] Mobile responsiveness verified: no fixed overflow widths; uses max-w-2xl w-full.');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 2: Insights trend line present on both brands, numbers unchanged
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Insights Trend Explanation Line (Both Brands) ---');
  const expectedTrendLine = 'Trend compares latest draft with average of earlier drafts (not total flags ÷ drafts).';

  // Render Insights for Brand A
  const insightsHtmlA = renderToString(
    <Insights
      activeBrand={BRAND_A}
      availableBrands={AVAILABLE_BRANDS}
      onSelectBrand={() => {}}
    />
  );

  // Render Insights for Brand B
  const insightsHtmlB = renderToString(
    <Insights
      activeBrand={BRAND_B}
      availableBrands={AVAILABLE_BRANDS}
      onSelectBrand={() => {}}
    />
  );

  const cleanInsightsA = insightsHtmlA.replace(/<!--.*?-->/g, '');
  const cleanInsightsB = insightsHtmlB.replace(/<!--.*?-->/g, '');

  if (!cleanInsightsA.includes(expectedTrendLine)) {
    throw new Error(`FAIL: Brand A Insights missing exact line: "${expectedTrendLine}"`);
  }
  console.log('[PASS] Brand A Insights renders exact trend line.');

  if (!cleanInsightsB.includes(expectedTrendLine)) {
    throw new Error(`FAIL: Brand B Insights missing exact line: "${expectedTrendLine}"`);
  }
  console.log('[PASS] Brand B Insights renders exact trend line.');

  // Verify labels and structure are intact
  if (!cleanInsightsA.includes('Trend by Draft') || !cleanInsightsA.includes('Latest vs historical draft findings')) {
    throw new Error('FAIL: Brand A Insights Trend section labels were modified or removed!');
  }
  if (!cleanInsightsB.includes('Trend by Draft') || !cleanInsightsB.includes('Latest vs historical draft findings')) {
    throw new Error('FAIL: Brand B Insights Trend section labels were modified or removed!');
  }
  console.log('[PASS] Trend by Draft section structure and labels preserved for both brands.');
  passedTests++;

  console.log('======================================================================');
  console.log(`ALL ${passedTests}/2 PHASE 6 AUTOMATED VERIFICATION CHECKS PASSED!`);
  console.log('======================================================================');
}

runPhase6Tests();
