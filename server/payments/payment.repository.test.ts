// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEMO_CUSTOMER } from "../../shared/orders.js";
import { openOrderDatabase } from "../db/database.js";
import { OrderRepository } from "../orders/order.repository.js";
import { OrderService } from "../orders/order.service.js";
import {
  PaymentNotFoundError,
  PaymentRepository,
} from "./payment.repository.js";

function setupRepositories() {
  const database = openOrderDatabase(":memory:");
  const orderRepository = new OrderRepository(database);
  const paymentRepository = new PaymentRepository(orderRepository);
  const orderService = new OrderService(orderRepository);

  const result = orderService.create({
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    demoCustomerId: DEMO_CUSTOMER.id,
    lines: [{ productId: "everyday-backpack", quantity: 1 }],
  });

  return { database, orderRepository, paymentRepository, order: result.order };
}

describe("PaymentRepository", () => {
  it("initiates and retrieves a payment attempt", () => {
    const { paymentRepository, order } = setupRepositories();
    const initiatedAt = new Date().toISOString();

    const initiated = paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN202609110001",
      amountPaisa: order.subtotalCents,
      initiatedAt,
    });

    expect(initiated.id).toMatch(/^pay_/);
    expect(initiated.status).toBe("awaiting_payment");
    expect(initiated.orderId).toBe(order.id);
    expect(initiated.amountPaisa).toBe(order.subtotalCents);

    const found = paymentRepository.findByTxnRefNo("TRN202609110001");
    expect(found).toEqual(initiated);

    const latest = paymentRepository.findLatestForOrder(order.id);
    expect(latest).toEqual(initiated);
  });

  it("resolves payment to paid and updates owning order payment_status", () => {
    const { paymentRepository, orderRepository, order } = setupRepositories();
    const now = new Date().toISOString();

    paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN202609110002",
      amountPaisa: order.subtotalCents,
      initiatedAt: now,
    });

    const resolved = paymentRepository.resolve({
      ppTxnRefNo: "TRN202609110002",
      status: "paid",
      ppResponseCode: "121",
      ppStatus: "Completed",
      resolvedAt: now,
      eventSource: "ipn",
      rawPayload: '{"pp_ResponseCode":"121"}',
    });

    expect(resolved.status).toBe("paid");
    expect(resolved.resolvedAt).toBe(now);

    const updatedOrder = orderRepository.findById(order.id);
    expect(updatedOrder?.paymentStatus).toBe("paid");
  });

  it("does not regress a settled paid order upon re-resolving with ambiguous status", () => {
    const { paymentRepository, orderRepository, order } = setupRepositories();
    const now = new Date().toISOString();

    paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN202609110003",
      amountPaisa: order.subtotalCents,
      initiatedAt: now,
    });

    paymentRepository.resolve({
      ppTxnRefNo: "TRN202609110003",
      status: "paid",
      ppResponseCode: "121",
      ppStatus: "Completed",
      resolvedAt: now,
      eventSource: "ipn",
      rawPayload: null,
    });

    paymentRepository.resolve({
      ppTxnRefNo: "TRN202609110003",
      status: "ambiguous",
      ppResponseCode: "013",
      ppStatus: null,
      resolvedAt: now,
      eventSource: "ipn",
      rawPayload: null,
    });

    const updatedOrder = orderRepository.findById(order.id);
    expect(updatedOrder?.paymentStatus).toBe("paid");
  });

  it("throws PaymentNotFoundError when resolving an unknown transaction reference", () => {
    const { paymentRepository } = setupRepositories();

    expect(() =>
      paymentRepository.resolve({
        ppTxnRefNo: "TRN_DOES_NOT_EXIST",
        status: "paid",
        ppResponseCode: "121",
        ppStatus: "Completed",
        resolvedAt: new Date().toISOString(),
        eventSource: "ipn",
        rawPayload: null,
      }),
    ).toThrow(PaymentNotFoundError);
  });
});
