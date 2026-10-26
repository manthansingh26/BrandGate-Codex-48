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

## Phase 5 Approval Workflow & Auth Guide

1. Open [http://localhost:5173](http://localhost:5173).
2. Click **"Try the demo draft"** and press **"Review Draft"**.
3. Apply the price fix (`F-12`) so contradictions are resolved.
4. Navigate to the **Review** page:
   - Notice that while in **Creator** mode, the **"Approve Draft"** button is disabled with the notice: *"Reviewer approval required"*.
   - Click **"Request Approval"** to submit the draft for review. Draft status updates to `pending_approval`.
   - In the top navigation bar, toggle the role to **Reviewer**.
   - Click **"Approve Draft"**.
   - Observe the **LOCKED APPROVED SNAPSHOT** banner appear with verified timestamp, approver role (`demo_reviewer`), and compliance metadata.
5. Edit the copy via Submit or apply a new revision. Verify via `GET /api/drafts/{draft_id}` that the draft status resets to `draft` server-side and the locked snapshot is cleared.
6. Optional Real Account Test:
   - Click **"Sign in"** in the top navigation bar and select **"Sign Up"**.
   - Sign up with an email and password. Upon sign in, decisions and comments will be attributed to your authenticated account.
   - Click **"Sign out"** to return to guest demo mode at any time.

