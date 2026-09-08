// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { openOrderDatabase } from "../db/database.js";
import { OrderRepository } from "../orders/order.repository.js";
import { OrderService } from "../orders/order.service.js";
import { PaymentNotFoundError, PaymentRepository } from "./payment.repository.js";

const repositories: OrderRepository[] = [];

function createRepositories(): {
  orderRepository: OrderRepository;
  paymentRepository: PaymentRepository;
  service: OrderService;
} {
  const orderRepository = new OrderRepository(openOrderDatabase(":memory:"));
  repositories.push(orderRepository);
  const paymentRepository = new PaymentRepository(orderRepository);
  const service = new OrderService(orderRepository, {
    now: () => new Date("2026-08-25T10:00:00.000Z"),
    createIdentifiers: () => ({
      id: "ord_00000000-0000-4000-8000-000000000101",
      reference: "CG-00000101",
    }),
  });
  return { orderRepository, paymentRepository, service };
}

function createTestCustomer() {
  return {
    fullName: "Zara Khan",
    email: "zara@example.test",
    phone: "+92 300 1234567",
    addressLine1: "12 Model Town",
    city: "Lahore",
    postcode: "54700",
    country: "Pakistan",
  };
}

afterEach(() => {
  for (const repository of repositories.splice(0)) {
    repository.close();
  }
});

describe("PaymentRepository", () => {
  it("initiates a payment awaiting_payment and leaves the order awaiting_payment", () => {
    const { orderRepository, paymentRepository, service } = createRepositories();
    const { order } = service.create({
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      customer: createTestCustomer(),
      lines: [{ productId: "everyday-backpack", quantity: 1 }],
    });

    const payment = paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN1",
      amountPaisa: order.subtotalCents,
      initiatedAt: "2026-08-25T10:01:00.000Z",
    });

    expect(payment.status).toBe("awaiting_payment");
    expect(orderRepository.findById(order.id)?.paymentStatus).toBe(
      "awaiting_payment",
    );
    expect(paymentRepository.findByTxnRefNo("TRN1")?.id).toBe(payment.id);
    expect(paymentRepository.findLatestForOrder(order.id)?.id).toBe(payment.id);
  });

  it("resolving to paid marks both the payment and the order paid", () => {
    const { orderRepository, paymentRepository, service } = createRepositories();
    const { order } = service.create({
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
      customer: createTestCustomer(),
      lines: [{ productId: "desk-lamp", quantity: 1 }],
    });
    paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN2",
      amountPaisa: order.subtotalCents,
      initiatedAt: "2026-08-25T10:01:00.000Z",
    });

    const resolved = paymentRepository.resolve({
      ppTxnRefNo: "TRN2",
      status: "paid",
      ppResponseCode: "121",
      ppStatus: "Completed",
      resolvedAt: "2026-08-25T10:11:00.000Z",
      eventSource: "status_inquiry",
      rawPayload: '{"pp_Status":"Completed"}',
    });

    expect(resolved.status).toBe("paid");
    expect(orderRepository.findById(order.id)?.paymentStatus).toBe("paid");
  });

  it("never regresses a payment that is already paid", () => {
    const { orderRepository, paymentRepository, service } = createRepositories();
    const { order } = service.create({
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
      customer: createTestCustomer(),
      lines: [{ productId: "travel-mug", quantity: 1 }],
    });
    paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN3",
      amountPaisa: order.subtotalCents,
      initiatedAt: "2026-08-25T10:01:00.000Z",
    });
    paymentRepository.resolve({
      ppTxnRefNo: "TRN3",
      status: "paid",
      ppResponseCode: "121",
      ppStatus: "Completed",
      resolvedAt: "2026-08-25T10:11:00.000Z",
      eventSource: "status_inquiry",
      rawPayload: null,
    });

    // A late, retried IPN delivery reporting failure must not unpay the order.
    paymentRepository.resolve({
      ppTxnRefNo: "TRN3",
      status: "failed",
      ppResponseCode: "199",
      ppStatus: null,
      resolvedAt: "2026-08-25T10:12:00.000Z",
      eventSource: "ipn",
      rawPayload: null,
    });

    expect(orderRepository.findById(order.id)?.paymentStatus).toBe("paid");
  });

  it("throws PaymentNotFoundError when resolving an unknown reference", () => {
    const { paymentRepository } = createRepositories();
    expect(() =>
      paymentRepository.resolve({
        ppTxnRefNo: "unknown",
        status: "failed",
        ppResponseCode: "199",
        ppStatus: null,
        resolvedAt: "2026-08-25T10:12:00.000Z",
        eventSource: "ipn",
        rawPayload: null,
      }),
    ).toThrow(PaymentNotFoundError);
  });

  it("lists unresolved payments initiated before a cutoff", () => {
    const { paymentRepository, service } = createRepositories();
    const { order } = service.create({
      idempotencyKey: "00000000-0000-4000-8000-000000000004",
      customer: createTestCustomer(),
      lines: [{ productId: "desk-lamp", quantity: 1 }],
    });
    paymentRepository.initiate({
      orderId: order.id,
      ppTxnRefNo: "TRN4",
      amountPaisa: order.subtotalCents,
      initiatedAt: "2026-08-25T09:00:00.000Z",
    });

    expect(
      paymentRepository.listUnresolved("2026-08-25T10:00:00.000Z"),
    ).toHaveLength(1);
    expect(
      paymentRepository.listUnresolved("2026-08-25T08:00:00.000Z"),
    ).toHaveLength(0);
  });
});
