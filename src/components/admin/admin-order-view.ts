import type { Order, PaymentStatus } from "../../../shared/orders";

import { formatCompletedAt } from "@/components/admin/admin-order-format";
import { formatCurrency } from "@/lib/currency";

export interface AdminOrderViewItem {
  readonly equationLabel: string;
  readonly lineTotal: string;
  readonly productId: string;
  readonly productName: string;
  readonly quantityLabel: string;
}

export interface AdminOrderView {
  readonly createdAt: string;
  readonly createdAtLabel: string;
  readonly customer: {
    readonly address: string;
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
  };
  readonly id: string;
  readonly itemCount: number;
  readonly itemCountLabel: string;
  readonly items: readonly AdminOrderViewItem[];
  readonly paymentStatus: PaymentStatus;
  readonly reference: string;
  readonly total: string;
}

function createAdminOrderViewItem(item: Order["items"][number]): AdminOrderViewItem {
  return {
    productId: item.productId,
    productName: item.productName,
    quantityLabel: `Quantity ${item.quantity} at ${formatCurrency(item.unitPriceCents)}`,
    equationLabel: `${item.quantity} × ${formatCurrency(item.unitPriceCents)} = ${formatCurrency(item.lineTotalCents)}`,
    lineTotal: formatCurrency(item.lineTotalCents),
  };
}

export function createAdminOrderView(order: Order): AdminOrderView {
  return {
    id: order.id,
    reference: order.reference,
    createdAt: order.createdAt,
    createdAtLabel: `${formatCompletedAt(order.createdAt)} UTC`,
    paymentStatus: order.paymentStatus,
    customer: {
      fullName: order.customer.fullName,
      email: order.customer.email,
      phone: order.customer.phone,
      address: [
        order.customer.addressLine1,
        order.customer.city,
        order.customer.postcode,
        order.customer.country,
      ].join(", "),
    },
    items: order.items.map(createAdminOrderViewItem),
    itemCount: order.itemCount,
    itemCountLabel: `${order.itemCount} ${order.itemCount === 1 ? "item" : "items"}`,
    total: formatCurrency(order.subtotalCents),
  };
}
