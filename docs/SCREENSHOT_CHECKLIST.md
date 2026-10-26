# BrandGate Round 2 Submission — Screenshot & Evidence Checklist

Capture these 6 live production screenshots directly from the deployed link:
**https://brand-gate-rho.vercel.app/** (in an Incognito / Private window with zero login).

---

## The 6 Required Screenshots

1. **Screenshot 1 — Homepage & Value Proposition**:
   - **URL**: `https://brand-gate-rho.vercel.app/`
   - **View**: Hero heading *"BrandGate"*, tagline *"The gate every post must pass before it goes public."*, core guarantee *"No citation, no flag."*, and the primary *"Try the demo draft"* button clearly visible above the fold.
   - **Key Detail**: Top navigation bar showing `"Seeded demo brand"` and `"API connected"`.

2. **Screenshot 2 — Seeded Demo Draft & Governance Review Report**:
   - **URL**: `https://brand-gate-rho.vercel.app/` -> Click *"Try the demo draft"* -> Click *"Review Draft"*.
   - **View**: Report page displaying:
     - `F-12` Contradiction (Rs. 999 vs approved Rs. 1,299).
     - Two `R-04` Evidence Needed findings for *"India's No. 1"* and *"clinically proven"*.
     - Zero uncited findings.

3. **Screenshot 3 — One-Click Remediation & Clean Version History**:
   - **Action**: Click *"Apply Fix: 'Rs. 1,299'"*, *"Apply Fix: 'trusted'"*, and *"Apply Fix: 'certified quality'"*.
   - **View**: Clean updated copy:  
     `"Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"`
   - **Key Detail**: Notice **zero occurrences of "No. 1"** anywhere and version badge showing `Version 4`.

4. **Screenshot 4 — Grounded AI Review & Image Governance**:
   - **View**: Grounded AI Review section displaying active model `gemini-3.5-flash-lite`, retrieved citation IDs, and grounded suggestions with the honest AI disclosure note.
   - **Image Checks**: Attached creative image showing WCAG 21:1 contrast pass and reviewer logo confirmation.

5. **Screenshot 5 — Locked Approved Snapshot & Decision Audit Log**:
   - **Action**: In Review tab, click *"Request Approval"*, switch role to **Reviewer**, click *"Approve Draft"*.
   - **View**: Prominent teal `LOCKED APPROVED SNAPSHOT` card displaying `VERIFIED COMPLIANT`, approver role (`demo_reviewer`), timestamp, and the immutable version history timeline.

6. **Screenshot 6 — Real Database Session Insights**:
   - **URL**: Click *"Insights"* tab in navigation bar.
   - **View**: Aggregated violation counts grouped by citation ID (`F-12`, `R-04`, `A-02`, etc.) matching actual database records with zero counts displayed as `0`.

---

## Required Submission PDF Sections

1. **Cover & Metadata**:
   - Product: BrandGate
   - Live URL: `https://brand-gate-rho.vercel.app/`
   - API URL: `https://brandgate-codex-48.onrender.com`
   - Health URL: `https://brandgate-codex-48.onrender.com/health`
   - Repository: `https://github.com/manthansingh26/BrandGate-Codex-48`
   - Team: Solo team — `Straw hat pirate`
   - Leader: `Manthan ShravanSingh Rajpurohit`

2. **What Works Now (Central Judge Path)**:
   - Zero login barrier guest demo journey.
   - 8-step walkthrough in order.

3. **Architecture & Implementation Details**:
   - Dual-deploy monorepo (Vercel + Render).
   - Supabase PostgreSQL + `pgvector` with keyword fallback.
   - Deterministic rule engine + secondary Google Gemini (`gemini-3.5-flash-lite`) review.

4. **Changes vs. Round 1 Plan**:
   - LLM provider switch (NVIDIA NIM -> Google Gemini via Google AI Studio).
   - Model upgrade to `gemini-3.5-flash-lite` (handling 2.5-flash 404 & 3.8-flash 503).
   - Review call timeout increased from 15s to 60s.
   - Connection resilience: Render cold start handling (70s timeout, 90s retries, `ERR_BLOCKED_BY_CLIENT` ad-blocker guidance).
   - Server-side approval state machine and locked snapshot immutability.

5. **3 Locked Round 3 Improvements**:
   1. Multi-brand workspaces.
   2. DOCX/PDF extraction.
   3. Guideline-clarity insights v2 + hardened image checks.
