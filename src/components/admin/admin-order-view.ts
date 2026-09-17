import type {
  CompletedOrder,
  OrderPaymentStatus,
  OrderStatus,
} from "../../../shared/orders";

import { formatCompletedAt } from "@/components/admin/admin-order-format";
import { formatCurrency } from "@/lib/currency";

export interface AdminOrderTransactionView {
  readonly amountFormatted: string;
  readonly authCode?: string;
  readonly responseCode?: string;
  readonly responseMessage?: string;
  readonly retrievalRefNo?: string;
  readonly status: string;
  readonly txnDateTime?: string;
  readonly txnRefNo: string;
  readonly txnType: string;
}

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
  readonly paymentStatus: OrderPaymentStatus;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly total: string;
  readonly transaction?: AdminOrderTransactionView;
}

export function createAdminOrderView(order: CompletedOrder): AdminOrderView {
  return {
    id: order.id,
    reference: order.reference,
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
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: formatCurrency(order.subtotalCents),
    transaction:
      order.transaction !== undefined
        ? {
            txnRefNo: order.transaction.txnRefNo,
            txnType:
              order.transaction.txnType === "MPAY"
                ? "Card (MPAY)"
                : order.transaction.txnType === "MWALLET"
                  ? "Wallet (MWALLET)"
                  : order.transaction.txnType,
            amountFormatted: `PKR ${(order.transaction.amountPaisa / 100).toFixed(2)}`,
            status: order.transaction.status,
            responseCode: order.transaction.responseCode,
            responseMessage: order.transaction.responseMessage,
            retrievalRefNo: order.transaction.retrievalRefNo,
            authCode: order.transaction.authCode,
            txnDateTime: order.transaction.txnDatetime,
          }
        : undefined,
  };
}
