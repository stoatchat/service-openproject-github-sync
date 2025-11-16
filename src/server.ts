/**
 * HTTP server setup and routing
 */

import type { Config } from "./config.ts";
import { validateWebhookToken, getWebhookSource } from "./middleware/auth.ts";
import * as logger from "./utils/logger.ts";
import { handleGitHubWebhook } from "./handlers/github-webhook.ts";
import { handleOpenProjectWebhook } from "./handlers/openproject-webhook.ts";

export async function startServer(config: Config): Promise<void> {
  const port = 8000;

  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    logger.debug(`Incoming request: ${req.method} ${url.pathname}`);

    // Health check endpoint
    if (url.pathname === "/health" && req.method === "GET") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Webhook endpoints
    if (url.pathname.startsWith("/webhook/") && req.method === "POST") {
      // Validate token
      if (!validateWebhookToken(url.pathname, config.secretToken)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Determine source and route to appropriate handler
      const source = getWebhookSource(url.pathname);

      if (source === "github") {
        try {
          const body = await req.json();
          await handleGitHubWebhook(body, req.headers, config);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          logger.error("Error handling GitHub webhook", { error: String(error) });
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      } else if (source === "openproject") {
        try {
          const body = await req.json();
          await handleOpenProjectWebhook(body, config);
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          logger.error("Error handling OpenProject webhook", { error: String(error) });
          return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // Not found
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  };

  logger.info(`Starting HTTP server on port ${port}`);
  await Deno.serve({ port }, handler).finished;
}
