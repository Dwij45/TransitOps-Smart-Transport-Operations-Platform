import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const previous = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm">
      <a
        href={hrefFor(previous)}
        aria-disabled={page <= 1}
        className={cn(
          "inline-flex h-11 items-center rounded-md px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          page <= 1 ? "pointer-events-none text-muted-foreground" : "hover:bg-muted",
        )}
      >
        Previous
      </a>
      <p>
        Page {page} of {pageCount}
      </p>
      <a
        href={hrefFor(next)}
        aria-disabled={page >= pageCount}
        className={cn(
          "inline-flex h-11 items-center rounded-md px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          page >= pageCount ? "pointer-events-none text-muted-foreground" : "hover:bg-muted",
        )}
      >
        Next
      </a>
    </nav>
  );
}
