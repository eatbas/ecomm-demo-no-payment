import {
  DEFAULT_ADMIN_ORDER_LIMIT,
  type AdminOrdersResponse,
  type CompletedOrder,
  type CreateOrderRequest,
} from "../../../shared/orders";
import {
  parseAdminOrdersResponse,
  parseCompletedOrder,
  parseOrderErrorResponse,
} from "@/features/orders/order.validation";

export class OrderApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderApiError";
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new OrderApiError("The order service returned an unreadable response.");
  }
}

type OrderApiOperation = "create" | "list";

async function requestJson(
  operation: OrderApiOperation,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;

  try {
    response =
      operation === "create"
        ? await fetch("/api/orders", init)
        : await fetch(
            `/api/admin/orders?limit=${DEFAULT_ADMIN_ORDER_LIMIT}`,
            init,
          );
  } catch {
    throw new OrderApiError("The order service could not be reached. Try again.");
  }

  const body = await readJsonResponse(response);
  if (!response.ok) {
    const errorResponse = parseOrderErrorResponse(body);
    throw new OrderApiError(
      errorResponse?.message ?? "The order service rejected the request.",
    );
  }

  return body;
}

export async function createOrder(
  request: CreateOrderRequest,
  signal?: AbortSignal,
): Promise<CompletedOrder> {
  const body = await requestJson("create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const order = parseCompletedOrder(body);

  if (order === null) {
    throw new OrderApiError("The order service returned an invalid confirmation.");
  }

  return order;
}

export async function listCompletedOrders(
  signal?: AbortSignal,
): Promise<AdminOrdersResponse> {
  const body = await requestJson("list", { signal });
  const response = parseAdminOrdersResponse(body);

  if (response === null) {
    throw new OrderApiError("The order service returned an invalid order list.");
  }

  return response;
}
