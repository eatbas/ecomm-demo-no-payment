import type { OrderPaymentStatus, OrderStatus } from "../../../shared/orders";
import { StatusChip } from "@/components/ui/status-chip";

interface AdminOrderStatusProps {
  readonly instrument?: string;
  readonly paymentStatus?: OrderPaymentStatus;
  readonly status?: OrderStatus;
}

export function AdminOrderStatus({
  status = "completed",
  paymentStatus = "not_configured",
  instrument,
}: AdminOrderStatusProps) {
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "pending"
        ? "Order pending"
        : "Order failed";

  const statusTone =
    status === "completed"
      ? "positive"
      : status === "pending"
        ? "warning"
        : "destructive";

  let paymentLabel = "Payment not configured";
  let paymentTone: "positive" | "neutral" | "warning" | "destructive" =
    "neutral";

  if (paymentStatus === "paid") {
    paymentLabel = "Paid";
    paymentTone = "positive";
  } else if (paymentStatus === "pending") {
    paymentLabel = "Payment pending";
    paymentTone = "warning";
  } else if (paymentStatus === "failed") {
    paymentLabel = "Payment failed";
    paymentTone = "destructive";
  }

  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
      <StatusChip tone={paymentTone}>{paymentLabel}</StatusChip>
      {instrument !== undefined ? (
        <StatusChip tone="neutral">{instrument}</StatusChip>
      ) : null}
    </div>
  );
}
