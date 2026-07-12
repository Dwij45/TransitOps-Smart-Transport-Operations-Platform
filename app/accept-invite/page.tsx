"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your invitation link...");

  useEffect(() => {
    // Edge case: no token in URL at all
    if (!token) {
      setStatus("error");
      setMessage("Invalid invitation link. The link may be missing a token. Please ask an administrator to resend the invitation.");
      return;
    }

    // Immediately verify the magic link token on mount
    async function verifyToken() {
      try {
        const { error } = await authClient.magicLink.verify({
          query: { token: token! },
        });

        if (error) {
          setStatus("error");
          // Edge case: distinguish between expired and invalid token
          if (error.message?.toLowerCase().includes("expired")) {
            setMessage("This invitation link has expired. Please ask an administrator to send a new invitation.");
          } else if (error.message?.toLowerCase().includes("used")) {
            setMessage("This invitation link has already been used. Please sign in directly.");
          } else {
            setMessage(
              error.message ?? "This invitation link is invalid. Please contact your administrator."
            );
          }
          return;
        }

        // Success — user is now signed in via magic link
        setStatus("success");
        setMessage("Invitation accepted! You are now signed in. Redirecting to dashboard...");
        setTimeout(() => router.push("/"), 2500);
      } catch {
        setStatus("error");
        setMessage("An unexpected error occurred while verifying your invitation. Please try again or contact support.");
      }
    }

    verifyToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isLoading = status === "verifying";
  const isSuccess = status === "success";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-lg border border-zinc-100 dark:border-zinc-800 text-center">
        {/* Spinner while verifying */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Verifying invitation...
            </h1>
            <p className="text-sm text-zinc-500">Please wait a moment.</p>
          </div>
        )}

        {/* Success state */}
        {isSuccess && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-2xl">
              ✓
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Welcome to TransitOps!
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-2xl">
              ✕
            </div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              Invitation Invalid
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
            <a
              href="/sign-in"
              className="mt-2 inline-block rounded-lg bg-zinc-900 dark:bg-zinc-50 px-5 py-2.5 text-sm font-medium text-white dark:text-zinc-900 transition hover:bg-zinc-700 dark:hover:bg-zinc-200"
            >
              Go to sign in
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
