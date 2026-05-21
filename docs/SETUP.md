# Setup Guide

Step-by-step walkthrough to get MahaRERA-Mitra running locally with real Supabase + Gemini credentials.

**Estimated time:** 15 minutes for email-only setup, +10 minutes for Google OAuth, +external SMS provider for Phone OTP.

---

## 1. Prerequisites

- **Node.js 18+** and npm
- **Supabase account** (free tier works) — https://supabase.com
- **Google account** for Gemini API access — https://aistudio.google.com
- (Optional) **Google Cloud Console access** for OAuth — https://console.cloud.google.com

---

## 2. Clone and install

```bash
git clone https://github.com/prarthibhambere-cmd/Maharera-Mitra.git
cd Maharera-Mitra
npm install
```

---

## 3. Create your Supabase project

1. Sign in at https://supabase.com and click **New Project**
2. Name it `maharera-mitra` (or whatever), pick a region close to you, set a strong DB password, click **Create**
3. Wait ~2 minutes for provisioning

### Grab the connection keys

In your Supabase project dashboard:

1. Click **Settings (gear) → API**
2. Copy these three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Project API keys → `anon` `public`** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Project API keys → `service_role` `secret`** (click Reveal) → `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ The `service_role` key bypasses Row Level Security. **Server-side only**, never expose it to the browser.

---

## 4. Get your Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **Create API key** → pick "Create API key in new project"
4. Copy the key (starts with `AIzaSy...`) → `GEMINI_API_KEY`

---

## 5. Configure `.env.local`

In the project root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and paste the four values you just collected:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIzaSy...
```

> 🔒 `.env.local` is gitignored. Your secrets stay local.

---

## 6. Run the database migrations

In Supabase Dashboard, go to **SQL Editor → New query**. Paste each migration file's contents from `supabase/migrations/`, click **Run**, and verify "Success. No rows returned" before moving to the next.

Required migrations (in order):

| File | Creates |
|---|---|
| `01_init_maharera.sql` | `maharera_knowledge` table + pgvector extension + ivfflat index |
| `03_rebuild_match_function.sql` | `match_maharera_documents()` RPC for vector search (skip 02 — it's superseded) |
| `04_auth_chats_table.sql` | `chats` table + RLS policies for per-user sync |

> The current `/api/chat` route does cosine similarity in JS (more reliable), so the `match_maharera_documents` function isn't strictly needed. But running migration 03 keeps the option open for restoring DB-side search later.

---

## 7. (Optional) Seed the knowledge base

Without any documents, the AI falls back to base-model knowledge. To populate 5 realistic RERA Act sections + MahaRERA circulars for demo purposes:

```bash
npx tsx --env-file=.env.local scripts/seed-demo-data.ts
```

Expected output:
```
Seeding maharera_knowledge with demo documents...
  → RERA Act 2016 — Section 11 ... OK
  → RERA Act 2016 — Section 13 ... OK
  → MahaRERA Circular 38/2023 ... OK
  → MahaRERA Circular 27/2022 ... OK
  → RERA Act 2016 — Section 18 ... OK

Done. Total rows in maharera_knowledge: 5
```

You can re-run this safely — each call just appends 5 more rows. To clean up, run `truncate maharera_knowledge;` in Supabase SQL Editor.

---

## 8. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3001** in your browser. You'll land on an empty workspace with 4 suggestion cards. Click any → real Gemini streaming response with citation chips.

---

## 9. (Optional) Configure Google OAuth

Email/password auth works immediately. For Google one-click sign-in:

### 9a. Google Cloud Console

1. Open https://console.cloud.google.com/apis/credentials
2. Click **+ Create credentials → OAuth client ID**
3. **Application type:** Web application
4. **Name:** `MahaRERA-Mitra` (or anything)
5. **Authorized JavaScript origins** — add both:
   - `http://localhost:3001`
   - `https://YOUR-SUPABASE-PROJECT-ID.supabase.co`
6. **Authorized redirect URIs** — add this exact URL:
   ```
   https://YOUR-SUPABASE-PROJECT-ID.supabase.co/auth/v1/callback
   ```
   (No trailing slash. No localhost — Supabase handles the OAuth callback at its own URL.)
7. Click **Create** — popup shows Client ID. Copy it.
8. To get the Client Secret, click your new OAuth client → **Add Secret** → copy immediately (you can't see it again).

### 9b. Add yourself as a test user

While your app is in Testing mode, only test users can sign in.

1. https://console.cloud.google.com/auth/audience
2. Scroll to **Test users → + Add users**
3. Add the Google email you'll sign in with
4. Click **Save**

### 9c. Supabase Dashboard

1. **Authentication → Providers → Google**
2. Toggle **Enable Sign in with Google** to ON
3. Paste **Client ID** and **Client Secret**
4. Click **Save**

### 9d. Configure redirect URLs in Supabase

Supabase has its own redirect-URL allowlist for security.

1. **Authentication → URL Configuration**
2. **Site URL:** `http://localhost:3001`
3. **Redirect URLs:** add both:
   ```
   http://localhost:3001/**
   http://localhost:3001/auth/callback
   ```
4. **Save changes**

Now test: open the app → Sign in → Google → Continue with Google. After Google consent + the brief "Completing sign-in…" callback page, you're in.

---

## 10. (Optional) Configure Phone OTP

Phone OTP requires an SMS provider. Two options:

### Option A: Supabase Pro ($25/month)
- Includes built-in SMS via Twilio
- In Supabase Dashboard → Authentication → Providers → Phone → enable, no extra config needed

### Option B: Your own Twilio account
- Create a Twilio account, buy a phone number
- In Supabase Dashboard → Authentication → Providers → Phone → enable, paste Twilio credentials

The UI in MahaRERA-Mitra is already wired and will work once either path is configured.

---

## 11. (Optional) Deploy to Vercel

1. Push to GitHub (if not already there)
2. Go to https://vercel.com/new → import your repo
3. **Framework preset:** Next.js (auto-detected)
4. **Build & Output Settings:** keep defaults
5. **Environment Variables:** add the same 4 keys from `.env.local`
6. Click **Deploy**

After deploy, **update Supabase URL Configuration** to include your Vercel URL:
- Site URL: `https://your-app.vercel.app`
- Redirect URLs: add `https://your-app.vercel.app/**`

And update Google Cloud Console OAuth client:
- Authorized JavaScript origins: add `https://your-app.vercel.app`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Module not found: pdf-parse/pdf.worker.mjs` | Turbopack bundled pdfjs-dist | Already handled via `serverExternalPackages` in `next.config.ts` |
| Chat returns 502 with "AI service unavailable" | Bad Gemini key, quota exceeded, or model unavailable on free tier | Verify key, check https://ai.dev/rate-limit |
| `models/text-embedding-004 is not found` | Old model name | Already updated to `gemini-embedding-001` in `lib/gemini.ts` |
| Empty citation chips after seeding | RPC type mismatch | Use JS-side cosine path (already the default in `app/api/chat/route.ts`) |
| `Unable to exchange external code` on Google sign-in | Wrong Client Secret in Supabase, or redirect URI mismatch in Google Cloud | Re-paste secret; verify `https://YOUR-PROJECT.supabase.co/auth/v1/callback` is in Google's allowlist exactly |
| User signs in with Google but appears logged out | Site URL / Redirect URLs allowlist mismatch in Supabase | Add `http://localhost:3001/**` to Redirect URLs |
| `PDF contains no extractable text` on upload | Scanned image PDF without text layer | Use a digital PDF, or implement OCR separately |

---

For technical architecture (how RAG works, how chat sync handles guest→user migration, how the entity grid parser works), see **[ARCHITECTURE.md](ARCHITECTURE.md)**.
