import type { FastifyInstance } from "fastify";
import { DEFAULT_ADMIN_ORDER_LIMIT } from "../../shared/orders.js";
import type { OrderService } from "../orders/order.service.js";
import { adminOrdersQuerySchema } from "../orders/order.validation.js";

interface AdminOrdersQuery {
  readonly limit?: number;
}

export function registerAdminOrderRoutes(
  app: FastifyInstance,
  service: OrderService,
): void {
  app.get<{ Querystring: AdminOrdersQuery }>(
    "/api/admin/orders",
    { schema: { querystring: adminOrdersQuerySchema } },
    (request) => ({
      orders: service.listPaid(
        request.query.limit ?? DEFAULT_ADMIN_ORDER_LIMIT,
      ),
    }),
  );
}
