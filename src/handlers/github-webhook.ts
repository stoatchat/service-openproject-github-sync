/**
 * GitHub webhook handler
 */

import type { GitHubIssueWebhook } from "../types/github.ts";
import type { Config } from "../config.ts";
import { GitHubClient } from "../clients/github.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";
import { syncGitHubIssueToOP } from "../sync/github-to-op.ts";

/**
 * Handle incoming GitHub webhook
 */
export async function handleGitHubWebhook(
  payload: GitHubIssueWebhook,
  headers: Headers,
  config: Config,
): Promise<void> {
  const event = headers.get("X-GitHub-Event");

  logger.info("Received GitHub webhook", {
    event,
    action: payload.action,
    repo: payload.repository?.full_name,
    issue: payload.issue?.number,
  });

  // Only process issue events
  if (event !== "issues") {
    logger.debug("Ignoring non-issue event", { event });
    return;
  }

  // Check if this repository is configured for sync
  const repoFullName = payload.repository.full_name;
  const projectId = config.repoProjectMap.get(repoFullName);

  if (!projectId) {
    logger.warn("Repository not configured for sync", { repo: repoFullName });
    return;
  }

  // Filter relevant actions
  const relevantActions = ["opened", "edited", "closed", "reopened", "assigned", "unassigned"];
  if (!relevantActions.includes(payload.action)) {
    logger.debug("Ignoring action", { action: payload.action });
    return;
  }

  // Initialize clients
  const opClient = new OpenProjectClient(config.opUrl, config.opToken);

  try {
    // Sync the issue to OpenProject
    await syncGitHubIssueToOP(
      payload.issue,
      repoFullName,
      projectId,
      opClient,
      config,
    );

    logger.info("Successfully processed GitHub webhook", {
      repo: repoFullName,
      issue: payload.issue.number,
      action: payload.action,
    });
  } catch (error) {
    logger.error("Failed to process GitHub webhook", {
      repo: repoFullName,
      issue: payload.issue.number,
      action: payload.action,
      error: String(error),
    });
    throw error; // Re-throw to return 500
  }
}
