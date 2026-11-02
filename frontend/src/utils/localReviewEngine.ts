import { Finding, VaultItem } from '../types';

/**
 * Client-Side Deterministic Check Engine
 * Used exclusively when the backend API is offline or unreachable.
 * Mirrors Phase 3 rules exactly and labels every finding:
 * "Local demo check — backend unavailable".
 * Enforces: "No citation, no flag."
 */

export const FALLBACK_VAULT_ITEMS: VaultItem[] = [
  {
    item_id: 'F-12',
    kind: 'fact',
    title: 'Festive Cookware Promotional Price',
    text: 'Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026.',
    status: 'active',
  },
  {
    item_id: 'R-04',
    kind: 'rule',
    title: 'Superlatives & Ranking Claims Require Approved Evidence',
    text: 'Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.',
    status: 'active',
  },
  {
    item_id: 'A-02',
    kind: 'rule',
    title: 'Approved Current Logo Requirement',
    text: 'Current approved logo file only; archived logo is not accepted.',
    status: 'active',
  },
  {
    item_id: 'R-09',
    kind: 'rule',
    title: 'Mandatory Descriptive Image Alt Text',
    text: 'Every creative requires descriptive alt text.',
    status: 'active',
  },
  {
    item_id: 'P-01',
    kind: 'palette',
    title: 'Primary Brand Blue (#1E3A8A)',
    text: '#1E3A8A - Seeded control brand blue.',
    status: 'active',
  },
  {
    item_id: 'T-01',
    kind: 'terminology',
    title: 'Restricted Term: clinically proven',
    text: 'Term "clinically proven" is categorized as evidence_required.',
    status: 'active',
  },
  {
    item_id: 'T-02',
    kind: 'terminology',
    title: "Restricted Term: India's No. 1",
    text: 'Term "India\'s No. 1" is categorized as evidence_required.',
    status: 'active',
  },
];

export const FALLBACK_VAULT_ITEMS_BRAND_B: VaultItem[] = [
  {
    item_id: 'F-20',
    kind: 'fact',
    title: 'NovaTech ANC 500 Promotional Price',
    text: 'NovaTech ANC 500 promotional price is Rs. 3,499 (MSRP Rs. 4,999) effective Q4 launch.',
    status: 'active',
  },
  {
    item_id: 'R-15',
    kind: 'rule',
    title: 'Battery Life & Latency Benchmark Claims',
    text: 'Battery life and latency claims require verified lab test benchmarks under ISO-9001 audio standards.',
    status: 'active',
  },
  {
    item_id: 'T-10',
    kind: 'terminology',
    title: 'Restricted Audio Superlative: world\'s best audio',
    text: 'Approved term: \'PureSilence ANC\'; Unapproved term: \'world\'s best audio\'.',
    status: 'active',
  },
  {
    item_id: 'P-10',
    kind: 'palette',
    title: 'NovaTech Cyan Accent (#06B6D4)',
    text: 'Primary brand control color.',
    status: 'active',
  },
  {
    item_id: 'P-11',
    kind: 'palette',
    title: 'Obsidian Deep (#0B0F19)',
    text: '#0B0F19 - Deep dark background for audio gear presentation.',
    status: 'active',
  },
];

export function runLocalDemoReview(
  bodyText: string,
  altText?: string | null,
  imageUrl?: string | null,
  vaultItems?: VaultItem[],
  brandId?: string,
  paletteOff?: boolean
): Finding[] {
  const isBrandB = brandId === '00000000-0000-0000-0000-000000000002';
  const effectiveVault = vaultItems || (isBrandB ? FALLBACK_VAULT_ITEMS_BRAND_B : FALLBACK_VAULT_ITEMS);
  const activeItems = effectiveVault.filter((i) => i.status === 'active');
  const validCitationIds = new Set(activeItems.map((i) => i.item_id));
  const rawFindings: Finding[] = [];

  if (isBrandB) {
    // Brand B: 1. Price check (F-20: Rs. 3,499)
    const priceRegex = /(?:Rs\.?|INR|₹)\s*([\d,]+)/gi;
    const matches = [...bodyText.matchAll(priceRegex)];
    const approvedPrice = '3499';

    for (const match of matches) {
      const rawNumber = match[1].replace(/,/g, '');
      if (rawNumber !== approvedPrice) {
        rawFindings.push({
          id: `local-price-${Date.now()}`,
          lane: 'contradiction',
          severity: 'high',
          citation_id: 'F-20',
          explanation: `[Local demo check — backend unavailable] Draft price '${match[0]}' contradicts approved promotional fact F-20 ('Rs. 3,499').`,
          suggested_fix: 'Rs. 3,499',
        });
      }
    }

    // Brand B: 2. Benchmark claims (R-15: battery life & latency)
    const bClaims = ['battery life', '80-hour', 'latency'];
    for (const claim of bClaims) {
      const regex = new RegExp(`\\b${claim}\\b`, 'i');
      if (regex.test(bodyText)) {
        rawFindings.push({
          id: `local-bclaim-${claim}-${Date.now()}`,
          lane: 'evidence_needed',
          severity: 'high',
          citation_id: 'R-15',
          explanation: `[Local demo check — backend unavailable] Claim '${claim}' requires verified lab test benchmarks under ISO-9001 audio standards (Rule R-15).`,
          suggested_fix: 'verified ISO lab benchmark',
        });
      }
    }

    // Brand B: 3. Unapproved terminology (T-10: world's best audio)
    if (/world's best audio/i.test(bodyText)) {
      rawFindings.push({
        id: `local-term-${Date.now()}`,
        lane: 'evidence_needed',
        severity: 'high',
        citation_id: 'T-10',
        explanation: `[Local demo check — backend unavailable] Audio superlative 'world's best audio' is unapproved under rule T-10. Approved term: 'PureSilence ANC'.`,
        suggested_fix: 'PureSilence ANC',
      });
    }

    // Brand B: 4. Palette check (P-10)
    if (imageUrl && paletteOff) {
      rawFindings.push({
        id: `local-palette-${Date.now()}`,
        lane: 'human_decision',
        severity: 'low',
        citation_id: 'P-10',
        explanation: 'Sampling: Approximate — reviewer to confirm brand color alignment with approved palette.',
        suggested_fix: null,
      });
    }
  } else {
    // Brand A: 1. Price check (F-12: Rs. 1,299)
    const priceRegex = /(?:Rs\.?|INR|₹)\s*([\d,]+)/gi;
    const matches = [...bodyText.matchAll(priceRegex)];
    const approvedPrice = '1299';

    for (const match of matches) {
      const rawNumber = match[1].replace(/,/g, '');
      if (rawNumber !== approvedPrice) {
        rawFindings.push({
          id: `local-price-${Date.now()}`,
          lane: 'contradiction',
          severity: 'high',
          citation_id: 'F-12',
          explanation: `[Local demo check — backend unavailable] Draft price '${match[0]}' contradicts approved promotional fact F-12 ('Rs. 1,299').`,
          suggested_fix: 'Rs. 1,299',
        });
      }
    }

    // Brand A: 2. Superlatives check (R-04)
    const claims = ["India's No. 1", 'clinically proven', 'best', 'guaranteed'];
    for (const claim of claims) {
      const regex = new RegExp(`\\b${claim}\\b`, 'i');
      if (regex.test(bodyText)) {
        let suggested: string | null = null;
        if (claim.toLowerCase().includes('no. 1')) {
          suggested = 'trusted';
        } else if (claim.toLowerCase().includes('clinically')) {
          suggested = 'certified quality';
        }

        rawFindings.push({
          id: `local-claim-${claim}-${Date.now()}`,
          lane: 'evidence_needed',
          severity: 'high',
          citation_id: 'R-04',
          explanation: `[Local demo check — backend unavailable] Claim '${claim}' is a superlative/performance claim requiring approved evidence under rule R-04.`,
          suggested_fix: suggested,
        });
      }
    }

    // Brand A: 3. Alt-text check (R-09)
    if (imageUrl && (!altText || !altText.trim())) {
      rawFindings.push({
        id: `local-alt-${Date.now()}`,
        lane: 'human_decision',
        severity: 'high',
        citation_id: 'R-09',
        explanation: '[Local demo check — backend unavailable] Image creative is missing descriptive alt text under rule R-09.',
        suggested_fix: 'Add concise descriptive alt text',
      });
    }

    // Brand A: 4. Logo check (A-02)
    if (imageUrl) {
      rawFindings.push({
        id: `local-logo-${Date.now()}`,
        lane: 'human_decision',
        severity: 'medium',
        citation_id: 'A-02',
        explanation: '[Local demo check — backend unavailable] Logo not reviewer-confirmed. Current approved logo file required under rule A-02; archived logos are not accepted.',
        suggested_fix: null,
      });
    }

    // Brand A: 5. Palette check (P-01)
    if (imageUrl && paletteOff) {
      rawFindings.push({
        id: `local-palette-${Date.now()}`,
        lane: 'human_decision',
        severity: 'low',
        citation_id: 'P-01',
        explanation: 'Sampling: Approximate — reviewer to confirm brand color alignment with approved palette.',
        suggested_fix: null,
      });
    }
  }

  // Mandatory Citation Validator: Drop any finding without active citation
  return rawFindings.filter((f) => validCitationIds.has(f.citation_id));
}

