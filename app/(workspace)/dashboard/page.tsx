import Link from "next/link";

import { areasForRole, formatRole } from "@/lib/navigation";
import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  const areas = areasForRole(user.role).filter((area) => area.href !== "/dashboard");

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm text-muted-foreground">{formatRole(user.role)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Signed in as {user.name}. The menu only lists areas this role can open.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {areas.map((area) => (
          <li key={area.href}>
            <Link
              href={area.href}
              className="flex min-h-24 flex-col justify-center rounded-lg border border-border px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="font-medium">{area.label}</span>
              <span className="mt-1 text-sm text-muted-foreground">{area.summary}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/profile"
            className="flex min-h-24 flex-col justify-center rounded-lg border border-border px-4 py-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="font-medium">Profile</span>
            <span className="mt-1 text-sm text-muted-foreground">Account details and sign out.</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
