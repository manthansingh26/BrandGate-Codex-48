# BrandGate

> **The gate every post must pass before it goes public.**  
> Pre-publication brand-governance gate. **Hero rule:** *"No citation, no flag."* A finding with no valid vault citation ID must NEVER be shown.

---

## Judge Walkthrough (In Order, No Walkthrough Needed)

Follow these 8 steps to test the complete application in under 2 minutes:

1. **Open Live App**: Open the deployed live link in any browser (or Incognito). No sign-in required.
2. **Click "Try the demo draft"**: On the Home page, click the prominent teal button to generate the demo draft and load it into Submit.
3. **Click "Review Draft"**: Hit **Review Draft** to trigger the deterministic and retrieval-grounded governance review.
4. **Inspect Governance Report**:
   - `F-12` Contradiction: Flagged because Rs. 999 contradicts approved promotional fact F-12 (Rs. 1,299).
   - `R-04` Evidence Needed: Two findings for "India's No. 1" and "clinically proven" requiring approved evidence records. Neither is labeled as false.
   - Zero uncited findings.
5. **Apply Fixes**: Click **Apply Fix: "Rs. 1,299"**, **Apply Fix: "trusted"**, and **Apply Fix: "certified quality"**.
6. **Verify Clean Copy**: Confirm the final copy reads:  
   `"Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"`  
   Contains **zero occurrences of "No. 1"** and reflects the approved price. Re-review to verify all text findings clear.
7. **Approval Workflow**: Navigate to **Review** tab:
   - Click **Request Approval** (as Creator/guest). Status advances to `pending_approval`.
   - Toggle role to **Reviewer** in the top navigation bar.
   - Click **Approve Draft**. Observe the **LOCKED APPROVED SNAPSHOT** banner appear with verified timestamp, approver role, and vault metadata.
   - Edit the draft copy; observe status resets to `draft` server-side and the locked snapshot clears.
8. **View Insights**: Click the **Insights** tab in the navigation bar to inspect real session counts pulled live from the database for each citation ID (`F-12`, `R-04`, `A-02`, etc.).

---

## Architecture & Technology Stack

- **Frontend**: React + TypeScript (Vite) + Tailwind CSS, hosted on **Vercel** (`/frontend`).
- **Backend API**: Python FastAPI with CORS middleware and guaranteed exception handling, hosted on **Render** (`/backend`).
- **Database**: PostgreSQL hosted on **Supabase** with `pgvector` enabled and automatic keyword-retrieval fallback.
- **Authentication**: Supabase Auth (email/password for real Creator/Reviewer accounts; guest demo mode requires zero sign-in).
- **Storage**: Supabase Storage public bucket `brandgate-creatives` for demo creative image assets.
- **Grounded AI Review**: Google Gemini via Google AI Studio (`gemini-3.5-flash-lite`, 60s timeout, retrieval-only context, server-side citation validation, labeled failure fallback).
- **Primary Safety Net**: Deterministic server-side review engine enforcing strict rule invariants.

---

## Seeded Vault Item Reference

The demo brand (`Demo Brand (Seeded)`) is pre-provisioned with these ground-truth items:

| Item ID | Kind | Title | Text & Rule Specification |
|---|---|---|---|
| **F-12** | Fact | Festive Cookware Promotional Price | Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026. |
| **R-04** | Rule | Superlatives & Ranking Claims | Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records. (Results in *Evidence Needed*, never *Contradiction*). |
| **A-02** | Rule | Approved Current Logo Only | Current approved logo file only; archived logo is not accepted. Reviewer-confirmed only — automatic logo verification is never claimed. |
| **R-09** | Rule | Descriptive Alt Text Requirement | Every creative requires descriptive alt text. (Image present with blank alt text triggers violation). |
| **T-01** | Terminology | Restricted: clinically proven | Categorized as evidence_required. |
| **T-02** | Terminology | Restricted: India's No. 1 | Categorized as evidence_required. |
| **T-03** | Terminology | Approved: certified quality | Approved replacement term for superiority claims. |
| **T-04** | Terminology | Approved: trusted by millions | Approved replacement term for ranking claims. |
| **P-01** | Palette | Primary Brand Blue | `#1E3A8A` - Seeded Primary Blue. |
| **P-02** | Palette | Secondary Accent Amber | `#D97706` - Seeded Secondary Amber. |
| **P-03** | Palette | Surface Neutral Light | `#F8FAFC` - Seeded neutral light surface. |
| **P-04** | Palette | Text Slate Dark | `#0F172A` - Seeded high-contrast text color. |

---

## Honest Limitations

We believe in complete technical transparency:
1. **Render Free-Tier Sleep**: Render free-tier web services spin down after inactivity. The first API request may take 30–60 seconds while the instance boots. The frontend honestly displays `"Waking up server..."` during this window and falls back to `"API offline — local demo mode"` only if the service is unreachable.
2. **Google Gemini Free-Tier Quotas**: Google AI Studio free tier enforces request limits. Older models (`gemini-2.5-flash`) return HTTP 404 for new users, while `gemini-3.8-flash` experiences periodic 503 demand spikes. The system automatically routes to active `gemini-3.5-flash-lite`.
3. **Approximate Palette Sampling**: Client-side canvas dominant color extraction is labeled `"Approximate"` and generates *Human Decision* advisories rather than automated rejections.
4. **Reviewer-Confirmed Logo Checking**: We never claim automated computer-vision logo verification. Rule `A-02` requires explicit reviewer confirmation.
5. **AI Suggestions as Secondary Gate**: Language model reviews are advisory suggestions grounded exclusively in retrieved vault items and filtered via the citation validator. Deterministic checks remain the authoritative gate.

---

## Free-Tier Operational Costs

- **Total Cost**: **₹0.00 / $0.00** (Zero credit card required).
- All infrastructure runs on free developer tiers:
  - Vercel Free Tier (Frontend CDN)
  - Render Free Tier (FastAPI Web Service)
  - Supabase Free Tier (PostgreSQL Database, Auth, Storage)
  - Google AI Studio Free Tier (Gemini API)

---

## 5 Verified Test Fixtures

| # | Fixture Scenario | Input Data | Expected Governance Result |
|---|---|---|---|
| **1** | **Fully Compliant Post** | `"Festive cookware offer Rs. 1,299. Certified quality guaranteed."` | 0 Contradictions. F-12 price matches; no unauthorized superlatives. Passes review cleanly. |
| **2** | **Pricing Contradiction** | Copy contains `"Rs. 999"` | Flags high-severity `contradiction` citing `F-12`. One-click fix updates price to `"Rs. 1,299"`. |
| **3** | **Unsubstantiated Superlative** | Copy contains `"India's No. 1 cookware brand"` | Flags high-severity `evidence_needed` citing `R-04` (not labeled false). Applying fix cleanly replaces with `"trusted"`, leaving **no** `"No. 1"` fragment. |
| **4** | **Off-Palette Image & Missing Alt Text** | Uploaded image with neon colors and blank alt-text box | Generates `human_decision` (Approximate) citing `P-01` and `human_decision` citing `R-09` for missing alt text. Providing alt text clears `R-09`. |
| **5** | **Creator Self-Approval & Revisions** | Creator attempts to approve draft; or edits copy after approval | Self-approval blocked with HTTP 403 (*"Creator cannot approve their own draft"*). Editing approved text resets status back to `draft` server-side and clears the locked snapshot. |

---

## Live Deployment Links

- **Live Application**: `<Vercel URL I will fill>`
- **Backend API Docs**: `<Render URL I will fill>/docs`
- **Source Repository**: [https://github.com/manthansingh26/BrandGate-Codex-48.git](https://github.com/manthansingh26/BrandGate-Codex-48.git)
