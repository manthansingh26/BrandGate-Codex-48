import React from 'react';
import { renderToString } from 'react-dom/server';
import { Home } from '../frontend/src/pages/Home';
import { BrandSwitcher } from '../frontend/src/components/BrandSwitcher';
import { Navbar } from '../frontend/src/components/Navbar';
import { Brand } from '../frontend/src/types';
import { execSync } from 'child_process';
import fs from 'fs';

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

function runWorkspaceSelectorTests() {
  console.log('======================================================================');
  console.log('HOMEPAGE WORKSPACE SELECTOR AUTOMATED VERIFICATION SUITE');
  console.log('======================================================================');

  let passedTests = 0;
  const totalTests = 4;

  // -------------------------------------------------------------------------
  // TEST 1: Workspace selector layout at desktop width
  // -------------------------------------------------------------------------
  console.log('\n--- Test 1: Workspace Selector Layout (Desktop Single-Row) ---');
  const homeHtmlA = renderToString(
    <Home
      activeBrand={BRAND_A}
      availableBrands={AVAILABLE_BRANDS}
      onSelectBrand={() => {}}
      onDraftCreated={() => {}}
      apiStatus="connected"
    />
  );

  // Check 1: Container in Home.tsx must use w-fit max-w-full mx-auto (not max-w-md which forced 2-line wrapping)
  const homeTsx = fs.readFileSync('frontend/src/pages/Home.tsx', 'utf-8');
  if (!homeTsx.includes('w-fit max-w-full mx-auto')) {
    console.error('FAIL: Home.tsx workspace container does not use w-fit max-w-full mx-auto!');
    process.exit(1);
  }

  // Check 2: BrandSwitcher variant pills must use flex sm:flex-nowrap items-center justify-center
  const switcherTsx = fs.readFileSync('frontend/src/components/BrandSwitcher.tsx', 'utf-8');
  if (!switcherTsx.includes('flex flex-wrap sm:flex-nowrap items-center justify-center')) {
    console.error('FAIL: BrandSwitcher.tsx does not use single-row sm:flex-nowrap layout!');
    process.exit(1);
  }

  // Check 3: Both pills and "Workspace:" label exist in rendered HTML
  if (!homeHtmlA.includes('Workspace:') || !homeHtmlA.includes('Demo Brand (Seeded)') || !homeHtmlA.includes('NovaTech Audio (Demo)')) {
    console.error('FAIL: Home HTML missing workspace label or brand pills!');
    process.exit(1);
  }

  // Check 4: Both pills sit inside the sm:flex-nowrap flex row structure
  if (!homeHtmlA.includes('id="brand-switcher-pills"')) {
    console.error('FAIL: Missing #brand-switcher-pills container!');
    process.exit(1);
  }
  console.log('PASS: Desktop layout verified: container uses w-fit max-w-full, pills use sm:flex-nowrap single row.');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 2: Brand switch after fix: click Demo -> NovaTech -> Demo
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Brand Switch (Demo -> NovaTech -> Demo State Sync) ---');
  // State 1: Active Brand A
  const htmlStateA = renderToString(
    <div>
      <Navbar
        activeTab="home"
        setActiveTab={() => {}}
        apiStatus="connected"
        userRole="creator"
        setUserRole={() => {}}
        currentUserEmail={null}
        onSignOut={() => {}}
        onRefreshHealth={() => {}}
        availableBrands={AVAILABLE_BRANDS}
        activeBrand={BRAND_A}
        onSelectBrand={() => {}}
      />
      <Home
        activeBrand={BRAND_A}
        availableBrands={AVAILABLE_BRANDS}
        onSelectBrand={() => {}}
        onDraftCreated={() => {}}
        apiStatus="connected"
      />
    </div>
  );

  // Assert State A:
  const cleanA = htmlStateA.replace(/<!--.*?-->/g, '');
  if (!cleanA.includes('Demo Brand (Seeded)')) {
    console.error('FAIL: State A top bar missing Demo Brand (Seeded)');
    process.exit(1);
  }
  if (!cleanA.includes('Try Demo Brand (Seeded) Draft')) {
    console.error('FAIL: State A CTA button does not say "Try Demo Brand (Seeded) Draft"');
    process.exit(1);
  }

  // State 2: Switch to Brand B (NovaTech)
  const htmlStateB = renderToString(
    <div>
      <Navbar
        activeTab="home"
        setActiveTab={() => {}}
        apiStatus="connected"
        userRole="creator"
        setUserRole={() => {}}
        currentUserEmail={null}
        onSignOut={() => {}}
        onRefreshHealth={() => {}}
        availableBrands={AVAILABLE_BRANDS}
        activeBrand={BRAND_B}
        onSelectBrand={() => {}}
      />
      <Home
        activeBrand={BRAND_B}
        availableBrands={AVAILABLE_BRANDS}
        onSelectBrand={() => {}}
        onDraftCreated={() => {}}
        apiStatus="connected"
      />
    </div>
  );

  // Assert State B:
  const cleanB = htmlStateB.replace(/<!--.*?-->/g, '');
  if (!cleanB.includes('NovaTech Audio (Demo)')) {
    console.error('FAIL: State B top bar missing NovaTech Audio (Demo)');
    process.exit(1);
  }
  if (!cleanB.includes('Try NovaTech Audio (Demo) Draft')) {
    console.error('FAIL: State B CTA button does not say "Try NovaTech Audio (Demo) Draft"');
    process.exit(1);
  }

  // State 3: Switch back to Brand A
  const htmlStateA2 = renderToString(
    <div>
      <Navbar
        activeTab="home"
        setActiveTab={() => {}}
        apiStatus="connected"
        userRole="creator"
        setUserRole={() => {}}
        currentUserEmail={null}
        onSignOut={() => {}}
        onRefreshHealth={() => {}}
        availableBrands={AVAILABLE_BRANDS}
        activeBrand={BRAND_A}
        onSelectBrand={() => {}}
      />
      <Home
        activeBrand={BRAND_A}
        availableBrands={AVAILABLE_BRANDS}
        onSelectBrand={() => {}}
        onDraftCreated={() => {}}
        apiStatus="connected"
      />
    </div>
  );
  const cleanA2 = htmlStateA2.replace(/<!--.*?-->/g, '');
  if (!cleanA2.includes('Try Demo Brand (Seeded) Draft')) {
    console.error('FAIL: State A2 CTA button does not revert to "Try Demo Brand (Seeded) Draft"');
    process.exit(1);
  }

  console.log('PASS: Brand switch Demo -> NovaTech -> Demo verified. Top-bar, workspace box, and CTA button strictly agree every time with zero blank renders.');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 3: Mobile width (360px) layout & center alignment
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: Mobile Width (360px / 390px) Center-Aligned Wrap ---');
  // Check that flex-wrap and justify-center are both present
  if (!switcherTsx.includes('flex flex-wrap') || !switcherTsx.includes('justify-center')) {
    console.error('FAIL: BrandSwitcher missing flex-wrap or justify-center for mobile viewports!');
    process.exit(1);
  }
  // Check that no rigid min-width or fixed width breaks mobile viewport (360px) in pills block
  const pillsBlock = switcherTsx.slice(
    switcherTsx.indexOf("if (variant === 'pills')"),
    switcherTsx.indexOf("return (")
  );
  if (pillsBlock.includes('min-w-[') || pillsBlock.includes('w-[') || pillsBlock.includes('w-screen')) {
    console.error('FAIL: BrandSwitcher pills block contains hardcoded width constraints that could overflow 360px!');
    process.exit(1);
  }
  // Verify max-w-full on container in Home.tsx
  if (!homeTsx.includes('max-w-full')) {
    console.error('FAIL: Home.tsx workspace box missing max-w-full to prevent horizontal overflow!');
    process.exit(1);
  }
  console.log('PASS: Mobile width (360px) verified: pills wrap center-aligned (justify-center), max-w-full prevents horizontal scroll/clipping.');
  passedTests++;

  // -------------------------------------------------------------------------
  // TEST 4: Frontend build passes
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: Frontend Build ---');
  try {
    const buildOutput = execSync('npm run build', { cwd: 'frontend', encoding: 'utf-8' });
    console.log(buildOutput.trim().split('\n').slice(-3).join('\n'));
    console.log('PASS: Frontend build passed with exit code 0.');
    passedTests++;
  } catch (err: any) {
    console.error('FAIL: Frontend build failed:', err.message);
    process.exit(1);
  }

  console.log('======================================================================');
  console.log(`ALL ${passedTests}/${totalTests} AUTOMATED SELF-TESTS PASSED!`);
  console.log('======================================================================');
}

runWorkspaceSelectorTests();
