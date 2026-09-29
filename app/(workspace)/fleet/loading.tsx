import { LoadingState } from "@/components/ui/loading-state";

export default function FleetLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <LoadingState label="Loading vehicles" />
    </div>
  );
}
