/**
 * OpenProject webhook handler
 */

import type { OPWebhookPayload } from "../types/openproject.ts";
import type { Config } from "../config.ts";
import { GitHubClient } from "../clients/github.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";
import { syncOPWorkPackageToGitHub } from "../sync/op-to-github.ts";

/**
 * Handle incoming OpenProject webhook
 */
export async function handleOpenProjectWebhook(
  payload: OPWebhookPayload,
  config: Config,
): Promise<void> {
  logger.info("Received OpenProject webhook", {
    action: payload.action,
    workPackageId: payload.work_package?.id,
  });

  // Filter relevant actions
  const relevantActions = ["work_package:created", "work_package:updated"];
  if (!relevantActions.includes(payload.action)) {
    logger.debug("Ignoring action", { action: payload.action });
    return;
  }

  if (!payload.work_package?.id) {
    logger.warn("Webhook missing work package ID");
    return;
  }

  // Initialize clients
  const opClient = new OpenProjectClient(config.opUrl, config.opToken);
  const ghClient = new GitHubClient(config.githubToken);

  try {
    // Fetch the full work package details
    const workPackage = await opClient.getWorkPackage(payload.work_package.id);

    // Determine which repository this work package should sync to
    // We need to check the project ID and find the corresponding repository
    const projectHref = workPackage._links.project?.href;
    const projectId = projectHref ? parseInt(projectHref.split("/").pop() || "", 10) : null;

    if (!projectId) {
      logger.warn("Could not determine project ID from work package", {
        workPackageId: workPackage.id,
      });
      return;
    }

    // Find the repository for this project
    let repoFullName: string | null = null;
    for (const [repo, projId] of config.repoProjectMap.entries()) {
      if (projId === projectId) {
        repoFullName = repo;
        break;
      }
    }

    if (!repoFullName) {
      logger.warn("Project not configured for sync", { projectId });
      return;
    }

    // Sync the work package to GitHub
    await syncOPWorkPackageToGitHub(
      workPackage,
      repoFullName,
      ghClient,
      config,
    );

    logger.info("Successfully processed OpenProject webhook", {
      workPackageId: workPackage.id,
      repo: repoFullName,
      action: payload.action,
    });
  } catch (error) {
    logger.error("Failed to process OpenProject webhook", {
      workPackageId: payload.work_package.id,
      action: payload.action,
      error: String(error),
    });
    throw error; // Re-throw to return 500
  }
}
