"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  // Edge case: no token in URL
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid or missing reset link. Please request a new password reset.");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Edge case: passwords don't match
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      setStatus("error");
      return;
    }

    // Edge case: password too short (mirrors server-side min of 8)
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token: token!,
      });

      if (error) {
        // Edge case: token expired or already used
        setStatus("error");
        setMessage(
          error.message?.includes("expired") || error.message?.includes("invalid")
            ? "This reset link has expired or has already been used. Please request a new one."
            : error.message ?? "Something went wrong. Please try again."
        );
        return;
      }

      setStatus("success");
      setMessage("Password reset successfully! Redirecting to sign in...");
      setTimeout(() => router.push("/sign-in"), 2500);
    } catch {
      setStatus("error");
      setMessage("An unexpected error occurred. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-lg border border-zinc-100 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          Reset your password
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Enter your new password below. This link is single-use and will expire after use.
        </p>

        {status === "error" && !token ? (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-400">
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition"
              />
            </div>

            {message && status !== "idle" && (
              <div
                className={`rounded-lg p-3 text-sm ${
                  status === "success"
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                }`}
              >
                {message}
              </div>
            )}

            <button
              id="reset-password-submit"
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="mt-2 h-11 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium transition hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
