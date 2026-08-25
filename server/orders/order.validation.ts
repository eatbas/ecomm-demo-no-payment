import { catalogueProducts } from "../../shared/catalogue.js";
import {
  DEFAULT_ADMIN_ORDER_LIMIT,
  DEMO_CUSTOMER,
  MAX_ADMIN_ORDER_LIMIT,
  MAX_ORDER_LINES,
  MAX_ORDER_QUANTITY,
} from "../../shared/orders.js";

const productIds = catalogueProducts.map((product) => product.id);

export const createOrderBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["idempotencyKey", "demoCustomerId", "lines"],
  properties: {
    idempotencyKey: {
      type: "string",
      minLength: 36,
      maxLength: 36,
      pattern:
        "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    },
    demoCustomerId: { type: "string", const: DEMO_CUSTOMER.id },
    lines: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ORDER_LINES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["productId", "quantity"],
        properties: {
          productId: { type: "string", enum: productIds },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: MAX_ORDER_QUANTITY,
          },
        },
      },
    },
  },
} as const;

export const adminOrdersQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_ADMIN_ORDER_LIMIT,
      default: DEFAULT_ADMIN_ORDER_LIMIT,
    },
  },
} as const;
