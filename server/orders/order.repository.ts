import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
  MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH,
  ORDER_CURRENCY,
  ORDER_SNAPSHOT_PRODUCT_ID_PATTERN,
  PAYMENT_STATUSES,
  type CustomerDetails,
  type Order,
  type OrderItem,
  type PaymentStatus,
} from "../../shared/orders.js";

export interface OrderToPersist {
  readonly id: string;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly createdAt: string;
  readonly subtotalCents: number;
  readonly itemCount: number;
  readonly customer: CustomerDetails;
  readonly items: readonly OrderItem[];
}

export interface PersistOrderResult {
  readonly order: Order;
  readonly created: boolean;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key has already been used for another order.");
    this.name = "IdempotencyConflictError";
  }
}

export class DataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

export type DatabaseRow = Record<string, SQLOutputValue>;

export function readString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text.`);
  }
  return value;
}

function readNullableString(row: DatabaseRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text or null.`);
  }
  return value;
}

export function readInteger(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new DataIntegrityError(`Expected ${column} to contain an integer.`);
  }
  return value;
}

function readPaymentStatus(row: DatabaseRow, column: string): PaymentStatus {
  const value = readString(row, column);
  if (!(PAYMENT_STATUSES as readonly string[]).includes(value)) {
    throw new DataIntegrityError(`The stored ${column} value is invalid.`);
  }
  return value as PaymentStatus;
}

function readProductId(row: DatabaseRow): string {
  const value = readString(row, "productId");
  if (
    value.length > MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH ||
    !ORDER_SNAPSHOT_PRODUCT_ID_PATTERN.test(value)
  ) {
    throw new DataIntegrityError("An order contains an invalid product snapshot.");
  }
  return value;
}

function mapOrderItem(row: DatabaseRow): OrderItem {
  return {
    productId: readProductId(row),
    productName: readString(row, "productName"),
    unitPriceCents: readInteger(row, "unitPriceCents"),
    quantity: readInteger(row, "quantity"),
    lineTotalCents: readInteger(row, "lineTotalCents"),
  };
}

function assertLiteral(row: DatabaseRow, column: string, expected: string): void {
  if (readString(row, column) !== expected) {
    throw new DataIntegrityError(`The stored ${column} value is invalid.`);
  }
}

function readCustomer(row: DatabaseRow): CustomerDetails {
  return {
    fullName: readString(row, "customerFullName"),
    email: readString(row, "customerEmail"),
    phone: readString(row, "customerPhone"),
    addressLine1: readString(row, "customerAddressLine1"),
    city: readString(row, "customerCity"),
    postcode: readString(row, "customerPostcode"),
    country: readString(row, "customerCountry"),
  };
}

export class OrderRepository {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
  }

  /** Exposed so the payments module can share one transactional connection. */
  get database(): DatabaseSync {
    return this.#database;
  }

  get isReady(): boolean {
    return this.#database.isOpen;
  }

  close(): void {
    if (this.#database.isOpen) {
      this.#database.close();
    }
  }

  createOrReplay(order: OrderToPersist): PersistOrderResult {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#database
        .prepare(
          "SELECT id, request_fingerprint AS requestFingerprint FROM orders WHERE idempotency_key = ?",
        )
        .get(order.idempotencyKey);

      if (existing !== undefined) {
        if (
          readString(existing, "requestFingerprint") !==
          order.requestFingerprint
        ) {
          throw new IdempotencyConflictError();
        }

        const persistedOrder = this.readOrder(readString(existing, "id"));
        this.#database.exec("COMMIT");
        return { order: persistedOrder, created: false };
      }

      this.insertOrder(order);
      const persistedOrder = this.readOrder(order.id);
      this.#database.exec("COMMIT");
      return { order: persistedOrder, created: true };
    } catch (error) {
      this.rollback(error);
    }
  }

  findById(orderId: string): Order | undefined {
    const row = this.#database
      .prepare("SELECT id FROM orders WHERE id = ?")
      .get(orderId);
    return row === undefined ? undefined : this.readOrder(orderId);
  }

  listPaid(limit: number): readonly Order[] {
    const orderRows = this.#database
      .prepare(
        `SELECT id
         FROM orders
         WHERE payment_status = 'paid'
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as DatabaseRow[];

    return orderRows.map((row) => this.readOrder(readString(row, "id")));
  }

  /** Used only by the payments module, inside its own transaction. */
  setPaymentStatus(orderId: string, paymentStatus: PaymentStatus): void {
    this.#database
      .prepare("UPDATE orders SET payment_status = ? WHERE id = ?")
      .run(paymentStatus, orderId);
  }

  private insertOrder(order: OrderToPersist): void {
    this.#database
      .prepare(
        `INSERT INTO orders (
           id, reference, idempotency_key, request_fingerprint,
           created_at, payment_status, currency, subtotal_cents, item_count,
           customer_full_name, customer_email, customer_phone,
           customer_address_line1, customer_city, customer_postcode, customer_country
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        order.id,
        order.reference,
        order.idempotencyKey,
        order.requestFingerprint,
        order.createdAt,
        "awaiting_payment",
        ORDER_CURRENCY,
        order.subtotalCents,
        order.itemCount,
        order.customer.fullName,
        order.customer.email,
        order.customer.phone,
        order.customer.addressLine1,
        order.customer.city,
        order.customer.postcode,
        order.customer.country,
      );

    const insertItem = this.#database.prepare(
      `INSERT INTO order_items (
         order_id, line_number, product_id, product_name,
         unit_price_cents, quantity, line_total_cents
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    order.items.forEach((item, lineNumber) => {
      insertItem.run(
        order.id,
        lineNumber,
        item.productId,
        item.productName,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents,
      );
    });
  }

  private readOrder(orderId: string): Order {
    const orderRow = this.#database
      .prepare(
        `SELECT
           id,
           reference,
           created_at AS createdAt,
           payment_status AS paymentStatus,
           currency,
           subtotal_cents AS subtotalCents,
           item_count AS itemCount,
           customer_full_name AS customerFullName,
           customer_email AS customerEmail,
           customer_phone AS customerPhone,
           customer_address_line1 AS customerAddressLine1,
           customer_city AS customerCity,
           customer_postcode AS customerPostcode,
           customer_country AS customerCountry
         FROM orders
         WHERE id = ?`,
      )
      .get(orderId);
    if (orderRow === undefined) {
      throw new DataIntegrityError("The persisted order could not be read back.");
    }

    assertLiteral(orderRow, "currency", ORDER_CURRENCY);

    const itemRows = this.#database
      .prepare(
        `SELECT
           product_id AS productId,
           product_name AS productName,
           unit_price_cents AS unitPriceCents,
           quantity,
           line_total_cents AS lineTotalCents
         FROM order_items
         WHERE order_id = ?
         ORDER BY line_number`,
      )
      .all(orderId) as unknown as DatabaseRow[];

    return {
      id: readString(orderRow, "id"),
      reference: readString(orderRow, "reference"),
      createdAt: readString(orderRow, "createdAt"),
      paymentStatus: readPaymentStatus(orderRow, "paymentStatus"),
      currency: ORDER_CURRENCY,
      subtotalCents: readInteger(orderRow, "subtotalCents"),
      itemCount: readInteger(orderRow, "itemCount"),
      customer: readCustomer(orderRow),
      items: itemRows.map(mapOrderItem),
    };
  }

  private rollback(cause: unknown): never {
    try {
      if (this.#database.isTransaction) {
        this.#database.exec("ROLLBACK");
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [cause, rollbackError],
        "The order transaction and its rollback both failed.",
        { cause: rollbackError },
      );
    }
    throw cause;
  }
}

export { readNullableString };
