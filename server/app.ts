import staticPlugin from "@fastify/static";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { extname } from "node:path";
import { openOrderDatabase } from "./db/database.js";
import type { JazzCashConfig } from "./config.js";
import { IdempotencyConflictError, OrderRepository } from "./orders/order.repository.js";
import { OrderService, OrderValidationError } from "./orders/order.service.js";
import { PaymentRepository } from "./payments/payment.repository.js";
import { registerAdminOrderRoutes } from "./routes/admin-orders.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerPaymentRoutes } from "./routes/payments.js";

const API_BODY_LIMIT_BYTES = 16 * 1024;
const HASHED_ASSET_PATH = /[/\\]assets[/\\].+-[A-Za-z0-9_-]{8,}\.[^/\\]+$/;
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'self'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "img-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
].join("; ");

export interface BuildAppOptions {
  readonly databasePath: string;
  readonly staticRoot?: string;
  readonly logger?: FastifyServerOptions["logger"];
  readonly jazzcash?: JazzCashConfig;
}

function setSecurityHeaders(reply: {
  header(name: string, value: string): unknown;
  hasHeader?(name: string): boolean;
}): void {
  if (typeof reply.hasHeader !== "function" || !reply.hasHeader("Content-Security-Policy")) {
    reply.header("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  }
  reply.header(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  reply.header("Referrer-Policy", "no-referrer");
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
}

function setStaticCacheHeaders(
  reply: { header(name: string, value: string): unknown },
  filePath: string,
): void {
  reply.header(
    "Cache-Control",
    HASHED_ASSET_PATH.test(filePath)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  );
}

function isDynamicPath(pathname: string): boolean {
  return (
    pathname === "/healthz" ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function getRequestPathname(url: string): string {
  return url.split("?", 1)[0] ?? "/";
}

function canUseSpaFallback(method: string, pathname: string): boolean {
  return (
    (method === "GET" || method === "HEAD") &&
    !isDynamicPath(pathname) &&
    !pathname.startsWith("/assets/") &&
    !pathname.startsWith("/products/") &&
    extname(pathname) === ""
  );
}

/** Build an API/static application whose database lifetime follows Fastify. */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const database = openOrderDatabase(options.databasePath);
  const repository = new OrderRepository(database);
  const service = new OrderService(repository);
  const paymentRepository = new PaymentRepository(repository);
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false } },
    bodyLimit: API_BODY_LIMIT_BYTES,
    logger: options.logger ?? false,
  });

  try {
    app.addHook("onSend", (request, reply, payload, done) => {
      setSecurityHeaders(reply);
      if (isDynamicPath(getRequestPathname(request.url))) {
        reply.header("Cache-Control", "no-store");
      } else if (!reply.hasHeader("Cache-Control")) {
        reply.header("Cache-Control", "no-cache");
      }
      done(null, payload);
    });

    app.addHook("onClose", () => {
      repository.close();
    });

    app.get("/healthz", (_request, reply) => {
      if (!repository.isReady) {
        return reply.code(503).type("text/plain").send("not ready\n");
      }
      return reply.type("text/plain").send("ok\n");
    });

    registerOrderRoutes(app, service);
    registerAdminOrderRoutes(app, service);

    if (options.jazzcash !== undefined) {
      registerPaymentRoutes({
        app,
        orderService: service,
        paymentRepository,
        jazzcash: options.jazzcash,
      });
    }

    if (options.staticRoot !== undefined) {
      await app.register(staticPlugin, {
        root: options.staticRoot,
        cacheControl: false,
        setHeaders: setStaticCacheHeaders,
      });
    }

    app.setNotFoundHandler((request, reply) => {
      const pathname = getRequestPathname(request.url);
      if (options.staticRoot !== undefined && canUseSpaFallback(request.method, pathname)) {
        return reply.sendFile("index.html", {
          maxAge: 0,
          immutable: false,
        });
      }

      if (isDynamicPath(pathname)) {
        reply.header("Cache-Control", "no-store");
      }
      return reply.code(404).send({
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
      });
    });

    app.setErrorHandler((error: FastifyError, request, reply) => {
      if (
        error.validation !== undefined ||
        error.statusCode === 400 ||
        error.statusCode === 415
      ) {
        return reply.code(error.statusCode === 415 ? 415 : 400).send({
          code: "INVALID_REQUEST",
          message: "The request is invalid.",
        });
      }
      if (error.statusCode === 413) {
        return reply.code(413).send({
          code: "PAYLOAD_TOO_LARGE",
          message: "The request body is too large.",
        });
      }
      if (error instanceof OrderValidationError) {
        return reply.code(400).send({
          code: "INVALID_ORDER",
          message: error.message,
        });
      }
      if (error instanceof IdempotencyConflictError) {
        return reply.code(409).send({
          code: "IDEMPOTENCY_CONFLICT",
          message: error.message,
        });
      }

      request.log.error(
        { err: error, requestId: request.id },
        "Unhandled order service error",
      );
      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "The order service encountered an unexpected error.",
      });
    });

    await app.ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
