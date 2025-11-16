/**
 * Startup reconciliation sync
 * Creates missing issues/work packages on both sides for unlinked items
 */

import type { Config } from "../config.ts";
import { GitHubClient } from "../clients/github.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";
import * as linkMapper from "../mappers/link.ts";
import { syncGitHubIssueToOP } from "./github-to-op.ts";
import { syncOPWorkPackageToGitHub } from "./op-to-github.ts";

/**
 * Perform full reconciliation sync on startup
 * Creates new items on both sides for anything unlinked
 */
export async function performReconciliationSync(
  config: Config,
  ghClient: GitHubClient,
  opClient: OpenProjectClient,
): Promise<void> {
  logger.info("Starting reconciliation sync...");

  let totalGHCreated = 0;
  let totalOPCreated = 0;

  // Process each repository/project mapping
  for (const [repoFullName, projectId] of config.repoProjectMap.entries()) {
    try {
      logger.info(`Reconciling ${repoFullName} <-> project ${projectId}`);

      const parsed = linkMapper.parseRepoFullName(repoFullName);
      if (!parsed) {
        logger.error(`Invalid repository name: ${repoFullName}`);
        continue;
      }

      const { owner, repo } = parsed;

      // Fetch all issues and work packages
      const [issues, workPackages] = await Promise.all([
        ghClient.listIssues(owner, repo, "all"),
        opClient.listWorkPackages(projectId),
      ]);

      // Find unlinked GitHub issues
      const unlinkedIssues = issues.filter(issue => !linkMapper.isGitHubIssueLinked(issue));

      logger.info(`Found ${unlinkedIssues.length} unlinked GitHub issues in ${repoFullName}`);

      // Create OP work packages for unlinked GitHub issues
      for (const issue of unlinkedIssues) {
        const workPackage = await syncGitHubIssueToOP(
          issue,
          repoFullName,
          projectId,
          opClient,
          config,
        );

        if (workPackage) {
          totalOPCreated++;

          // Now update the GitHub issue with the OP prefix
          try {
            const updatedTitle = linkMapper.addOPPrefixToTitle(issue.title, workPackage.id);
            await ghClient.updateIssue(owner, repo, issue.number, { title: updatedTitle });
            logger.info(`Added OP prefix to GitHub issue #${issue.number}`);
          } catch (error) {
            logger.error(`Failed to add OP prefix to GitHub issue #${issue.number}`, {
              error: String(error),
            });
          }
        }
      }

      // Find unlinked OP work packages
      const unlinkedWorkPackages = workPackages.filter(
        wp => !linkMapper.isWorkPackageLinked(wp, config.opGithubIssueField),
      );

      logger.info(`Found ${unlinkedWorkPackages.length} unlinked OP work packages in project ${projectId}`);

      // Create GitHub issues for unlinked OP work packages
      for (const workPackage of unlinkedWorkPackages) {
        const issue = await syncOPWorkPackageToGitHub(
          workPackage,
          repoFullName,
          ghClient,
          config,
        );

        if (issue) {
          totalGHCreated++;

          // Now update the OP work package with the GitHub issue number
          try {
            const updateRequest: any = {
              lockVersion: workPackage.lockVersion,
              [config.opGithubIssueField]: issue.number,
            };

            await opClient.updateWorkPackage(workPackage.id, updateRequest);
            logger.info(`Added GitHub issue number to OP work package ${workPackage.id}`);
          } catch (error) {
            logger.error(`Failed to add GitHub issue number to OP work package ${workPackage.id}`, {
              error: String(error),
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to reconcile ${repoFullName}`, { error: String(error) });
      // Continue with other repositories
    }
  }

  logger.info("Reconciliation sync completed", {
    githubIssuesCreated: totalGHCreated,
    opWorkPackagesCreated: totalOPCreated,
  });
}
