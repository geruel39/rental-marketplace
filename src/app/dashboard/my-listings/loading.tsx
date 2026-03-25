import { TableRowSkeleton } from "@/components/shared/loading-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRowSkeleton key={index} />
      ))}
    </div>
  );
}
