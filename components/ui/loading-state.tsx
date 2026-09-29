export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-24 rounded-lg bg-muted" />
      <div className="h-24 rounded-lg bg-muted" />
    </div>
  );
}
