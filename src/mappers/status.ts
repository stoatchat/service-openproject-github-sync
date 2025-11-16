/**
 * Status mapping between GitHub and OpenProject
 */

import type { OPStatus } from "../types/openproject.ts";
import type { Config } from "../config.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";

/**
 * Status mapping cache to avoid repeated API calls
 */
let statusCache: OPStatus[] | null = null;

/**
 * Initialize status cache by fetching from OpenProject
 */
export async function initializeStatusMapping(client: OpenProjectClient): Promise<void> {
  if (!statusCache) {
    statusCache = await client.getStatuses();
    logger.info("Status mapping initialized", {
      statuses: statusCache.map(s => ({ id: s.id, name: s.name })),
    });
  }
}

/**
 * Get OpenProject status ID by name
 */
function getStatusIdByName(name: string): number | null {
  if (!statusCache) {
    logger.error("Status cache not initialized");
    return null;
  }

  const status = statusCache.find(s => s.name.toLowerCase() === name.toLowerCase());
  return status ? status.id : null;
}

/**
 * Map GitHub state to OpenProject status
 * - open -> "new"
 * - closed -> "closed"
 */
export function mapGitHubStateToOPStatus(githubState: "open" | "closed"): number | null {
  const statusName = githubState === "open" ? "new" : "closed";
  const statusId = getStatusIdByName(statusName);

  if (statusId === null) {
    logger.warn(`Could not find OpenProject status for: ${statusName}`);
  }

  return statusId;
}

/**
 * Map OpenProject status to GitHub state
 * - "closed", "rejected" -> closed
 * - everything else -> open
 */
export function mapOPStatusToGitHubState(opStatusName: string): "open" | "closed" {
  const normalizedStatus = opStatusName.toLowerCase();

  if (normalizedStatus === "closed" || normalizedStatus === "rejected") {
    return "closed";
  }

  return "open";
}

/**
 * Get status href for OpenProject API
 */
export function getStatusHref(statusId: number): string {
  return `/api/v3/statuses/${statusId}`;
}

/**
 * Get status name from status link
 */
export function getStatusNameFromCache(statusId: number): string | null {
  if (!statusCache) {
    return null;
  }

  const status = statusCache.find(s => s.id === statusId);
  return status ? status.name : null;
}
