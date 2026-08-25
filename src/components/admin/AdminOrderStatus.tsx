import { StatusChip } from "@/components/ui/status-chip";

export function AdminOrderStatus() {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip tone="positive">Completed</StatusChip>
      <StatusChip>Payment not configured</StatusChip>
    </div>
  );
}
