import type { FastifyInstance } from "fastify";

import { createWebSession, type ServerAuthConfig } from "../auth.js";

export function registerSessionRoutes(
  server: FastifyInstance,
  auth: ServerAuthConfig,
): void {
  server.get("/api/v1/session", async (_request, reply) => {
    const session = createWebSession(auth.webSessionSecret);

    reply
      .header("cache-control", "no-store")
      .header("set-cookie", session.cookie)
      .send({
        data: {
          csrf_token: session.csrfToken,
        },
      });
  });
}
