"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOutPage() {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-8 shadow-lg border border-zinc-100 dark:border-zinc-800 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
          Sign out
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Are you sure you want to sign out of TransitOps?
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="h-10 px-5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            id="sign-out-submit"
            onClick={handleSignOut}
            className="h-10 px-5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
