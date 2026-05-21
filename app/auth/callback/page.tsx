"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { getBrowserClient } from "@/lib/auth";

/**
 * OAuth callback page.
 *
 * Supabase redirects here after the provider (Google) completes its side.
 * Depending on flow type, the credential arrives as either:
 *   - ?code=...      (PKCE flow — needs explicit exchange)
 *   - #access_token  (implicit flow — supabase-js picks up from hash)
 *   - ?error=...     (provider error)
 *
 * The inner component uses useSearchParams() and must be wrapped in
 * <Suspense> so Next.js can render a fallback during static generation
 * without erroring out (CSR bailout requirement in App Router).
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackShell variant="working" />}>
      <AuthCallbackInner />
    </Suspense>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();

    // Provider returned an error directly (e.g. user denied consent)
    const providerError =
      params.get("error_description") || params.get("error");
    if (providerError) {
      setStatus("error");
      setErrorMessage(providerError);
      return;
    }

    const code = params.get("code");

    async function finish() {
      try {
        if (code) {
          // PKCE flow: exchange the code for a session using the verifier
          // that supabase-js stashed in localStorage when sign-in started.
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Implicit flow (hash) or already-handled — give supabase-js a
          // tick to process the URL hash if present, then check session.
          await new Promise((r) => setTimeout(r, 100));
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) {
            throw new Error(
              "No code or session found in callback URL. The OAuth flow may have been interrupted."
            );
          }
        }
        router.replace("/");
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Sign-in failed."
        );
      }
    }

    void finish();
  }, [params, router]);

  if (status === "error") {
    return (
      <CallbackShell
        variant="error"
        errorMessage={errorMessage}
        onBack={() => router.replace("/")}
      />
    );
  }
  return <CallbackShell variant="working" />;
}

function CallbackShell({
  variant,
  errorMessage,
  onBack,
}: {
  variant: "working" | "error";
  errorMessage?: string | null;
  onBack?: () => void;
}) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm">
        {variant === "working" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <p className="text-sm font-medium text-zinc-900">
              Completing sign-in…
            </p>
            <p className="text-xs text-zinc-500">
              Exchanging credentials with Supabase
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm font-semibold text-zinc-900">
              Sign-in failed
            </p>
            <p className="text-xs leading-relaxed text-zinc-600">
              {errorMessage}
            </p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Back to app
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
