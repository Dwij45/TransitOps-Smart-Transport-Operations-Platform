export function safetyScore(points: number): number {
  const raw = 100 + points;
  if (raw < 0) return 0;
  if (raw > 100) return 100;
  return Math.round(raw * 100) / 100;
}

export function isWithinRollingYear(occurredAt: Date, now: Date): boolean {
  const start = new Date(now);
  start.setMonth(start.getMonth() - 12);
  return occurredAt >= start && occurredAt <= now;
}

export function tripCompletionRate(completed: number, cancelled: number): number | null {
  const terminal = completed + cancelled;
  if (terminal <= 0) return null;
  return completed / terminal;
}

export type SafetyStanding = "clear" | "watch" | "warning";

export function safetyStanding(score: number): SafetyStanding {
  if (score >= 90) return "clear";
  if (score >= 70) return "watch";
  return "warning";
}
