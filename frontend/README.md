# BrandGate Frontend

React + TypeScript + Vite + Tailwind CSS frontend for BrandGate.

---

## Architectural Principles

- **Zero Direct Supabase**: The frontend never communicates with Supabase directly. All operations pass through the FastAPI backend (`VITE_API_URL`).
- **Dynamic Brand Discovery**: Never hard-codes brand IDs. Dynamically fetches brands via `GET /api/brands` on load.
- **Offline Resilience**: Displays a live connection indicator and falls back honestly to local demo check mode if the backend is unreachable.

---

## Local Setup & Running

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

The frontend reads configuration through Vite environment variables (`import.meta.env`):

| Variable Name | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Points to the FastAPI backend API |

---

## Phase 6 Image Checks, Storage & Insights Guide

1. **Supabase Storage Bucket Creation (Manual Step)**:
   - In your Supabase web dashboard, navigate to **Storage**.
   - Create a bucket named `brandgate-creatives` with **Public bucket** set to **ON**.
2. **Submit Page Testing**:
   - Upload an image file. The client samples dominant colors (labeled "Approximate") and uploads to `brandgate-creatives`.
   - Test the interactive WCAG Contrast Checker: verify black text on white shows `21:1` and passes AA.
   - Confirm the Logo check checkbox (A-02): leaving unchecked generates an A-02 review flag; checking it clears the flag.
3. **Report Page**:
   - Verify that applying the `F-12` fix and both `R-04` fixes replaces `"India's No. 1"` cleanly with `"trusted"`, leaving zero occurrences of `"No. 1"`.
4. **Insights Tab**:
   - Click **Insights** in the navigation bar to inspect real session counts pulled live from the database for each citation ID (`F-12`, `R-04`, `A-02`, etc.).


