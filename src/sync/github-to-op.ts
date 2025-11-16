/**
 * Sync from GitHub issues to OpenProject work packages
 */

import type { GitHubIssue } from "../types/github.ts";
import type { OPWorkPackage } from "../types/openproject.ts";
import type { Config } from "../config.ts";
import { GitHubClient } from "../clients/github.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";
import * as statusMapper from "../mappers/status.ts";
import * as assigneeMapper from "../mappers/assignee.ts";
import * as linkMapper from "../mappers/link.ts";

/**
 * Sync a GitHub issue to OpenProject work package
 * Creates a new work package if it doesn't exist, or updates existing one
 */
export async function syncGitHubIssueToOP(
  issue: GitHubIssue,
  repoFullName: string,
  projectId: number,
  opClient: OpenProjectClient,
  config: Config,
): Promise<OPWorkPackage | null> {
  try {
    // Check if issue is already linked to a work package
    const opId = linkMapper.extractOPIdFromTitle(issue.title);

    if (opId) {
      // Update existing work package
      return await updateOPFromGitHub(issue, opId, opClient, config);
    } else {
      // Create new work package
      return await createOPFromGitHub(issue, repoFullName, projectId, opClient, config);
    }
  } catch (error) {
    logger.error(`Failed to sync GitHub issue to OP`, {
      repo: repoFullName,
      issueNumber: issue.number,
      error: String(error),
    });
    return null;
  }
}

/**
 * Create a new OpenProject work package from a GitHub issue
 */
async function createOPFromGitHub(
  issue: GitHubIssue,
  repoFullName: string,
  projectId: number,
  opClient: OpenProjectClient,
  config: Config,
): Promise<OPWorkPackage> {
  logger.info(`Creating OP work package from GitHub issue`, {
    repo: repoFullName,
    issueNumber: issue.number,
  });

  // Get default type href
  const typeHref = await opClient.getDefaultTypeHref(projectId);

  // Map status
  const statusId = statusMapper.mapGitHubStateToOPStatus(issue.state);

  // Map assignee
  const opAssigneeId = issue.assignee
    ? assigneeMapper.mapGitHubUserToOPUser(issue.assignee.login, config)
    : null;

  // Clean title (remove OP prefix if it somehow exists)
  const cleanTitle = linkMapper.removeOPPrefixFromTitle(issue.title);

  const createRequest: any = {
    subject: cleanTitle,
    description: {
      raw: issue.body || "",
    },
    _links: {
      type: {
        href: typeHref,
      },
    },
  };

  // Add status if we found a mapping
  if (statusId !== null) {
    createRequest._links.status = {
      href: statusMapper.getStatusHref(statusId),
    };
  }

  // Add assignee if we found a mapping
  if (opAssigneeId !== null) {
    createRequest._links.assignee = {
      href: assigneeMapper.getAssigneeHref(opAssigneeId),
    };
  }

  // Add GitHub issue number as custom field
  createRequest[config.opGithubIssueField] = issue.number;

  const workPackage = await opClient.createWorkPackage(projectId, createRequest);

  logger.info(`Created OP work package ${workPackage.id} from GitHub issue ${issue.number}`);
  return workPackage;
}

/**
 * Update an existing OpenProject work package from a GitHub issue
 */
async function updateOPFromGitHub(
  issue: GitHubIssue,
  opId: number,
  opClient: OpenProjectClient,
  config: Config,
): Promise<OPWorkPackage> {
  // Fetch current work package
  const workPackage = await opClient.getWorkPackage(opId);

  // Check timestamps for conflict resolution (last-write-wins)
  const issueUpdated = new Date(issue.updated_at);
  const wpUpdated = new Date(workPackage.updatedAt);

  if (wpUpdated > issueUpdated) {
    logger.info(`OP work package ${opId} is newer than GitHub issue, skipping update`, {
      opUpdated: workPackage.updatedAt,
      ghUpdated: issue.updated_at,
    });
    return workPackage;
  }

  logger.info(`Updating OP work package ${opId} from GitHub issue ${issue.number}`);

  // Clean title (remove OP prefix)
  const cleanTitle = linkMapper.removeOPPrefixFromTitle(issue.title);

  const updateRequest: any = {
    lockVersion: workPackage.lockVersion,
    subject: cleanTitle,
    description: {
      raw: issue.body || "",
    },
    _links: {},
  };

  // Map status
  const statusId = statusMapper.mapGitHubStateToOPStatus(issue.state);
  if (statusId !== null) {
    updateRequest._links.status = {
      href: statusMapper.getStatusHref(statusId),
    };
  }

  // Map assignee
  if (issue.assignee) {
    const opAssigneeId = assigneeMapper.mapGitHubUserToOPUser(issue.assignee.login, config);
    if (opAssigneeId !== null) {
      updateRequest._links.assignee = {
        href: assigneeMapper.getAssigneeHref(opAssigneeId),
      };
    }
  } else {
    // Clear assignee
    updateRequest._links.assignee = { href: null };
  }

  const updated = await opClient.updateWorkPackage(opId, updateRequest);
  logger.info(`Updated OP work package ${opId}`);
  return updated;
}
