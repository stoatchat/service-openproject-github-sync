/**
 * GitHub API type definitions
 */

export interface GitHubUser {
  login: string;
  id: number;
  type: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  type: string | null;
  assignee: GitHubUser | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubIssueWebhook {
  action: "opened" | "edited" | "closed" | "reopened" | "assigned" | "unassigned";
  issue: GitHubIssue;
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export interface CreateIssueRequest {
  title: string;
  body?: string;
  type?: string;
  assignee?: string;
  state?: "open" | "closed";
}

export interface UpdateIssueRequest {
  title?: string;
  body?: string;
  type?: string | null;
  assignee?: string | null;
  state?: "open" | "closed";
}
