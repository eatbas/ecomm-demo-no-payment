import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createSessionToken,
  parseCookies,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  verifyAdminPassword,
  verifySessionToken,
} from "../auth/admin-session.js";

export interface AdminAuthConfig {
  readonly adminPasswordHash: string;
  readonly adminSessionSecret: string;
  readonly secureCookies: boolean;
}

interface AdminLoginBody {
  readonly password: string;
}

const adminLoginBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["password"],
  properties: {
    password: { type: "string", minLength: 1, maxLength: 512 },
  },
} as const;

/** True when the request carries a valid, unexpired admin session cookie. */
export function isAdminSessionAuthenticated(
  request: FastifyRequest,
  config: AdminAuthConfig,
): boolean {
  const token = parseCookies(request.headers.cookie).get(
    ADMIN_SESSION_COOKIE_NAME,
  );
  return (
    token !== undefined && verifySessionToken(token, config.adminSessionSecret)
  );
}

const UNAUTHORIZED_RESPONSE = {
  code: "UNAUTHORIZED",
  message: "Admin authentication is required.",
} as const;

/** A Fastify preHandler that rejects any request without a valid admin session. */
export function requireAdminSession(config: AdminAuthConfig) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void): void => {
    if (!isAdminSessionAuthenticated(request, config)) {
      reply.code(401).send(UNAUTHORIZED_RESPONSE);
      return;
    }
    done();
  };
}

export function registerAdminAuthRoutes(
  app: FastifyInstance,
  config: AdminAuthConfig,
): void {
  app.post<{ Body: AdminLoginBody }>(
    "/api/admin/login",
    { schema: { body: adminLoginBodySchema } },
    (request, reply) => {
      if (!verifyAdminPassword(request.body.password, config.adminPasswordHash)) {
        return reply.code(401).send(UNAUTHORIZED_RESPONSE);
      }

      const token = createSessionToken(config.adminSessionSecret);
      reply.header(
        "set-cookie",
        serializeSessionCookie(token, config.secureCookies),
      );
      return reply.code(204).send();
    },
  );

  app.post("/api/admin/logout", (_request, reply) => {
    reply.header(
      "set-cookie",
      serializeExpiredSessionCookie(config.secureCookies),
    );
    return reply.code(204).send();
  });

  app.get("/api/admin/session", (request, reply) => {
    if (!isAdminSessionAuthenticated(request, config)) {
      return reply.code(401).send(UNAUTHORIZED_RESPONSE);
    }
    return reply.code(204).send();
  });
}
