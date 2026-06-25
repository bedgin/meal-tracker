"use client";

import { useState } from "react";
import Link from "next/link";
import { credentialsSignIn } from "@/app/actions/auth";

export default function SignInPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await credentialsSignIn(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-center font-jakarta mb-8" style={{ color: "#9A897B" }}>Sign in to your account</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full px-3 py-3 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
            style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
          />
        </div>

        <div>
          <label htmlFor="password" className="block font-jakarta font-bold uppercase mb-1" style={{ color: "#9A897B", fontSize: 12, letterSpacing: 1 }}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full px-3 py-3 pr-11 border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#FF7A1A] bg-white font-jakarta"
              style={{ borderColor: "#F2E6DB", color: "#2B2018" }}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-70"
              style={{ color: "#B7A597" }}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="font-jakarta text-sm px-3 py-2 rounded-xl" style={{ background: "#FFF1EA", color: "#FF5A4E" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center text-white font-fredoka font-semibold disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #FF9446, #FF6A12)", borderRadius: 18, fontSize: 19, paddingTop: 16, paddingBottom: 16, boxShadow: "0 8px 22px rgba(255,106,18,0.30)" }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="text-center font-jakarta text-sm mt-6" style={{ color: "#9A897B" }}>
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium" style={{ color: "#FF7A1A" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
