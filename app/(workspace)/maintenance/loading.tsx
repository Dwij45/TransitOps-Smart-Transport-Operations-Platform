import { LoadingState } from "@/components/ui/loading-state";

export default function MaintenanceLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <LoadingState label="Loading maintenance" />
    </div>
  );
}
