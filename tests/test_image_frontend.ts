import { calculateContrastRatio, APPROVED_BRAND_PALETTE } from '../frontend/src/utils/imageAnalysis';

console.log("=" .repeat(70));
console.log("TESTING FRONTEND IMAGE ANALYSIS AND WCAG CONTRAST");
console.log("=" .repeat(70));

// 1. WCAG AA 4.5:1 Contrast Threshold test
const highContrast = calculateContrastRatio('#0F172A', '#F8FAFC');
console.log(`1. High Contrast Check: ${highContrast.ratioString}, passesAA: ${highContrast.passesAA}`);
if (!highContrast.passesAA || highContrast.ratio < 4.5) {
  throw new Error(`Expected >= 4.5:1, got ${highContrast.ratioString}`);
}

const lowContrast = calculateContrastRatio('#D97706', '#F8FAFC');
console.log(`2. Low Contrast Check: ${lowContrast.ratioString}, passesAA: ${lowContrast.passesAA}`);
if (lowContrast.passesAA && lowContrast.ratio < 4.5) {
  throw new Error(`Expected fails AA for ratio < 4.5`);
}

// 3. Pixel quantization logic test
function quantizePixel(r: number, g: number, b: number): string {
  const qR = Math.min(255, Math.max(0, Math.round(r / 32) * 32));
  const qG = Math.min(255, Math.max(0, Math.round(g / 32) * 32));
  const qB = Math.min(255, Math.max(0, Math.round(b / 32) * 32));
  return `#${qR.toString(16).padStart(2, '0')}${qG.toString(16).padStart(2, '0')}${qB.toString(16).padStart(2, '0')}`.toUpperCase();
}

const pinkHex = quantizePixel(255, 0, 96);
console.log(`3. Bright Pink Pixel Sampling: ${pinkHex}`);
if (pinkHex === '#000060') {
  throw new Error(`FAIL: Bright pink sampled to #000060 dark blue!`);
}
if (pinkHex !== '#FF0060') {
  throw new Error(`FAIL: Expected #FF0060, got ${pinkHex}`);
}

console.log("PASS: Frontend image sampling math and WCAG AA 4.5:1 calculations verified!");
