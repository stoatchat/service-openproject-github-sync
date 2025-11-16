/**
 * Configuration loading and parsing
 */

import { load } from "@std/dotenv";
import { ConfigError } from "./utils/errors.ts";
import * as logger from "./utils/logger.ts";

export interface Config {
  githubToken: string;
  opToken: string;
  opUrl: string;
  secretToken: string;
  repoProjectMap: Map<string, number>; // "owner/repo" -> project_id
  assigneeMap: Map<string, number>;    // github_username -> op_user_id
  typeMap: Map<string, number>;        // github_issue_type -> op_type_id
  opGithubIssueField: string;          // Custom field ID
}

/**
 * Parse repository to project mapping from environment variable
 * Format: "owner/repo:project_id,owner/repo2:project_id2"
 */
function parseRepoProjectMap(mapString: string): Map<string, number> {
  const map = new Map<string, number>();

  if (!mapString || mapString.trim() === "") {
    throw new ConfigError("REPO_PROJECT_MAP is required but not provided");
  }

  const pairs = mapString.split(",").map(s => s.trim()).filter(s => s);

  for (const pair of pairs) {
    const [repo, projectIdStr] = pair.split(":");
    if (!repo || !projectIdStr) {
      throw new ConfigError(`Invalid repo:project mapping: ${pair}`);
    }

    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      throw new ConfigError(`Invalid project ID in mapping: ${projectIdStr}`);
    }

    map.set(repo.trim(), projectId);
  }

  logger.info(`Loaded ${map.size} repository mappings`, { repos: Array.from(map.keys()) });
  return map;
}

/**
 * Parse assignee mapping from environment variable
 * Format: "github_user1:op_user_id1,github_user2:op_user_id2"
 */
function parseAssigneeMap(mapString: string | undefined): Map<string, number> {
  const map = new Map<string, number>();

  if (!mapString || mapString.trim() === "") {
    logger.info("No assignee mapping configured");
    return map;
  }

  const pairs = mapString.split(",").map(s => s.trim()).filter(s => s);

  for (const pair of pairs) {
    const [ghUser, opUserIdStr] = pair.split(":");
    if (!ghUser || !opUserIdStr) {
      logger.warn(`Invalid assignee mapping, skipping: ${pair}`);
      continue;
    }

    const opUserId = parseInt(opUserIdStr, 10);
    if (isNaN(opUserId)) {
      logger.warn(`Invalid OP user ID in mapping, skipping: ${opUserIdStr}`);
      continue;
    }

    map.set(ghUser.trim(), opUserId);
  }

  logger.info(`Loaded ${map.size} assignee mappings`);
  return map;
}

/**
 * Parse type mapping from environment variable
 * Format: "Bug:1,Task:2,Feature:3"
 */
function parseTypeMap(mapString: string | undefined): Map<string, number> {
  const map = new Map<string, number>();

  if (!mapString || mapString.trim() === "") {
    logger.info("No type mapping configured");
    return map;
  }

  const pairs = mapString.split(",").map(s => s.trim()).filter(s => s);

  for (const pair of pairs) {
    const [ghType, opTypeIdStr] = pair.split(":");
    if (!ghType || !opTypeIdStr) {
      logger.warn(`Invalid type mapping, skipping: ${pair}`);
      continue;
    }

    const opTypeId = parseInt(opTypeIdStr, 10);
    if (isNaN(opTypeId)) {
      logger.warn(`Invalid OP type ID in mapping, skipping: ${opTypeIdStr}`);
      continue;
    }

    map.set(ghType.trim(), opTypeId);
  }

  logger.info(`Loaded ${map.size} type mappings`);
  return map;
}

/**
 * Load and validate configuration from environment variables
 */
export async function loadConfig(): Promise<Config> {
  // Load .env file if it exists
  await load({ export: true, allowEmptyValues: true });

  const githubToken = Deno.env.get("GH_TOKEN");
  const opToken = Deno.env.get("OP_TOKEN");
  const opUrl = Deno.env.get("OP_URL");
  const secretToken = Deno.env.get("SECRET_TOKEN");
  const repoProjectMapStr = Deno.env.get("REPO_PROJECT_MAP");
  const assigneeMapStr = Deno.env.get("ASSIGNEE_MAP");
  const typeMapStr = Deno.env.get("TYPE_MAP");
  const opGithubIssueField = Deno.env.get("OP_GITHUB_ISSUE_FIELD");

  // Validate required fields
  if (!githubToken) {
    throw new ConfigError("GH_TOKEN environment variable is required");
  }
  if (!opToken) {
    throw new ConfigError("OP_TOKEN environment variable is required");
  }
  if (!opUrl) {
    throw new ConfigError("OP_URL environment variable is required");
  }
  if (!secretToken) {
    throw new ConfigError("SECRET_TOKEN environment variable is required");
  }
  if (!repoProjectMapStr) {
    throw new ConfigError("REPO_PROJECT_MAP environment variable is required");
  }
  if (!opGithubIssueField) {
    throw new ConfigError("OP_GITHUB_ISSUE_FIELD environment variable is required");
  }

  const config: Config = {
    githubToken,
    opToken,
    opUrl: opUrl.replace(/\/$/, ""), // Remove trailing slash
    secretToken,
    repoProjectMap: parseRepoProjectMap(repoProjectMapStr),
    assigneeMap: parseAssigneeMap(assigneeMapStr),
    typeMap: parseTypeMap(typeMapStr),
    opGithubIssueField,
  };

  logger.info("Configuration loaded successfully");
  return config;
}
