/**
 * GitHub API client
 */

import type {
  GitHubIssue,
  CreateIssueRequest,
  UpdateIssueRequest,
} from "../types/github.ts";
import { GitHubAPIError } from "../utils/errors.ts";
import * as logger from "../utils/logger.ts";

export class GitHubClient {
  private baseUrl = "https://api.github.com";
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Authorization": `Bearer ${this.token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new GitHubAPIError(
          `GitHub API error: ${response.status} ${response.statusText}`,
          response.status,
          { url, errorText },
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof GitHubAPIError) {
        throw error;
      }
      throw new GitHubAPIError(`Failed to make GitHub API request: ${error}`, undefined, {
        url,
        error: String(error),
      });
    }
  }

  /**
   * List all issues for a repository
   */
  async listIssues(owner: string, repo: string, state: "open" | "closed" | "all" = "all"): Promise<GitHubIssue[]> {
    logger.debug(`Fetching ${state} issues from ${owner}/${repo}`);

    const allIssues: GitHubIssue[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const issues = await this.request<GitHubIssue[]>(
        "GET",
        `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&page=${page}`,
      );

      // Filter out pull requests (they appear in the issues endpoint)
      const onlyIssues = issues.filter(issue => !("pull_request" in issue));
      allIssues.push(...onlyIssues);

      if (issues.length < perPage) {
        break;
      }
      page++;
    }

    logger.info(`Fetched ${allIssues.length} issues from ${owner}/${repo}`);
    return allIssues;
  }

  /**
   * Get a single issue
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    logger.debug(`Fetching issue ${owner}/${repo}#${issueNumber}`);
    return await this.request<GitHubIssue>(
      "GET",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
    );
  }

  /**
   * Create a new issue
   */
  async createIssue(
    owner: string,
    repo: string,
    data: CreateIssueRequest,
  ): Promise<GitHubIssue> {
    logger.info(`Creating issue in ${owner}/${repo}`, { title: data.title });
    return await this.request<GitHubIssue>(
      "POST",
      `/repos/${owner}/${repo}/issues`,
      data,
    );
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    data: UpdateIssueRequest,
  ): Promise<GitHubIssue> {
    logger.info(`Updating issue ${owner}/${repo}#${issueNumber}`, { updates: Object.keys(data) });
    return await this.request<GitHubIssue>(
      "PATCH",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      data,
    );
  }
}
