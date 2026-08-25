import type { FastifyInstance } from "fastify";
import type { CreateOrderRequest } from "../../shared/orders.js";
import type { OrderService } from "../orders/order.service.js";
import { createOrderBodySchema } from "../orders/order.validation.js";

export function registerOrderRoutes(
  app: FastifyInstance,
  service: OrderService,
): void {
  app.post<{ Body: CreateOrderRequest }>(
    "/api/orders",
    {
      schema: { body: createOrderBodySchema },
      preValidation: (request, reply, done) => {
        const contentType = request.headers["content-type"];
        if (
          contentType === undefined ||
          !/^application\/json(?:\s*;|$)/i.test(contentType)
        ) {
          reply.code(415).send({
            code: "INVALID_REQUEST",
            message: "The request is invalid.",
          });
          return;
        }
        done();
      },
    },
    (request, reply) => {
      const result = service.create(request.body);
      return reply.code(201).send(result.order);
    },
  );
}
