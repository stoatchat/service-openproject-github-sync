/**
 * Link detection and title formatting utilities
 */

import type { GitHubIssue } from "../types/github.ts";
import type { OPWorkPackage } from "../types/openproject.ts";
import type { Config } from "../config.ts";
import * as logger from "../utils/logger.ts";

const OP_PREFIX_PATTERN = /^\[OP#(\d+)\]\s*/;

/**
 * Add OpenProject prefix to GitHub issue title
 * Format: [OP#123] Original Title
 */
export function addOPPrefixToTitle(title: string, opWorkPackageId: number): string {
  // Remove existing prefix if present
  const cleanTitle = title.replace(OP_PREFIX_PATTERN, "");
  return `[OP#${opWorkPackageId}] ${cleanTitle}`;
}

/**
 * Remove OpenProject prefix from title
 */
export function removeOPPrefixFromTitle(title: string): string {
  return title.replace(OP_PREFIX_PATTERN, "");
}

/**
 * Extract OpenProject work package ID from GitHub issue title
 * Returns null if no prefix found
 */
export function extractOPIdFromTitle(title: string): number | null {
  const match = title.match(OP_PREFIX_PATTERN);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if GitHub issue has OpenProject prefix
 */
export function hasOPPrefix(title: string): boolean {
  return OP_PREFIX_PATTERN.test(title);
}

/**
 * Extract GitHub issue number from OpenProject custom field
 */
export function getGitHubIssueNumber(
  workPackage: OPWorkPackage,
  customFieldId: string,
): number | null {
  const value = workPackage[customFieldId];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Check if work package is linked to a GitHub issue
 */
export function isWorkPackageLinked(
  workPackage: OPWorkPackage,
  customFieldId: string,
): boolean {
  return getGitHubIssueNumber(workPackage, customFieldId) !== null;
}

/**
 * Check if GitHub issue is linked to an OpenProject work package
 */
export function isGitHubIssueLinked(issue: GitHubIssue): boolean {
  return hasOPPrefix(issue.title);
}

/**
 * Get repository owner and name from full name
 * Example: "stoatchat/for-web" -> { owner: "stoatchat", repo: "for-web" }
 */
export function parseRepoFullName(fullName: string): { owner: string; repo: string } | null {
  const parts = fullName.split("/");
  if (parts.length !== 2) {
    logger.warn(`Invalid repository full name: ${fullName}`);
    return null;
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}
