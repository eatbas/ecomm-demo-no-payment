import type { PaymentStatus } from "../../../shared/orders";
import { StatusChip } from "@/components/ui/status-chip";

interface AdminOrderStatusProps {
  readonly paymentStatus?: PaymentStatus;
}

export function AdminOrderStatus({
  paymentStatus = "awaiting_payment",
}: AdminOrderStatusProps) {
  const paymentTone =
    paymentStatus === "paid"
      ? "positive"
      : paymentStatus === "failed"
        ? "negative"
        : "neutral";

  const paymentLabel =
    paymentStatus === "paid"
      ? "Paid"
      : paymentStatus === "failed"
        ? "Payment failed"
        : paymentStatus === "ambiguous"
          ? "Payment pending"
          : "Awaiting payment";

  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip tone="positive">Completed</StatusChip>
      <StatusChip tone={paymentTone}>{paymentLabel}</StatusChip>
    </div>
  );
}
