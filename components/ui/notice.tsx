import { cn } from "@/lib/utils";

const tones = {
  success: "border-foreground/15 bg-muted text-foreground",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border bg-card text-foreground",
} as const;

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : undefined}>{children}</div> : null}
    </div>
  );
}
