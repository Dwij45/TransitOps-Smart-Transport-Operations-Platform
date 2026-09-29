import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-foreground",
  success: "bg-foreground text-background",
  warning: "bg-muted text-foreground ring-1 ring-foreground/20",
  danger: "bg-destructive/10 text-destructive",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof tones;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
