# MahaRERA-Mitra

> AI compliance assistant for the **Maharashtra Real Estate Regulatory Authority** (MahaRERA). Drag in an Agreement for Sale or Layout Approval PDF, ask questions in plain English, and get answers grounded in the RERA Act 2016 and MahaRERA circulars — with real source citations.

Streaming chat over a Supabase + pgvector knowledge base, served by Google Gemini, with full Supabase Auth (email / Google / phone OTP) and per-user chat history.

---

## Features

| Area | What it does |
|---|---|
| 🤖 **Streaming RAG chat** | Real-time Gemini 2.5 Flash responses grounded in MahaRERA circulars + RERA Act sections, with cosine-similarity retrieval over `gemini-embedding-001` vectors |
| 📄 **PDF analysis** | Drop in any Agreement for Sale or Layout Approval — extracted, chunked (1500 chars w/ 150 overlap), embedded, and analyzed inline |
| 🏷️ **Source citations** | Each AI reply shows which RERA sections / circulars informed it, with similarity % per source |
| 🧾 **Entity grid parser** | When the AI lists structured entities (Promoter, Allottee, Project Name, RERA Number…), they render as a metadata card grid instead of plain bullets |
| 🔐 **Three auth methods** | Email/password, Google one-click, phone OTP (UI scaffolded for all three) |
| 💾 **Per-user chat sync** | Sessions persist in Supabase when signed in, localStorage when guest — guest chats auto-migrate on first sign-in |
| ✏️ **Session management** | Inline rename + inline delete confirm on every chat in the sidebar |
| 🎨 **Premium UI** | Dark zinc-900 sidebar + amber accents, light zinc-50 workspace, floating dock input |

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/prarthibhambere-cmd/Maharera-Mitra.git
cd Maharera-Mitra

# 2. Install
npm install

# 3. Configure (see SETUP.md for details)
cp .env.example .env.local
# Edit .env.local with your Supabase + Gemini keys

# 4. Run database migrations
# Paste contents of supabase/migrations/*.sql into your Supabase SQL Editor

# 5. (Optional) Seed demo RERA documents
npx tsx --env-file=.env.local scripts/seed-demo-data.ts

# 6. Start
npm run dev
# → http://localhost:3001
```

Full setup walkthrough including Supabase project creation, Google OAuth credentials, and seeding the knowledge base is in **[docs/SETUP.md](docs/SETUP.md)**.

---

## Tech stack

**Frontend** · Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · lucide-react · Inter font

**AI** · `@google/genai` SDK · `gemini-2.5-flash` for chat · `gemini-embedding-001` for 768-dim embeddings (Matryoshka-truncated)

**Backend** · Supabase (PostgreSQL + Auth + RLS) · `pgvector` for vector similarity · `pdf-parse` for server-side PDF extraction

**State** · React `useState` with controlled-component pattern · `localStorage` for guest sessions · Supabase `chats` table with RLS for authenticated sessions

For a deeper technical dive — RAG pipeline internals, auth flow, the entity-grid parser, chat sync logic — see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Project structure

```
.
├── app/
│   ├── api/chat/route.ts          # Streaming RAG endpoint (PDF ingest + retrieval + Gemini)
│   ├── auth/callback/page.tsx     # OAuth PKCE code exchange
│   ├── layout.tsx                 # Root layout, Inter font
│   ├── page.tsx                   # Home — session orchestration, chat sync
│   └── globals.css                # Tailwind 4 + scrollbar + prose tweaks
├── components/
│   ├── ChatWindow.tsx             # Message rendering, streaming, citations, entity grid
│   ├── Sidebar.tsx                # Dark sidebar + session CRUD + auth block
│   ├── FileUploadZone.tsx         # Drag-drop PDF zone
│   └── AuthModal.tsx              # Tabbed email/Google/phone sign-in
├── hooks/
│   └── useAuth.ts                 # Reactive Supabase auth state hook
├── lib/
│   ├── supabaseClient.ts          # Server-side admin client + types
│   ├── auth.ts                    # Browser-side client + sign-in helpers
│   └── gemini.ts                  # Gemini SDK wrapper + embedding helper
├── scripts/
│   ├── seed-demo-data.ts          # Seed 5 realistic RERA documents
│   ├── debug-similarity.ts        # Inspect cosine scores for a query
│   ├── make-test-pdf.ts           # Generate a minimal valid PDF for testing
│   ├── test-rpc-roundtrip.ts      # Verify Supabase RPC + embedding pipeline
│   └── scrape-maharera-circulars.ts  # Scaffold for live circular scraper
├── supabase/migrations/
│   ├── 01_init_maharera.sql       # maharera_knowledge table + match function
│   ├── 02_fix_match_function.sql  # Iterative fix attempts
│   ├── 03_rebuild_match_function.sql
│   └── 04_auth_chats_table.sql    # chats table with RLS for per-user sync
├── next.config.ts                 # serverExternalPackages for pdfjs-dist
├── .env.example                   # Env var template
└── docs/
    ├── SETUP.md
    └── ARCHITECTURE.md
```

---

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIzaSy...
```

See `.env.example` for the template. See [docs/SETUP.md](docs/SETUP.md) for where to get each value.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |
| `npx tsx --env-file=.env.local scripts/seed-demo-data.ts` | Seed 5 realistic RERA Act sections + MahaRERA circulars |
| `npx tsx --env-file=.env.local scripts/debug-similarity.ts` | Inspect raw cosine similarity scores for a hard-coded query |
| `npx tsx scripts/make-test-pdf.ts` | Generate `test-agreement.pdf` for local upload testing |

---

## Known limitations

- **Phone OTP** requires Supabase Pro or your own Twilio account — UI is there but won't send SMS on free tier
- **JS-side cosine search** in `/api/chat` scales to ~10K knowledge-base rows. For larger archives, restore the pgvector RPC path (see commented code in `app/api/chat/route.ts`)
- **Scanned PDFs** without an embedded text layer fail with `PDF contains no extractable text` — OCR is not implemented
- **Test users restriction** on Google OAuth: until you publish the OAuth consent screen, only emails added under "Test users" in Google Cloud can sign in

---

## License

MIT — do whatever you want with it.

---

🤖 *Built with Claude Code*
