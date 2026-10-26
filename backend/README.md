# BrandGate Backend API

FastAPI backend service for BrandGate, the pre-publication brand-governance gate.

---

## Access & Security Model

> **CRITICAL ARCHITECTURAL CONTRACT**:
> The frontend **NEVER** talks to Supabase directly. All database interactions and governance logic go strictly through this FastAPI backend, which uses the Supabase service role key server-side.
>
> - **Guest Demo Mode**: Unauthenticated guest requests are permitted exclusively for the seeded demo brand (`Demo Brand (Seeded)` / id `00000000-0000-0000-0000-000000000001`).
> - **Real Accounts & Brands**: Gated behind Phase 5 authentication (JWT verification via FastAPI).
> - **Zero Key Leaks**: The frontend never receives or contains the Supabase service role key or LLM API credentials.

---

## Environment Variables

Copy `.env.example` to `.env` in `/backend`:

```bash
cp .env.example .env
```

Set the required environment variables:

| Variable Name | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes (for db ops) | Your Supabase project URL (`https://xyz.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Yes (for db ops) | Supabase `service_role` secret key (Server-side ONLY) |
| `DATABASE_URL` | Optional | Direct Postgres connection string if using direct SQL driver |
| `FRONTEND_URL` | Optional | Additional allowed CORS origin (e.g. `https://your-app.vercel.app`) |
| `PORT` | Optional | Port for server execution (default: `8000`) |
| `ENVIRONMENT` | Optional | `development` or `production` |

---

## Local Setup & Running

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a Python virtual environment:**
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment:**
   - **Linux / macOS:**
     ```bash
     source .venv/bin/activate
     ```
   - **Windows:**
     ```bash
     .venv\Scripts\activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the development server with reload:**
   ```bash
   uvicorn main:app --reload
   ```

6. **Interactive Documentation (Swagger UI):**
   Open your browser to [http://localhost:8000/docs](http://localhost:8000/docs) to explore and test all endpoints.

---

## API Endpoints (Phase 2)

### Health
- `GET /health` -> `{"status": "ok"}`

### Brands
- `GET /api/brands` -> List all brands.

### Brand Vault
- `GET /api/brands/{brand_id}/vault` -> Vault items grouped by kind (`fact`, `rule`, `terminology`, `palette`).
- `POST /api/brands/{brand_id}/vault` -> Create a vault item (validates `item_id`, `kind`, `title`, `text`).
- `PATCH /api/brands/{brand_id}/vault/{item_id}` -> Edit a vault item (`title`, `text`, `status`).
- `DELETE /api/brands/{brand_id}/vault/{item_id}` -> Delete a vault item.
- `POST /api/brands/{brand_id}/vault/reset-demo` -> Restores the seeded demo vault items (`F-12`, `R-04`, `A-02`, `R-09`, `T-01..04`, `P-01..04`).

### Drafts
- `POST /api/drafts` -> Create a draft (`brand_id`, `title`, `body_text`, `alt_text`, `image_url`). Creates version 1 and status `draft`.
- `GET /api/drafts/{draft_id}` -> Draft with versions, findings, comments, decisions.
- `GET /api/drafts?brand_id={brand_id}` -> List drafts for a brand (newest first).

### Review Engine (Phase 3)
- `POST /api/drafts/{draft_id}/review` -> Runs deterministic 5-check review (Price, Superlatives, Terminology, Tone, Alt-text) against ACTIVE vault items. Enforces server-side Citation Validator ("No citation, no flag"). Sets status `checked`.
- `POST /api/drafts/{draft_id}/apply-fix` -> Applies a finding's `suggested_fix`, increments version number, sets status to `draft`, and returns updated text.
- `POST /api/drafts/{draft_id}/revise` -> Submits revised `body_text` and `alt_text`, creates a new version, and sets status to `draft`.

### Approval Workflow & Decisions (Phase 5)
- `POST /api/drafts/{draft_id}/request-approval` -> Transitions status from `checked` to `pending_approval`. Logs decision.
- `POST /api/drafts/{draft_id}/approve` -> Reviewer role only. Enforces creator separation (creator cannot approve their own draft). In guest mode, records decision as `demo_reviewer`. Transitions status to `approved` and returns locked snapshot object.
- `POST /api/drafts/{draft_id}/request-changes` -> Reviewer role only, requires a non-empty `comment`. Transitions status to `needs_changes`.
- `POST /api/drafts/{draft_id}/comments` -> Adds a collaboration comment tagged with timestamp, draft version, and role.
- `GET /api/drafts/{draft_id}` -> Returns draft with full version history, findings, comments, decision log, and `approved_snapshot` (if approved).

---

## Supabase Auth Configuration (Phase 5)

1. Open your Supabase project dashboard at [supabase.com](https://supabase.com).
2. Go to **Authentication** -> **Providers** -> **Email**.
3. Verify **Email** is **Enabled**.
   - If *Confirm email* is ON: New signups will receive an activation email; UI displays "Check your email to confirm".
   - If *Confirm email* is OFF: Users are signed in directly upon registration.
4. **Guest Demo Mode**: Never requires sign-in. Judges and unauthenticated users can test the entire workflow seamlessly.



---

## Testing Commands (curl)

Set your demo brand ID:
```bash
BRAND_ID="00000000-0000-0000-0000-000000000001"
```

1. **Create a Vault Fact:**
   ```bash
   curl -X POST "http://localhost:8000/api/brands/$BRAND_ID/vault" \
     -H "Content-Type: application/json" \
     -d '{"item_id": "F-99", "kind": "fact", "title": "Test Fact", "text": "Test warranty period 2 years"}'
   ```

2. **Edit the Vault Fact:**
   ```bash
   curl -X PATCH "http://localhost:8000/api/brands/$BRAND_ID/vault/F-99" \
     -H "Content-Type: application/json" \
     -d '{"text": "Test warranty period 3 years"}'
   ```

3. **Delete the Vault Fact:**
   ```bash
   curl -X DELETE "http://localhost:8000/api/brands/$BRAND_ID/vault/F-99"
   ```

4. **Reset the Demo Vault:**
   ```bash
   curl -X POST "http://localhost:8000/api/brands/$BRAND_ID/vault/reset-demo"
   ```

5. **Create a Draft (with Version 1):**
   ```bash
   curl -X POST "http://localhost:8000/api/drafts" \
     -H "Content-Type: application/json" \
     -d '{"brand_id": "'"$BRAND_ID"'", "title": "Diwali Cookware Promo", "body_text": "Get festive cookware offer at Rs. 1,299."}'
   ```

6. **Fetch the Draft Back:**
   Replace `<DRAFT_ID>` with the ID returned by step 5:
   ```bash
   curl "http://localhost:8000/api/drafts/<DRAFT_ID>"
   ```
