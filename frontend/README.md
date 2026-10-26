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

## Acceptance Testing Guide

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. Click **"Try the demo draft"** on the home page.
3. Observe the Submit page loaded with the exact Diwali cookware draft text.
4. Click **"Review Draft"** and observe the Report page with:
   - Price contradiction cited `F-12` with suggested fix `"Rs. 1,299"`.
   - Evidence needed findings cited `R-04` for superlative claims.
   - Zero findings without citation IDs.
5. Click **"Apply Fix: 'Rs. 1,299'"** and confirm the contradiction disappears and the version updates to `v2`.
6. Terminate the backend server, refresh the browser, and observe the status badge change to **"API offline — local demo mode"**.
