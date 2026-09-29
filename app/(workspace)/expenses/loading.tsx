import { LoadingState } from "@/components/ui/loading-state";

export default function ExpensesLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <LoadingState label="Loading expenses" />
    </div>
  );
}
