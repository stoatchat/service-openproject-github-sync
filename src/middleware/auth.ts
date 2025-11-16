/**
 * Webhook authentication middleware
 */

import { AuthenticationError } from "../utils/errors.ts";
import * as logger from "../utils/logger.ts";

/**
 * Extract and validate the token from the URL path
 * Expected format: /webhook/:token/github or /webhook/:token/openproject
 */
export function validateWebhookToken(url: string, expectedToken: string): boolean {
  const urlPattern = /^\/webhook\/([^\/]+)\/(github|openproject)$/;
  const match = url.match(urlPattern);

  if (!match) {
    logger.warn("Invalid webhook URL format", { url });
    return false;
  }

  const [, token] = match;

  if (token !== expectedToken) {
    logger.warn("Invalid webhook token");
    return false;
  }

  return true;
}

/**
 * Determine webhook source from URL path
 */
export function getWebhookSource(url: string): "github" | "openproject" | null {
  const urlPattern = /^\/webhook\/[^\/]+\/(github|openproject)$/;
  const match = url.match(urlPattern);

  if (!match) {
    return null;
  }

  return match[1] as "github" | "openproject";
}
