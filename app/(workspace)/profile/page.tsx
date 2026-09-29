import { SignOutButton } from "@/components/sign-out-button";
import { formatRole } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "T";
}

export default async function ProfilePage() {
  const user = await requireUser();
  const joined = user.createdAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The account attached to this session.
      </p>

      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
        <div className="flex items-center gap-4 border-b border-border px-5 py-5 sm:px-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-medium text-primary-foreground">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium">{user.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{formatRole(user.role)}</p>
          </div>
        </div>

        <dl className="grid sm:grid-cols-2">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-1 break-all text-sm">{user.email}</dd>
          </div>
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <dt className="text-xs text-muted-foreground">Email status</dt>
            <dd className="mt-1 text-sm">{user.emailVerified ? "Verified" : "Not verified"}</dd>
          </div>
          <div className="border-b border-border px-5 py-4 sm:px-6 sm:border-b-0">
            <dt className="text-xs text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm">{formatRole(user.role)}</dd>
          </div>
          <div className="px-5 py-4 sm:px-6">
            <dt className="text-xs text-muted-foreground">Joined</dt>
            <dd className="mt-1 text-sm">{joined}</dd>
          </div>
        </dl>

        <div className="border-t border-border px-5 py-4 sm:px-6">
          <SignOutButton className="h-11" />
        </div>
      </section>
    </div>
  );
}
