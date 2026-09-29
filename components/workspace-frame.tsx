"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import type { UserRole } from "@/lib/authorization";
import { areasForRole, formatRole, type AppArea } from "@/lib/navigation";

interface WorkspaceUser {
  name: string;
  email: string;
  role: UserRole;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "T";
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: AppArea[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Workspace" className="flex flex-col gap-1">
      {items.map((item) => {
        const current = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            onClick={onNavigate}
            className={`flex min-h-11 items-center rounded-md px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              current
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/70"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountLinks({ user, pathname }: { user: WorkspaceUser; pathname: string }) {
  const current = pathname === "/profile";
  return (
    <div className="border-t border-sidebar-border pt-3">
      <Link
        href="/profile"
        aria-current={current ? "page" : undefined}
        className={`flex min-h-11 items-center gap-3 rounded-md px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
          current ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/70"
        }`}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-medium text-sidebar-primary-foreground">
          {initials(user.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{formatRole(user.role)}</span>
        </span>
      </Link>
      <SignOutButton className="mt-2 h-11 w-full" />
    </div>
  );
}

export function WorkspaceFrame({
  user,
  children,
}: {
  user: WorkspaceUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = areasForRole(user.role);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:min-h-screen md:flex-col md:px-3 md:py-4">
          <Link href="/dashboard" className="mb-6 flex min-h-11 items-center gap-2 px-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              T
            </span>
            <span className="font-semibold tracking-tight">TransitOps</span>
          </Link>
          <div className="flex-1">
            <NavLinks items={items} pathname={pathname} />
          </div>
          <AccountLinks user={user} pathname={pathname} />
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              TransitOps
            </Link>
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm"
              aria-expanded={menuOpen}
              aria-controls="workspace-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
          </header>

          {menuOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-foreground/30"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div
                id="workspace-menu"
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar px-3 py-4 text-sidebar-foreground shadow-xl"
              >
                <p className="mb-4 px-2 text-sm font-semibold">TransitOps</p>
                <div className="flex-1 overflow-y-auto">
                  <NavLinks
                    items={items}
                    pathname={pathname}
                    onNavigate={() => setMenuOpen(false)}
                  />
                </div>
                <AccountLinks user={user} pathname={pathname} />
              </div>
            </div>
          ) : null}

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
