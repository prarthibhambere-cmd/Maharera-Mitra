# Architecture

Technical deep-dive into how MahaRERA-Mitra works under the hood. For setup steps, see [SETUP.md](SETUP.md).

---

## System overview

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Next.js client)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Sidebar   │  │  ChatWindow  │  │   AuthModal    │  │
│  │  + Sessions │  │  + Streaming │  │ Email/Google/  │  │
│  │  + Auth blk │  │  + Citations │  │     Phone      │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│         │                │                  │            │
│         │                │           ┌──────▼──────┐    │
│  ┌──────▼──────┐  POST   │           │ lib/auth.ts │    │
│  │ localStorage│  /api/  │           │ + useAuth() │    │
│  │  (guests)   │  chat   │           └──────┬──────┘    │
│  └─────────────┘         │                  │           │
└─────────────────│────────│──────────────────│───────────┘
                  │        │                  │
        ┌─────────▼────────▼──────┐  ┌────────▼──────────┐
        │   Next.js Route Handler │  │   Supabase Auth   │
        │   /api/chat (Node)      │  │   (OAuth + JWT)   │
        │                         │  └────────┬──────────┘
        │  1. Parse PDF if any    │           │
        │  2. Chunk + embed       │  ┌────────▼──────────┐
        │  3. Cosine search DB    │  │  Supabase DB      │
        │  4. Stream Gemini       │  │  • maharera_      │
        │  5. X-Citations header  │  │    knowledge      │
        └───────────┬─────────────┘  │  • chats (RLS)    │
                    │                └────────┬──────────┘
                    │  embedContent /         │
                    │  generateContentStream  │
        ┌───────────▼─────────────┐           │
        │   Google Gemini API     │           │
        │  gemini-embedding-001   │◀──────────┘
        │  gemini-2.5-flash       │ (RPC for vector search)
        └─────────────────────────┘
```

---

## RAG pipeline (`/api/chat`)

When the user sends a message (with or without a PDF attached):

### Step 1 · Request shape
```ts
POST /api/chat
Content-Type: multipart/form-data

messages: JSON string of [{ role, content }, ...]
file?: PDF blob (optional)
```

### Step 2 · PDF ingestion (if attached)
1. **Validate** — max 10 MB, must be PDF mime/extension
2. **Extract text** via `pdf-parse` v3 (`PDFParse` class wrapping pdfjs-dist)
3. **Reject empty extractions** — common for scanned-image PDFs without a text layer
4. **Chunk** — 1500 chars with 150-char overlap. The overlap preserves context across chunk boundaries.
5. **Embed each chunk** — `gemini-embedding-001` with `outputDimensionality: 768` (Matryoshka truncation)
6. **Bulk insert** into `maharera_knowledge` with `source_type='user-upload'`, attaching chunk index + page count in metadata
7. Pass the first ~8 KB of extracted text along to the LLM as direct context for analysis

### Step 3 · Knowledge-base retrieval
The user's last question is embedded and matched against canonical RERA sources:

```ts
const { data } = await db
  .from("maharera_knowledge")
  .select("id, source_type, title, content, metadata, embedding")
  .in("source_type", ["act", "circular"])  // user-uploads excluded from citations
  .not("embedding", "is", null);

const scored = data
  .map((row) => ({ ...row, similarity: cosineSimilarity(queryEmb, parse(row.embedding)) }))
  .filter((r) => r.similarity > 0.62)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, 5);
```

**Why JS-side and not pgvector RPC?** The PostgREST RPC consistently returned empty arrays even with valid embeddings, likely a parameter-routing issue with `vector(768)` typing. JS-side cosine is bulletproof for sub-10K row knowledge bases. For larger archives, the SQL function at `supabase/migrations/03_rebuild_match_function.sql` is intact and can be re-enabled.

**Why exclude user-uploads from citations?** The user's own document is the *subject* of analysis, not a *source*. Citing it back to them is noise. (Their uploaded text still goes to the LLM via the parallel `uploadedContext` channel.)

### Step 4 · Prompt assembly
```
[SYSTEM] You are MahaRERA Mitra...

[USER] # RETRIEVED MAHARERA KNOWLEDGE BASE
[Source: circular — "MahaRERA Circular 27/2022 ..." (relevance 0.78)]
<full content>
---
[Source: act — "RERA Act 2016 — Section 18 ..." (relevance 0.67)]
<full content>

=====

# USER-UPLOADED DOCUMENT (excerpt)
<first 8KB of extracted PDF text>

=====

# USER QUESTION

<original user message>
```

### Step 5 · Streaming response
- `gemini-2.5-flash` via `generateContentStream`
- Each chunk written to a `ReadableStream` → chunked HTTP response
- Citations sent **out-of-band** in the `X-Citations` response header (base64-encoded JSON) so the UI can render chips while text streams

### Step 6 · Client-side rendering
- `ChatWindow` reads `X-Citations` header before consuming the body
- Citations attached to the assistant message immediately (chips appear in parallel with text)
- Text streamed via `getReader().read()` loop, appended to message state
- Markdown parsed line-by-line: headings, bullets, **bold**, and the **entity grid** (see below)

---

## Entity grid parser

When the model emits structured "label: value" lines for known RERA entities, they're rendered as a card grid instead of plain bullets — closer to how legal documents present metadata.

**Detection:** consecutive lines matching either `**Label:** value` or `Label: value`, where `Label` is in the known set:

```
licensor, licensee, promoter, allottee, developer, builder,
project, project name, rera number, rera registration,
maharera registration, possession, possession date,
consideration, total consideration, carpet area, ...
```

2+ matching lines form an entity group, rendered as `grid-cols-1 md:grid-cols-2` with each entry as a card:

```
┌──────────────────────────┐ ┌──────────────────────────┐
│ PROMOTER                 │ │ ALLOTTEE                 │
│ Lodha Developers Ltd     │ │ John & Mary Doe          │
└──────────────────────────┘ └──────────────────────────┘
```

Implementation in `components/ChatWindow.tsx` → `parseBlocks()` + `EntityGrid`.

---

## Auth flow

### Email/password (zero-config)
1. User submits form
2. `signInWithPassword({ email, password })` → Supabase validates, returns session
3. `onAuthStateChange` listener in `useAuth()` fires, updates UI
4. Sidebar swaps "Sign in" button for user avatar block

### Google OAuth (PKCE)
1. User clicks "Continue with Google"
2. `signInWithOAuth({ provider: "google", options: { redirectTo: "/auth/callback" } })`
3. supabase-js generates a code_verifier, stores in localStorage, redirects browser to Google
4. User consents; Google redirects to `https://YOUR-PROJECT.supabase.co/auth/v1/callback?code=GOOGLE_CODE`
5. Supabase exchanges the Google code for Google tokens, creates a Supabase session, redirects to `http://localhost:3001/auth/callback?code=SUPABASE_CODE`
6. **`app/auth/callback/page.tsx`** (client component) explicitly calls `exchangeCodeForSession(SUPABASE_CODE)` using the stored verifier
7. On success, `router.replace("/")` (no full reload, preserves session)
8. `onAuthStateChange` fires, UI updates

**Why a client page and not a route handler?** Server-side route handlers can't access the PKCE verifier in localStorage. They can only do server-side redirects, which race with supabase-js's `detectSessionInUrl` and silently lose the code. The explicit client-page approach is deterministic and surfaces errors directly to the user.

### Phone OTP (requires SMS provider)
1. User enters phone number → `signInWithOtp({ phone })` → Supabase sends SMS via configured provider
2. User enters 6-digit OTP → `verifyOtp({ phone, token, type: "sms" })`
3. Supabase returns session; same `onAuthStateChange` path

---

## Chat sync: guest ↔ authenticated

Sessions are stored in **one of two places** depending on auth state:

| State | Storage |
|---|---|
| Guest (not signed in) | `localStorage["maharera-sessions-v1"]` as JSON |
| Signed in | Supabase `chats` table, scoped by `user_id` via RLS |

### Source switching
`app/page.tsx` has a single `useEffect` keyed on `[user, authLoading]` that reloads sessions whenever auth state changes:

- On **mount** as guest → loads from localStorage
- On **sign-in** → loads from Supabase
- On **sign-out** → loads from localStorage

### Guest → user migration
On the **first** time a user signs in (detected by comparing current `user.id` to the ref-tracked previous one):

```ts
const local = loadLocalSessions();
if (local.length > 0) {
  await migrateLocalToDb(user.id, local);  // upsert all rows with user_id
  clearLocalSessions();
}
```

The migration is idempotent (upsert by `id`), so re-running doesn't duplicate.

### Per-write sync
Every change to `sessions` state triggers a `useEffect` that:
- If signed in → upserts changed rows to Supabase
- If guest → writes the full sessions array to localStorage

Only sessions with at least one message are upserted to the DB — avoids churning rows for empty sessions the user never sends in.

### RLS policies
The `chats` table has four RLS policies, all keyed on `auth.uid() = user_id`:

```sql
create policy "Users view own chats"   on chats for select using (auth.uid() = user_id);
create policy "Users insert own chats" on chats for insert with check (auth.uid() = user_id);
create policy "Users update own chats" on chats for update using (auth.uid() = user_id);
create policy "Users delete own chats" on chats for delete using (auth.uid() = user_id);
```

Even with a leaked anon key, users can never see each other's chats.

---

## Why some non-obvious choices

### Streaming via `ReadableStream`, not Server-Sent Events
SSE adds an event-framing protocol that the client must parse. For plain-text streaming with no special event types, a raw chunked response is simpler. Citations metadata rides in the `X-Citations` response header — read once before consuming the body. Could be migrated to SSE if we needed multiple event types (e.g., `tool_call`, `thinking`).

### `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]`
Turbopack bundles pdfjs-dist by default, which breaks its dynamic worker resolution at runtime (`Cannot find module 'pdf.worker.mjs'`). Marking it external keeps it as a runtime node_modules import.

### `devIndicators: false`
The floating Next.js dev button at bottom-right has no end-user value and clutters screenshots/demos. Disabled in dev; production is unaffected.

### Two separate Supabase clients
- **`getSupabase()`** in `lib/supabaseClient.ts` — server-side admin client (uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS)
- **`getBrowserClient()`** in `lib/auth.ts` — browser client (uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`, respects RLS, has `persistSession: true`)

The browser client is used for both auth state AND user-scoped DB queries (chats table) because RLS needs the user's JWT to flow through.

### Cosine threshold of 0.62
Empirically tuned for `gemini-embedding-001` at 768 dims. Below this, matches are too tangential to add useful context. Adjust in `app/api/chat/route.ts` → `RAG_MATCH_THRESHOLD`.

---

## Files worth knowing

| File | Why it matters |
|---|---|
| `app/api/chat/route.ts` | The entire RAG pipeline — chunking, embedding, retrieval, streaming |
| `app/page.tsx` | Session orchestration, guest↔user sync, migration logic |
| `app/auth/callback/page.tsx` | OAuth code exchange — explicit, no race conditions |
| `components/ChatWindow.tsx` | Streaming buffer (useRef pattern), markdown parser, entity grid, citation chips |
| `components/Sidebar.tsx` | Session CRUD, inline rename/delete, auth state UI |
| `lib/auth.ts` | Browser Supabase client + all sign-in helpers |
| `hooks/useAuth.ts` | Reactive auth state via `onAuthStateChange` subscription |
| `supabase/migrations/04_auth_chats_table.sql` | RLS-protected per-user chat storage |

---

## Future work

- **Real circular scraper** — `scripts/scrape-maharera-circulars.ts` is currently a stub. Implementing it requires fetching `maharera.maharashtra.gov.in`'s circulars table, downloading each PDF, and running the same chunk-and-embed pipeline.
- **OCR for scanned PDFs** — current `pdf-parse` fails on image-only PDFs. Could add Google Cloud Vision or Tesseract fallback.
- **Re-enable pgvector RPC** — for scaling past 10K rows. The infrastructure is intact; the migration is in `supabase/migrations/03_*.sql`.
- **Server Actions** instead of Route Handler — could simplify client/server boundary, but Route Handler is fine for streaming.
- **Realtime sync** — Supabase Realtime could push chat updates to other tabs/devices for the same user.
