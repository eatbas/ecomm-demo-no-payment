import type { PaymentStatus } from "../../../shared/orders";
import { StatusChip } from "@/components/ui/status-chip";

const STATUS_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  ambiguous: "Needs review",
};

const STATUS_TONES: Record<PaymentStatus, "positive" | "neutral" | "negative" | "warning"> = {
  awaiting_payment: "neutral",
  paid: "positive",
  failed: "negative",
  ambiguous: "warning",
};

interface AdminOrderStatusProps {
  readonly paymentStatus: PaymentStatus;
}

export function AdminOrderStatus({ paymentStatus }: AdminOrderStatusProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip tone={STATUS_TONES[paymentStatus]}>
        {STATUS_LABELS[paymentStatus]}
      </StatusChip>
    </div>
  );
}
