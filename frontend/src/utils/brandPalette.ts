import { VaultItem } from '../types';
import { APPROVED_BRAND_PALETTE, APPROVED_BRAND_B_PALETTE } from './imageAnalysis';

export const BRAND_A_ID = '00000000-0000-0000-0000-000000000001';
export const BRAND_B_ID = '00000000-0000-0000-0000-000000000002';

function normalizeHex(hex: string): string {
  return hex.toUpperCase();
}

/**
 * Extracts only the active palette-vault hex codes for the supplied brand.
 * The caller can pass an already brand-scoped vault palette list.
 */
export function extractHexCodesFromVaultPalette(
  paletteItems: VaultItem[] | null | undefined
): string[] {
  const seen = new Set<string>();
  const hexes: string[] = [];

  for (const item of paletteItems || []) {
    if (!item || item.kind !== 'palette' || item.status !== 'active') continue;

    const source = `${item.title || ''} ${item.text || ''}`;
    const matches = source.match(/#[0-9a-fA-F]{6}\b/g) || [];
    for (const match of matches) {
      const hex = normalizeHex(match);
      if (!seen.has(hex)) {
        seen.add(hex);
        hexes.push(hex);
      }
    }
  }

  return hexes;
}

/**
 * Offline/local-demo fallback. Kept brand-specific so a brand never displays
 * another brand's colours when the API vault is unavailable.
 */
export function fallbackPaletteHexesForBrand(brandId?: string | null): string[] {
  return brandId === BRAND_B_ID
    ? [...APPROVED_BRAND_B_PALETTE]
    : [...APPROVED_BRAND_PALETTE];
}
