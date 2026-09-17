import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
  DEMO_CUSTOMER,
  MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH,
  ORDER_CURRENCIES,
  ORDER_CURRENCY,
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUSES,
  ORDER_SNAPSHOT_PRODUCT_ID_PATTERN,
  ORDER_STATUS,
  ORDER_STATUSES,
  type CompletedOrder,
  type CompletedOrderItem,
  type OrderCurrency,
  type OrderPaymentStatus,
  type OrderSnapshotProductId,
  type OrderStatus,
  type OrderTransactionDetails,
} from "../../shared/orders.js";
import type {
  PaymentTransactionRecord,
  PaymentTransactionStatus,
} from "../payments/jazzcash/jazzcash.types.js";

export interface OrderToPersist {
  readonly id: string;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly createdAt: string;
  readonly status?: OrderStatus;
  readonly paymentStatus?: OrderPaymentStatus;
  readonly currency?: OrderCurrency;
  readonly subtotalCents: number;
  readonly itemCount: number;
  readonly items: readonly CompletedOrderItem[];
}

export interface PersistOrderResult {
  readonly order: CompletedOrder;
  readonly created: boolean;
}

export interface CreateTransactionParams {
  readonly id: string;
  readonly orderId: string;
  readonly txnRefNo: string;
  readonly txnType: string;
  readonly amountPaisa: number;
  readonly currency: "PKR";
  readonly status: PaymentTransactionStatus;
  readonly createdAt?: string;
}

export interface UpdateTransactionParams {
  readonly txnRefNo: string;
  readonly status: PaymentTransactionStatus;
  readonly responseCode?: string;
  readonly responseMessage?: string;
  readonly retrievalRefNo?: string;
  readonly authCode?: string;
  readonly txnDatetime?: string;
  readonly rawIpnPayload?: string;
  readonly updatedAt?: string;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key has already been used for another order.");
    this.name = "IdempotencyConflictError";
  }
}

class DataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

type DatabaseRow = Record<string, SQLOutputValue>;

function readString(row: DatabaseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text.`);
  }
  return value;
}

function readOptionalString(
  row: DatabaseRow,
  column: string,
): string | undefined {
  const value = row[column];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new DataIntegrityError(`Expected ${column} to contain text.`);
  }
  return value;
}

function readInteger(row: DatabaseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new DataIntegrityError(`Expected ${column} to contain an integer.`);
  }
  return value;
}

function readProductId(row: DatabaseRow): OrderSnapshotProductId {
  const value = readString(row, "productId");
  if (
    value.length > MAX_ORDER_SNAPSHOT_PRODUCT_ID_LENGTH ||
    !ORDER_SNAPSHOT_PRODUCT_ID_PATTERN.test(value)
  ) {
    throw new DataIntegrityError("An order contains an invalid product snapshot.");
  }
  return value;
}

function mapOrderItem(row: DatabaseRow): CompletedOrderItem {
  return {
    productId: readProductId(row),
    productName: readString(row, "productName"),
    unitPriceCents: readInteger(row, "unitPriceCents"),
    quantity: readInteger(row, "quantity"),
    lineTotalCents: readInteger(row, "lineTotalCents"),
  };
}

function assertInSet<T extends string>(
  row: DatabaseRow,
  column: string,
  allowed: readonly T[],
): T {
  const value = readString(row, column) as T;
  if (!allowed.includes(value)) {
    throw new DataIntegrityError(`The stored ${column} value is invalid.`);
  }
  return value;
}

export class OrderRepository {
  readonly #database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.#database = database;
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

  listCompleted(limit: number): readonly CompletedOrder[] {
    const orderRows = this.#database
      .prepare(
        `SELECT id
         FROM orders
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(limit) as unknown as DatabaseRow[];

    return orderRows.map((row) => this.readOrder(readString(row, "id")));
  }

  findOrderById(orderId: string): CompletedOrder | undefined {
    const existing = this.#database
      .prepare("SELECT id FROM orders WHERE id = ?")
      .get(orderId);
    if (existing === undefined) {
      return undefined;
    }
    return this.readOrder(orderId);
  }

  findOrderByTxnRefNo(txnRefNo: string): CompletedOrder | undefined {
    const row = this.#database
      .prepare(
        "SELECT order_id AS orderId FROM payment_transactions WHERE txn_ref_no = ?",
      )
      .get(txnRefNo);
    if (row === undefined) {
      return undefined;
    }
    return this.readOrder(readString(row, "orderId"));
  }

  createTransaction(params: CreateTransactionParams): PaymentTransactionRecord {
    const now = params.createdAt ?? new Date().toISOString();
    this.#database
      .prepare(
        `INSERT INTO payment_transactions (
           id, order_id, txn_ref_no, txn_type, amount_paisa,
           currency, status, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.id,
        params.orderId,
        params.txnRefNo,
        params.txnType,
        params.amountPaisa,
        params.currency,
        params.status,
        now,
        now,
      );

    return {
      id: params.id,
      orderId: params.orderId,
      txnRefNo: params.txnRefNo,
      txnType: params.txnType,
      amountPaisa: params.amountPaisa,
      currency: params.currency,
      status: params.status,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateTransactionStatus(params: UpdateTransactionParams): CompletedOrder {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existingTxn = this.#database
        .prepare(
          `SELECT id, order_id AS orderId, status FROM payment_transactions WHERE txn_ref_no = ?`,
        )
        .get(params.txnRefNo);

      if (existingTxn === undefined) {
        throw new DataIntegrityError(
          `Transaction ${params.txnRefNo} does not exist.`,
        );
      }

      const orderId = readString(existingTxn, "orderId");
      const now = params.updatedAt ?? new Date().toISOString();

      this.#database
        .prepare(
          `UPDATE payment_transactions
           SET status = ?,
               response_code = COALESCE(?, response_code),
               response_message = COALESCE(?, response_message),
               retrieval_ref_no = COALESCE(?, retrieval_ref_no),
               auth_code = COALESCE(?, auth_code),
               txn_datetime = COALESCE(?, txn_datetime),
               raw_ipn_payload = COALESCE(?, raw_ipn_payload),
               updated_at = ?
           WHERE txn_ref_no = ?`,
        )
        .run(
          params.status,
          params.responseCode ?? null,
          params.responseMessage ?? null,
          params.retrievalRefNo ?? null,
          params.authCode ?? null,
          params.txnDatetime ?? null,
          params.rawIpnPayload ?? null,
          now,
          params.txnRefNo,
        );

      let orderStatus: OrderStatus | undefined;
      let paymentStatus: OrderPaymentStatus | undefined;

      if (params.status === "paid") {
        orderStatus = "completed";
        paymentStatus = "paid";
      } else if (params.status === "failed") {
        orderStatus = "failed";
        paymentStatus = "failed";
      } else if (params.status === "pending") {
        orderStatus = "pending";
        paymentStatus = "pending";
      }

      if (orderStatus !== undefined && paymentStatus !== undefined) {
        this.#database
          .prepare(
            `UPDATE orders
             SET status = ?,
                 payment_status = ?
             WHERE id = ?`,
          )
          .run(orderStatus, paymentStatus, orderId);
      }

      const order = this.readOrder(orderId);
      this.#database.exec("COMMIT");
      return order;
    } catch (error) {
      this.rollback(error);
    }
  }

  private insertOrder(order: OrderToPersist): void {
    const status = order.status ?? ORDER_STATUS;
    const paymentStatus = order.paymentStatus ?? ORDER_PAYMENT_STATUS;
    const currency = order.currency ?? ORDER_CURRENCY;

    this.#database
      .prepare(
        `INSERT INTO orders (
           id, reference, idempotency_key, request_fingerprint,
           demo_customer_id, created_at, status, payment_status,
           currency, subtotal_cents, item_count
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        order.id,
        order.reference,
        order.idempotencyKey,
        order.requestFingerprint,
        DEMO_CUSTOMER.id,
        order.createdAt,
        status,
        paymentStatus,
        currency,
        order.subtotalCents,
        order.itemCount,
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

  private readOrder(orderId: string): CompletedOrder {
    const orderRow = this.#database
      .prepare(
        `SELECT
           id,
           reference,
           created_at AS createdAt,
           demo_customer_id AS demoCustomerId,
           status,
           payment_status AS paymentStatus,
           currency,
           subtotal_cents AS subtotalCents,
           item_count AS itemCount
         FROM orders
         WHERE id = ?`,
      )
      .get(orderId);
    if (orderRow === undefined) {
      throw new DataIntegrityError("The persisted order could not be read back.");
    }

    if (readString(orderRow, "demoCustomerId") !== DEMO_CUSTOMER.id) {
      throw new DataIntegrityError("The stored demoCustomerId value is invalid.");
    }
    const status = assertInSet(orderRow, "status", ORDER_STATUSES);
    const paymentStatus = assertInSet(
      orderRow,
      "paymentStatus",
      ORDER_PAYMENT_STATUSES,
    );
    const currency = assertInSet(orderRow, "currency", ORDER_CURRENCIES);

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

    const transactionRow = this.#database
      .prepare(
        `SELECT
           txn_ref_no AS txnRefNo,
           txn_type AS txnType,
           amount_paisa AS amountPaisa,
           currency,
           status,
           response_code AS responseCode,
           response_message AS responseMessage,
           retrieval_ref_no AS retrievalRefNo,
           auth_code AS authCode,
           txn_datetime AS txnDatetime
         FROM payment_transactions
         WHERE order_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
      )
      .get(orderId);

    const transaction: OrderTransactionDetails | undefined =
      transactionRow === undefined
        ? undefined
        : {
            txnRefNo: readString(transactionRow, "txnRefNo"),
            txnType: readString(transactionRow, "txnType"),
            amountPaisa: readInteger(transactionRow, "amountPaisa"),
            currency: "PKR",
            status: assertInSet(
              transactionRow,
              "status",
              ["initiated", "pending", "paid", "failed"] as const,
            ),
            responseCode: readOptionalString(transactionRow, "responseCode"),
            responseMessage: readOptionalString(
              transactionRow,
              "responseMessage",
            ),
            retrievalRefNo: readOptionalString(
              transactionRow,
              "retrievalRefNo",
            ),
            authCode: readOptionalString(transactionRow, "authCode"),
            txnDatetime: readOptionalString(transactionRow, "txnDatetime"),
          };

    return {
      id: readString(orderRow, "id"),
      reference: readString(orderRow, "reference"),
      createdAt: readString(orderRow, "createdAt"),
      status,
      paymentStatus,
      currency,
      subtotalCents: readInteger(orderRow, "subtotalCents"),
      itemCount: readInteger(orderRow, "itemCount"),
      demoCustomer: DEMO_CUSTOMER,
      items: itemRows.map(mapOrderItem),
      ...(transaction === undefined ? {} : { transaction }),
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
