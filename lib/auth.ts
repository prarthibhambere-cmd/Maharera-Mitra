"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-side Supabase client with auth session persistence enabled.
// Reuses the same instance across the app — important because the auth state
// listener and the DB queries must share the same session.
let _browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!_browserClient) {
    _browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return _browserClient;
}

/* ─────────────────────────── Email + password ─────────────────────────── */

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getBrowserClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined,
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = getBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/* ──────────────────────────── Google OAuth ────────────────────────────── */

export async function signInWithGoogle() {
  const supabase = getBrowserClient();
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined,
    },
  });
}

/* ────────────────────────────── Phone OTP ─────────────────────────────── */

export async function sendPhoneOtp(phone: string) {
  const supabase = getBrowserClient();
  return supabase.auth.signInWithOtp({ phone });
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const supabase = getBrowserClient();
  return supabase.auth.verifyOtp({ phone, token, type: "sms" });
}

/* ──────────────────────────────── Sign-out ───────────────────────────── */

export async function signOut() {
  const supabase = getBrowserClient();
  return supabase.auth.signOut();
}
