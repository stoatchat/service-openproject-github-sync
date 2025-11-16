/**
 * Assignee mapping between GitHub and OpenProject
 */

import type { Config } from "../config.ts";
import * as logger from "../utils/logger.ts";

/**
 * Map GitHub username to OpenProject user ID
 * Returns null if no mapping exists
 */
export function mapGitHubUserToOPUser(
  githubUsername: string,
  config: Config,
): number | null {
  const opUserId = config.assigneeMap.get(githubUsername);

  if (opUserId === undefined) {
    logger.debug(`No assignee mapping found for GitHub user: ${githubUsername}`);
    return null;
  }

  return opUserId;
}

/**
 * Map OpenProject user ID to GitHub username
 * Returns null if no mapping exists
 */
export function mapOPUserToGitHubUser(
  opUserId: number,
  config: Config,
): string | null {
  // Reverse lookup in the assignee map
  for (const [ghUser, opId] of config.assigneeMap.entries()) {
    if (opId === opUserId) {
      return ghUser;
    }
  }

  logger.debug(`No assignee mapping found for OpenProject user ID: ${opUserId}`);
  return null;
}

/**
 * Get assignee href for OpenProject API
 */
export function getAssigneeHref(userId: number): string {
  return `/api/v3/users/${userId}`;
}

/**
 * Extract user ID from OpenProject user link
 */
export function extractUserIdFromHref(href: string): number | null {
  const match = href.match(/\/api\/v3\/users\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
