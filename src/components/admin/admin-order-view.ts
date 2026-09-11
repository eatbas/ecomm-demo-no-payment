import type { CompletedOrder, PaymentStatus } from "../../../shared/orders";

import { formatCompletedAt } from "@/components/admin/admin-order-format";
import { formatCurrency } from "@/lib/currency";

export interface AdminOrderView {
  readonly completedAt: string;
  readonly createdAt: string;
  readonly customer: {
    readonly address: string;
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
  };
  readonly id: string;
  readonly itemCount: number;
  readonly itemCountLabel: string;
  readonly items: readonly {
    readonly equationLabel: string;
    readonly lineTotal: string;
    readonly productId: string;
    readonly productName: string;
    readonly quantityLabel: string;
  }[];
  readonly paymentStatus: PaymentStatus;
  readonly reference: string;
  readonly total: string;
}

export function createAdminOrderView(order: CompletedOrder): AdminOrderView {
  return {
    id: order.id,
    reference: order.reference,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    completedAt: `${formatCompletedAt(order.createdAt)} UTC`,
    customer: {
      fullName: order.demoCustomer.fullName,
      email: order.demoCustomer.email,
      phone: order.demoCustomer.phone,
      address: [
        order.demoCustomer.addressLine1,
        order.demoCustomer.city,
        order.demoCustomer.postcode,
        order.demoCustomer.country,
      ].join(", "),
    },
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantityLabel: `Quantity ${item.quantity} at ${formatCurrency(item.unitPriceCents)}`,
      equationLabel: `${item.quantity} × ${formatCurrency(item.unitPriceCents)} = ${formatCurrency(item.lineTotalCents)}`,
      lineTotal: formatCurrency(item.lineTotalCents),
    })),
    itemCount: order.itemCount,
    itemCountLabel: `${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`,
    total: formatCurrency(order.subtotalCents),
  };
}
