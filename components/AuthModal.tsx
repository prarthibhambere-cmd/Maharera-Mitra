"use client";

import { useState, useEffect } from "react";
import {
  X,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Phone,
} from "lucide-react";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "@/lib/auth";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "email" | "google" | "phone";
type EmailMode = "signin" | "signup";
type PhoneStep = "enter" | "verify";

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("email");

  // Email state
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone state
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Shared submission state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Reset state whenever the modal opens
  useEffect(() => {
    if (open) {
      setError(null);
      setInfo(null);
      setBusy(false);
    }
  }, [open]);

  function reset() {
    setError(null);
    setInfo(null);
    setBusy(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setBusy(true);
    try {
      if (emailMode === "signin") {
        const { error } = await signInWithEmail(email.trim(), password);
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await signUpWithEmail(email.trim(), password);
        if (error) throw error;
        if (data.session) {
          // Already signed in (email confirmation disabled in Supabase project)
          onClose();
        } else {
          setInfo(
            "Account created. Check your inbox for a confirmation link, then sign in."
          );
          setEmailMode("signin");
          setPassword("");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    reset();
    setBusy(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Browser will redirect to Google. No close needed.
    } catch (err) {
      setBusy(false);
      const msg =
        err instanceof Error ? err.message : "Google sign-in failed.";
      setError(
        msg.includes("provider is not enabled")
          ? "Google sign-in isn't enabled yet. Configure it in Supabase Dashboard → Authentication → Providers → Google."
          : msg
      );
    }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setBusy(true);
    try {
      if (phoneStep === "enter") {
        if (!phone.trim()) {
          setError("Phone number is required (include country code, e.g. +91…).");
          setBusy(false);
          return;
        }
        const { error } = await sendPhoneOtp(phone.trim());
        if (error) throw error;
        setInfo("OTP sent. Check your SMS.");
        setPhoneStep("verify");
      } else {
        if (!otp.trim()) {
          setError("Enter the 6-digit OTP from your SMS.");
          setBusy(false);
          return;
        }
        const { error } = await verifyPhoneOtp(phone.trim(), otp.trim());
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Phone auth failed.";
      setError(
        msg.toLowerCase().includes("sms") ||
          msg.toLowerCase().includes("provider")
          ? "SMS provider isn't configured. Enable a phone provider in Supabase Dashboard → Authentication → Providers (requires a paid plan or Twilio integration)."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Sign in to MahaRERA-Mitra
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Save your chats and access them on any device
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-100 px-6 pt-3">
          <TabButton active={tab === "email"} onClick={() => { setTab("email"); reset(); }}>
            <Mail className="h-3.5 w-3.5" /> Email
          </TabButton>
          <TabButton active={tab === "google"} onClick={() => { setTab("google"); reset(); }}>
            <GoogleIcon /> Google
          </TabButton>
          <TabButton active={tab === "phone"} onClick={() => { setTab("phone"); reset(); }}>
            <Phone className="h-3.5 w-3.5" /> Phone
          </TabButton>
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {tab === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={emailMode === "signup" ? "At least 6 characters" : "••••••••"}
                  autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <FeedbackBanner error={error} info={info} />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {emailMode === "signin" ? "Sign in" : "Create account"}
              </button>
              <p className="text-center text-xs text-zinc-500">
                {emailMode === "signin" ? "New here?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setEmailMode(emailMode === "signin" ? "signup" : "signin");
                    reset();
                  }}
                  className="font-medium text-amber-600 hover:underline"
                >
                  {emailMode === "signin" ? "Create an account" : "Sign in instead"}
                </button>
              </p>
            </form>
          )}

          {tab === "google" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600">
                Sign in with your Google account — no password to remember.
              </p>
              <FeedbackBanner error={error} info={info} />
              <button
                onClick={handleGoogle}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                <strong>Setup required:</strong> In Supabase Dashboard →
                Authentication → Providers → Google, paste your OAuth client ID
                and secret from Google Cloud Console.
              </p>
            </div>
          )}

          {tab === "phone" && (
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              {phoneStep === "enter" ? (
                <div>
                  <label className="text-xs font-medium text-zinc-600">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    autoComplete="tel"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Include country code, e.g. +91 for India
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-zinc-600">
                    OTP for {phone}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-center font-mono text-base tracking-[0.4em] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneStep("enter");
                      setOtp("");
                      reset();
                    }}
                    className="mt-2 text-[11px] text-amber-600 hover:underline"
                  >
                    ← Change phone number
                  </button>
                </div>
              )}
              <FeedbackBanner error={error} info={info} />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {phoneStep === "enter" ? "Send OTP" : "Verify OTP"}
              </button>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                <strong>SMS provider required:</strong> Enable a phone provider
                in Supabase Dashboard → Authentication → Providers. Free tier
                doesn't include SMS — needs Supabase Pro or your own Twilio
                account.
              </p>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-6 py-3 text-center text-[11px] text-zinc-400">
          By continuing, you agree this is a demo project. No PII is stored
          beyond what Supabase Auth requires.
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-amber-500 text-zinc-900"
          : "border-transparent text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function FeedbackBanner({
  error,
  info,
}: {
  error: string | null;
  info: string | null;
}) {
  if (!error && !info) return null;
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{info}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="h-4 w-4"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.9-8 19.9-20 0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.2-8L6.3 33C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
