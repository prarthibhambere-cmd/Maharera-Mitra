import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface MahareraKnowledge {
  id: string;
  source_type: "circular" | "act" | "user-upload";
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  created_at: string;
}

export interface MatchResult extends MahareraKnowledge {
  similarity: number;
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export function supabaseAdmin(): SupabaseClient {
  // Prefer the service-role key. Fall back to the anon key when the service
  // key isn't readable at runtime (some serverless hosts don't expose it to
  // the function). maharera_knowledge has no RLS, so the anon role can read
  // and write it — this keeps RAG citations and PDF ingestion working even
  // without the runtime service-role secret. The anon key is inlined at build
  // time via NEXT_PUBLIC, so it's always available.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}
