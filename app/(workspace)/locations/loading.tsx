import { LoadingState } from "@/components/ui/loading-state";

export default function LocationsLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <LoadingState label="Loading locations" />
    </div>
  );
}
