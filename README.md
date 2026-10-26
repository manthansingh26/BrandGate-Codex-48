# BrandGate

> **"The gate every post must pass before it goes public."**

BrandGate is a pre-publication brand-governance gate.  
**Hero rule:** *"No citation, no flag."* A finding with no valid vault citation ID is NEVER shown.

---

## Live Links

* **Live App (Judge Link)**: [https://brand-gate-rho.vercel.app/](https://brand-gate-rho.vercel.app/)
* **Backend API**: [https://brandgate-codex-48.onrender.com](https://brandgate-codex-48.onrender.com)
* **Backend Health Check**: [https://brandgate-codex-48.onrender.com/health](https://brandgate-codex-48.onrender.com/health)
* **Source Code Repository**: [https://github.com/manthansingh26/BrandGate-Codex-48](https://github.com/manthansingh26/BrandGate-Codex-48)
* **Team**: Solo team — Straw hat pirate
* **Team Leader**: Manthan ShravanSingh Rajpurohit

---

## Judge Walkthrough (In Order, No Sign-in Needed, No Walkthrough Needed)

1. **Open Live App**: Visit [https://brand-gate-rho.vercel.app/](https://brand-gate-rho.vercel.app/). No login required.
2. **Click "Try the demo draft"**: On the Home page, click the teal button to initialize the test creative copy.
3. **Click "Review Draft"**: Hit **Review Draft** to trigger the deterministic and retrieval-grounded governance review.
4. **Inspect Governance Report**:
   - `F-12` Contradiction: Flagged because Rs. 999 contradicts approved promotional fact F-12 (Rs. 1,299).
   - `R-04` Evidence Needed: Two findings for "India's No. 1" and "clinically proven" requiring approved evidence records. Neither is labeled false.
   - Zero uncited findings.
5. **Click Apply Fix**: Click **Apply Fix: "Rs. 1,299"**, **Apply Fix: "trusted"**, and **Apply Fix: "certified quality"**.
6. **Verify Clean Copy**: Confirm the final copy reads:  
   `"Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"`  
   Contains **zero occurrences of "No. 1"** and reflects the approved price. Re-review to verify all text findings clear.
7. **Approval Workflow**: Navigate to the **Review** tab:
   - Click **Request Approval** (as Creator/guest). Status advances to `pending_approval`.
   - Toggle role to **Reviewer** in the top navigation bar.
   - Click **Approve Draft**. Observe the **LOCKED APPROVED SNAPSHOT** banner appear with verified timestamp, approver role (`demo_reviewer`), and vault metadata.
   - Edit the draft copy; observe status resets to `draft` server-side and the locked snapshot clears.
8. **View Insights**: Click the **Insights** tab in the navigation bar to inspect real session counts pulled live from the database for each citation ID (`F-12`, `R-04`, `A-02`, etc.).

---

## What It Does (Completed Features Only)

* **Demo Brand & Guest Demo Mode**: Instant access with zero login wall; unauthenticated visitors test the full lifecycle end-to-end.
* **Brand Vault**: Single source of truth grouping Facts, Governance Rules, Restricted Terminology, and Approved Palettes.
* **Deterministic Review Engine**: Primary server-side safety gate enforcing pricing consistency, superlative evidence checks, terminology mapping, and image alt text.
* **Grounded Gemini AI Review**: Secondary layer providing advisory compliance suggestions grounded exclusively in retrieved vault items with server-side citation validation.
* **One-Click Apply Fix**: Immediate text remediation with immutable versioning (`draft_versions`) and zero leftover word fragments.
* **Asset & Visual Checks**: Client-side canvas dominant color sampling (labeled "Approximate"), WCAG 2.1 contrast calculation (21:1 baseline), and mandatory reviewer logo confirmation (A-02).
* **Role-Separated Approval State Machine**: Server-side governance (`draft` -> `checked` -> `pending_approval` -> `approved`), preventing self-approval (HTTP 403) and locking approved snapshots.
* **Live Database Insights**: Real aggregated violation counts grouped by citation ID pulled directly from PostgreSQL.
* **Supabase Authentication**: Optional email/password accounts for real Creators and Reviewers with profile role management.

---

## Architecture & Exact Tech Stack

* **Frontend**: React + TypeScript (Vite) + Tailwind CSS, deployed on **Vercel** ([https://brand-gate-rho.vercel.app/](https://brand-gate-rho.vercel.app/)).
* **Backend API**: Python FastAPI, deployed on **Render** free tier ([https://brandgate-codex-48.onrender.com](https://brandgate-codex-48.onrender.com)).
* **Database**: PostgreSQL hosted on **Supabase** with `pgvector` enabled and automatic keyword-retrieval fallback active when embeddings are unpopulated.
* **Authentication**: Supabase Auth (email + password).
* **Storage**: Supabase Storage public bucket `brandgate-creatives` (demo images open without sign-in).
* **AI Provider**: Google Gemini via Google AI Studio (`gemini-3.5-flash-lite`, retrieval-only context, citation-validated, 60s timeout, labeled unavailable on failure).
* **Gate Architecture**: Deterministic review is the authoritative primary gate; Gemini provides secondary suggestions only.

---

## Seeded Brand Vault IDs

The seeded demo brand (`Demo Brand (Seeded)`) contains these exact ground-truth records:

* **Facts**: `F-12` — Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026. (Demo draft wrongly claims Rs. 999, triggering a high-severity Contradiction).
* **Rules**:
  - `R-04`: Rank and performance superlatives require an approved evidence record. Seeded vault has none -> returns *Evidence Needed*, NEVER *Contradiction* and never labeled false.
  - `A-02`: Current approved logo file only; reviewer-confirmed only, never automatic.
  - `R-09`: Every creative requires descriptive alt text.
* **Terminology**: `T-01` ("clinically proven"), `T-02` ("India's No. 1"), `T-03` ("certified quality"), `T-04` ("trusted by millions").
* **Palette**: `P-01` (`#1E3A8A`), `P-02` (`#D97706`), `P-03` (`#F8FAFC`), `P-04` (`#0F172A`). (Sampling is Approximate, Human Decision lane only, never Contradiction).
* **Demo Draft Input**: `"Diwali Dhamaka! India's No. 1 cookware brand — clinically proven non-stick — now for just Rs. 999!"`
* **Post-Fix Copy**: `"Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"` (Zero occurrences of "No. 1").

---

## 5 Verified Test Fixtures

| # | Test Scenario | Input Text / Asset | Expected Outcome |
|---|---|---|---|
| **1** | **Fully Compliant Post** | `"Festive cookware offer Rs. 1,299. Certified quality guaranteed."` | 0 Contradictions. F-12 price matches; no unauthorized claims. Passes cleanly. |
| **2** | **Pricing Contradiction** | Copy contains `"Rs. 999"` | Flags `contradiction` citing `F-12`. One-click fix updates text to `"Rs. 1,299"`. |
| **3** | **Unsubstantiated Superlative** | Copy contains `"India's No. 1 cookware brand"` | Flags `evidence_needed` citing `R-04` (not labeled false). Applying fix removes `"No. 1"` entirely, replacing with `"trusted"`. |
| **4** | **Off-Palette & Missing Alt Text** | Off-palette image + blank alt text | Generates `human_decision` (Approximate) citing `P-01` and `human_decision` citing `R-09`. Entering alt text clears `R-09`. |
| **5** | **Creator Self-Approval & Post-Approval Edit** | Creator attempts to approve draft; or edits copy after approval | Self-approval blocked with HTTP 403 (*"Creator cannot approve their own draft"*). Modifying approved copy resets status back to `draft` server-side and clears the locked snapshot. |

---

## Honest Limitations

1. **Render Free-Tier Cold Starts**: Render free-tier services sleep after inactivity. The first request takes 30–60 seconds while the container boots; the frontend displays `"Waking up server... please wait, retrying..."` during this period.
2. **Browser Network Blocking (Ad Blockers / Brave Shield)**: If a client extension blocks requests with `net::ERR_BLOCKED_BY_CLIENT`, the interface displays `"Connection blocked by browser extension — disable ad blocker / Brave Shield for this site, then click Retry"` with an immediate **Retry connection** button instead of a misleading generic offline error.
3. **Google Gemini Free-Tier Availability**: `gemini-2.5-flash` returned HTTP 404 (deprecated for new users) and `gemini-3.8-flash` returned HTTP 503 during demand spikes; the system automatically falls back to active `gemini-3.5-flash-lite`.
4. **Approximate Palette Sampling**: Client-side canvas extraction is explicitly labeled `"Approximate"` and produces advisory Human Decision findings rather than automated rejections.
5. **Reviewer-Confirmed Logo Inspection**: Automated computer-vision logo detection is never claimed. Rule `A-02` requires reviewer confirmation.
6. **AI Suggestions as Secondary Gate**: Language model reviews are advisory suggestions grounded exclusively in retrieved vault items. The deterministic engine remains the primary gate.

---

## Free-Tier Operational Costs

* **Total Cost**: **₹0.00 / $0.00** (Zero credit card required).
* Entire infrastructure runs on free developer tiers:
  - Vercel Free Tier (Frontend CDN)
  - Render Free Tier (FastAPI Web Service)
  - Supabase Free Tier (PostgreSQL Database, Auth, Storage)
  - Google AI Studio Free Tier (Gemini API)

---

## Three Locked Improvements for Round 3

1. **Multi-Brand Workspaces**: Tenant-scoped brand vaults, isolated draft pipelines, and dedicated reviewer permissions beyond the single seeded demo brand.
2. **DOCX/PDF Extraction**: Native document ingestion extracting formatted text and embedded image creatives to run pre-publication governance on complete document files.
3. **Guideline-Clarity Insights v2 & Hardened Image Checks**: Historical frequency analysis highlighting ambiguous brand rules that trigger recurring author violations, paired with deeper palette and contrast analytics.

---

## Local Development (Zero Secrets Committed)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Required environment variables in `backend/.env` (names only):
* `SUPABASE_URL`
* `SUPABASE_SERVICE_KEY`
* `LLM_PROVIDER=gemini`
* `GEMINI_API_KEY`
* `LLM_MODEL=gemini-3.5-flash-lite`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Required environment variables in `frontend/.env` (names only):
* `VITE_API_URL=http://localhost:8000`
* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`

*Security rule: Never commit `.env` files. Never place the Supabase service role key in frontend source code or environment files.*
