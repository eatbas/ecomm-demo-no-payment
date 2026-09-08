import type { ProductId } from "./catalogue.js";
import {
  CUSTOMER_FIELD_RULES,
  isValidCustomerDetails,
  type CustomerDetails,
} from "./customer.js";

// The catalogue is priced directly in Pakistani Rupees (PKR); every "*Cents" field
// below is PKR paisa, the smallest PKR unit and the unit JazzCash's pp_Amount
// expects, so no currency conversion is ever needed between the catalogue and the
// JazzCash request.
export const ORDER_CURRENCY = "PKR" as const;
export const MAX_ORDER_LINES = 3;
export const MAX_ORDER_QUANTITY = 99;
export const MAX_ORDER_UNIT_PRICE_CENTS = 100_000_000;
export const MAX_ORDER_SUBTOTAL_CENTS =
  MAX_ORDER_LINES * MAX_ORDER_QUANTITY * MAX_ORDER_UNIT_PRICE_CENTS;
export const DEFAULT_ADMIN_ORDER_LIMIT = 50;
export const MAX_ADMIN_ORDER_LIMIT = 100;
export const MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH = 100;
export const MAX_ORDER_PRODUCT_NAME_LENGTH = 120;
export const MAX_ORDER_ERROR_MESSAGE_LENGTH = 240;

export const ORDER_ID_PATTERN =
  /^ord_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const ORDER_REFERENCE_PATTERN = /^CG-[0-9A-F]{8}$/;
export const ORDER_TIMESTAMP_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/;
export const ORDER_SNAPSHOT_PRODUCT_ID_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The order's own lifecycle *is* its payment lifecycle: there is no separate
// fulfilment concept in this checkout, so one field carries both, matching this
// repository's preference for avoiding redundant parallel state.
export const PAYMENT_STATUSES = [
  "awaiting_payment",
  "paid",
  "failed",
  "ambiguous",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_ERROR_CODES = [
  "IDEMPOTENCY_CONFLICT",
  "INTERNAL_ERROR",
  "INVALID_ORDER",
  "INVALID_REQUEST",
  "NOT_FOUND",
  "PAYLOAD_TOO_LARGE",
] as const;

export type OrderSnapshotProductId = string;
export type OrderErrorCode = (typeof ORDER_ERROR_CODES)[number];
export type { CustomerDetails } from "./customer.js";
export { CUSTOMER_FIELD_RULES, isValidCustomerDetails };

export interface CreateOrderLine {
  readonly productId: ProductId;
  readonly quantity: number;
}

export interface CreateOrderRequest {
  readonly idempotencyKey: string;
  readonly customer: CustomerDetails;
  readonly lines: readonly CreateOrderLine[];
}

export interface OrderItem {
  readonly productId: OrderSnapshotProductId;
  readonly productName: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly lineTotalCents: number;
}

export interface Order {
  readonly id: string;
  readonly reference: string;
  readonly createdAt: string;
  readonly paymentStatus: PaymentStatus;
  readonly currency: typeof ORDER_CURRENCY;
  readonly subtotalCents: number;
  readonly itemCount: number;
  readonly customer: CustomerDetails;
  readonly items: readonly OrderItem[];
}

export interface AdminOrdersResponse {
  readonly orders: readonly Order[];
}

export interface OrderErrorResponse {
  readonly code: OrderErrorCode;
  readonly message: string;
}
