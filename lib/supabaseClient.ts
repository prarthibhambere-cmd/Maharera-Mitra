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
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
