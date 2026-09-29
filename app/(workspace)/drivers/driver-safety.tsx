import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDriverSafety, listActiveSafetyTypes } from "@/lib/services/driver-safety";
import { requireUser } from "@/lib/session";
import { SafetyEventForm } from "./safety-form";

const standingLabels = {
  clear: "Clear",
  watch: "Watch",
  warning: "Warning",
} as const;

function formatWhen(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function DriverSafety({ driverId }: { driverId: string }) {
  const user = await requireUser();
  const [profile, types] = await Promise.all([
    getDriverSafety(user.id, driverId),
    listActiveSafetyTypes(user.id),
  ]);
  const completion =
    profile.completion === null ? "No finished trips yet" : `${Math.round(profile.completion * 100)}% of finished trips completed`;

  return (
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Safety</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={profile.standing === "warning" ? "danger" : profile.standing === "watch" ? "warning" : "success"}>
          {standingLabels[profile.standing]}
        </Badge>
        <p className="text-sm">Score {profile.score} over the last 12 months</p>
      </div>
      <p className="text-sm text-muted-foreground">{completion}</p>
      {profile.standing === "warning" ? (
        <Notice tone="error" title="This driver is below the safety warning line." />
      ) : null}
      {profile.standing === "watch" ? (
        <Notice title="This score is in the watch range." />
      ) : null}
      {profile.events.length === 0 ? (
        <EmptyState title="No safety events" description="Recorded events keep the points from the type default at the time they were saved." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profile.events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{formatWhen(event.occurredAt)}</TableCell>
                <TableCell>{event.typeName}</TableCell>
                <TableCell>{event.severity}</TableCell>
                <TableCell>{event.pointsApplied}</TableCell>
                <TableCell>
                  {event.summary}
                  {event.notes ? <p className="text-xs text-muted-foreground">{event.notes}</p> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {types.length === 0 ? (
        <EmptyState title="No safety event types" description="Add a safety event type in Settings before recording an event." />
      ) : (
        <SafetyEventForm driverId={driverId} types={types} />
      )}
    </section>
  );
}
