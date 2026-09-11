import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { PaymentStatus } from "../../shared/orders.js";
import {
  readInteger,
  readNullableString,
  readString,
  type DatabaseRow,
  type OrderRepository,
} from "../orders/order.repository.js";

export interface InitiatePaymentParams {
  readonly orderId: string;
  readonly ppTxnRefNo: string;
  readonly amountPaisa: number;
  readonly initiatedAt: string;
}

export interface PaymentRecord {
  readonly id: string;
  readonly orderId: string;
  readonly ppTxnRefNo: string;
  readonly status: PaymentStatus;
  readonly amountPaisa: number;
  readonly initiatedAt: string;
  readonly resolvedAt: string | null;
}

export type PaymentEventSource = "ipn" | "status_inquiry" | "return_redirect";

export interface ResolvePaymentParams {
  readonly ppTxnRefNo: string;
  readonly status: Extract<PaymentStatus, "paid" | "failed" | "ambiguous">;
  readonly ppResponseCode: string | null;
  readonly ppStatus: string | null;
  readonly resolvedAt: string;
  readonly eventSource: PaymentEventSource;
  readonly rawPayload: string | null;
}

export class PaymentNotFoundError extends Error {
  constructor(ppTxnRefNo: string) {
    super(`No payment was found for pp_TxnRefNo ${ppTxnRefNo}.`);
    this.name = "PaymentNotFoundError";
  }
}

function mapPaymentRow(row: DatabaseRow): PaymentRecord {
  return {
    id: readString(row, "id"),
    orderId: readString(row, "orderId"),
    ppTxnRefNo: readString(row, "ppTxnRefNo"),
    status: readString(row, "status") as PaymentStatus,
    amountPaisa: readInteger(row, "amountPaisa"),
    initiatedAt: readString(row, "initiatedAt"),
    resolvedAt: readNullableString(row, "resolvedAt"),
  };
}

const SELECT_PAYMENT_COLUMNS = `
  id, order_id AS orderId, pp_txn_ref_no AS ppTxnRefNo, status,
  amount_paisa AS amountPaisa, initiated_at AS initiatedAt, resolved_at AS resolvedAt
`;

/**
 * Persists JazzCash payment attempts and keeps the owning order's
 * payment_status aligned within the same SQLite connection OrderRepository uses.
 */
export class PaymentRepository {
  readonly #database: DatabaseSync;
  readonly #orderRepository: OrderRepository;

  constructor(orderRepository: OrderRepository) {
    this.#orderRepository = orderRepository;
    this.#database = orderRepository.database;
  }

  initiate(params: InitiatePaymentParams): PaymentRecord {
    const id = `pay_${randomUUID()}`;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database
        .prepare(
          `INSERT INTO payments (
             id, order_id, provider, pp_txn_ref_no, status, amount_paisa, initiated_at
           ) VALUES (?, ?, 'jazzcash', ?, 'awaiting_payment', ?, ?)`,
        )
        .run(
          id,
          params.orderId,
          params.ppTxnRefNo,
          params.amountPaisa,
          params.initiatedAt,
        );
      this.#database.exec("COMMIT");
    } catch (error) {
      this.rollback(error);
    }

    return {
      id,
      orderId: params.orderId,
      ppTxnRefNo: params.ppTxnRefNo,
      status: "awaiting_payment",
      amountPaisa: params.amountPaisa,
      initiatedAt: params.initiatedAt,
      resolvedAt: null,
    };
  }

  findByTxnRefNo(ppTxnRefNo: string): PaymentRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT ${SELECT_PAYMENT_COLUMNS} FROM payments WHERE pp_txn_ref_no = ?`,
      )
      .get(ppTxnRefNo);
    return row === undefined ? undefined : mapPaymentRow(row);
  }

  findLatestForOrder(orderId: string): PaymentRecord | undefined {
    const row = this.#database
      .prepare(
        `SELECT ${SELECT_PAYMENT_COLUMNS} FROM payments
         WHERE order_id = ? ORDER BY initiated_at DESC, id DESC LIMIT 1`,
      )
      .get(orderId);
    return row === undefined ? undefined : mapPaymentRow(row);
  }

  listUnresolved(olderThan: string): readonly PaymentRecord[] {
    const rows = this.#database
      .prepare(
        `SELECT ${SELECT_PAYMENT_COLUMNS} FROM payments
         WHERE status IN ('awaiting_payment', 'ambiguous') AND initiated_at <= ?
         ORDER BY initiated_at ASC`,
      )
      .all(olderThan) as unknown as DatabaseRow[];
    return rows.map(mapPaymentRow);
  }

  /**
   * Idempotent resolution by pp_TxnRefNo. Once marked 'paid', subsequent
   * conflicting updates will not regress the settled state.
   */
  resolve(params: ResolvePaymentParams): PaymentRecord {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existingRow = this.#database
        .prepare(
          "SELECT order_id AS orderId, status FROM payments WHERE pp_txn_ref_no = ?",
        )
        .get(params.ppTxnRefNo);
      if (existingRow === undefined) {
        throw new PaymentNotFoundError(params.ppTxnRefNo);
      }
      const orderId = readString(existingRow, "orderId");
      const currentStatus = readString(existingRow, "status");

      this.#database
        .prepare(
          `UPDATE payments
           SET status = ?, pp_response_code = ?, pp_status = ?, resolved_at = ?,
               last_event_source = ?, last_raw_payload = ?
           WHERE pp_txn_ref_no = ?`,
        )
        .run(
          params.status,
          params.ppResponseCode,
          params.ppStatus,
          params.resolvedAt,
          params.eventSource,
          params.rawPayload,
          params.ppTxnRefNo,
        );

      if (currentStatus !== "paid") {
        this.#orderRepository.setPaymentStatus(orderId, params.status);
      }

      this.#database.exec("COMMIT");
    } catch (error) {
      this.rollback(error);
    }

    const record = this.findByTxnRefNo(params.ppTxnRefNo);
    if (record === undefined) {
      throw new Error("The resolved payment could not be read back.");
    }
    return record;
  }

  private rollback(cause: unknown): never {
    try {
      if (this.#database.isTransaction) {
        this.#database.exec("ROLLBACK");
      }
    } catch (rollbackError) {
      throw new AggregateError(
        [cause, rollbackError],
        "The payment transaction and its rollback both failed.",
        { cause: rollbackError },
      );
    }
    throw cause;
  }
}
