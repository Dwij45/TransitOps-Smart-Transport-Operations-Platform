import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export async function AccountHome() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { name, email, role } = session.user;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground">
              T
            </div>
            <span className="font-semibold tracking-tight">TransitOps</span>
          </Link>
          <SignOutButton />
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-sm text-muted-foreground mb-2">Signed in</p>
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        <dl className="mt-8 grid gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="capitalize">{role.replaceAll("_", " ")}</dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
