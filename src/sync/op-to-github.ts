/**
 * Sync from OpenProject work packages to GitHub issues
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
import * as typeMapper from "../mappers/type.ts";

/**
 * Sync an OpenProject work package to GitHub issue
 * Creates a new issue if it doesn't exist, or updates existing one
 */
export async function syncOPWorkPackageToGitHub(
  workPackage: OPWorkPackage,
  repoFullName: string,
  ghClient: GitHubClient,
  config: Config,
): Promise<GitHubIssue | null> {
  try {
    const parsed = linkMapper.parseRepoFullName(repoFullName);
    if (!parsed) {
      logger.error(`Invalid repository name: ${repoFullName}`);
      return null;
    }

    const { owner, repo } = parsed;

    // Check if work package is already linked to a GitHub issue
    const ghIssueNumber = linkMapper.getGitHubIssueNumber(workPackage, config.opGithubIssueField);

    if (ghIssueNumber) {
      // Update existing issue
      return await updateGitHubFromOP(workPackage, owner, repo, ghIssueNumber, ghClient, config);
    } else {
      // Create new issue
      return await createGitHubFromOP(workPackage, owner, repo, ghClient, config);
    }
  } catch (error) {
    logger.error(`Failed to sync OP work package to GitHub`, {
      workPackageId: workPackage.id,
      repo: repoFullName,
      error: String(error),
    });
    return null;
  }
}

/**
 * Create a new GitHub issue from an OpenProject work package
 */
async function createGitHubFromOP(
  workPackage: OPWorkPackage,
  owner: string,
  repo: string,
  ghClient: GitHubClient,
  config: Config,
): Promise<GitHubIssue> {
  logger.info(`Creating GitHub issue from OP work package ${workPackage.id}`, {
    repo: `${owner}/${repo}`,
  });

  // Add OP prefix to title
  const title = linkMapper.addOPPrefixToTitle(workPackage.subject, workPackage.id);

  // Get status name and map to GitHub state
  const statusHref = workPackage._links.status?.href;
  const statusId = statusHref ? parseInt(statusHref.split("/").pop() || "", 10) : null;
  const statusName = statusId ? statusMapper.getStatusNameFromCache(statusId) : null;
  const state = statusName ? statusMapper.mapOPStatusToGitHubState(statusName) : "open";

  // Map type
  const typeHref = workPackage._links.type?.href;
  const opTypeId = typeHref ? typeMapper.extractTypeIdFromHref(typeHref) : null;
  const ghType = opTypeId ? typeMapper.mapOPTypeToGitHubType(opTypeId, config) : null;

  // Map assignee
  const assigneeHref = workPackage._links.assignee?.href;
  const opAssigneeId = assigneeHref ? assigneeMapper.extractUserIdFromHref(assigneeHref) : null;
  const ghAssignee = opAssigneeId
    ? assigneeMapper.mapOPUserToGitHubUser(opAssigneeId, config)
    : null;

  const createRequest: any = {
    title,
    body: workPackage.description?.raw || "",
    state,
  };

  // Add type if we found a mapping
  if (ghType) {
    createRequest.type = ghType;
  }

  // Add assignee if we found a mapping
  if (ghAssignee) {
    createRequest.assignee = ghAssignee;
  }

  const issue = await ghClient.createIssue(owner, repo, createRequest);

  logger.info(`Created GitHub issue #${issue.number} from OP work package ${workPackage.id}`);
  return issue;
}

/**
 * Update an existing GitHub issue from an OpenProject work package
 */
async function updateGitHubFromOP(
  workPackage: OPWorkPackage,
  owner: string,
  repo: string,
  issueNumber: number,
  ghClient: GitHubClient,
  config: Config,
): Promise<GitHubIssue> {
  // Fetch current issue
  const issue = await ghClient.getIssue(owner, repo, issueNumber);

  // Check timestamps for conflict resolution (last-write-wins)
  const issueUpdated = new Date(issue.updated_at);
  const wpUpdated = new Date(workPackage.updatedAt);

  if (issueUpdated > wpUpdated) {
    logger.info(`GitHub issue #${issueNumber} is newer than OP work package, skipping update`, {
      ghUpdated: issue.updated_at,
      opUpdated: workPackage.updatedAt,
    });
    return issue;
  }

  logger.info(`Updating GitHub issue #${issueNumber} from OP work package ${workPackage.id}`);

  // Ensure title has OP prefix
  const title = linkMapper.addOPPrefixToTitle(workPackage.subject, workPackage.id);

  // Get status name and map to GitHub state
  const statusHref = workPackage._links.status?.href;
  const statusId = statusHref ? parseInt(statusHref.split("/").pop() || "", 10) : null;
  const statusName = statusId ? statusMapper.getStatusNameFromCache(statusId) : null;
  const state = statusName ? statusMapper.mapOPStatusToGitHubState(statusName) : "open";

  // Map type
  const typeHref = workPackage._links.type?.href;
  const opTypeId = typeHref ? typeMapper.extractTypeIdFromHref(typeHref) : null;
  const ghType = opTypeId ? typeMapper.mapOPTypeToGitHubType(opTypeId, config) : null;

  // Map assignee
  const assigneeHref = workPackage._links.assignee?.href;
  const opAssigneeId = assigneeHref ? assigneeMapper.extractUserIdFromHref(assigneeHref) : null;
  const ghAssignee = opAssigneeId
    ? assigneeMapper.mapOPUserToGitHubUser(opAssigneeId, config)
    : null;

  const updateRequest: any = {
    title,
    body: workPackage.description?.raw || "",
    state,
  };

  // Update type if we found a mapping
  if (ghType) {
    updateRequest.type = ghType;
  }

  // Update assignee (null to clear)
  updateRequest.assignee = ghAssignee;

  const updated = await ghClient.updateIssue(owner, repo, issueNumber, updateRequest);
  logger.info(`Updated GitHub issue #${issueNumber}`);
  return updated;
}
