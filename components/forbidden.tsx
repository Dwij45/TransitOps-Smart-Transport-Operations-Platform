import Link from "next/link";

export function Forbidden() {
  return (
    <div className="mx-auto max-w-lg py-16">
      <p className="text-sm text-muted-foreground">403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">You do not have access</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        This area is limited to another role. The check happens on the server, so the page is not only hidden in the menu.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
