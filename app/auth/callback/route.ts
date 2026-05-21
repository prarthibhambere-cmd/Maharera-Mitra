import { NextResponse, type NextRequest } from "next/server";

// OAuth providers redirect here with a `?code=` (PKCE) param that the
// browser supabase-js client must exchange for a session. We redirect to the
// home page while PRESERVING all query params so `detectSessionInUrl: true`
// can pick the code up and complete the sign-in. Also preserves `?error=` so
// the user sees an error toast on failure.
export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const target = new URL(next, req.url);
  req.nextUrl.searchParams.forEach((value, key) => {
    if (key === "next") return; // don't carry the redirect-target param itself
    target.searchParams.set(key, value);
  });
  return NextResponse.redirect(target);
}
