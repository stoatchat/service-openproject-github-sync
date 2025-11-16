/**
 * Custom error definitions for the sync service
 */

export class SyncError extends Error {
  constructor(message: string, public context?: Record<string, unknown>) {
    super(message);
    this.name = "SyncError";
  }
}

export class GitHubAPIError extends SyncError {
  constructor(message: string, public statusCode?: number, context?: Record<string, unknown>) {
    super(message, context);
    this.name = "GitHubAPIError";
  }
}

export class OpenProjectAPIError extends SyncError {
  constructor(message: string, public statusCode?: number, context?: Record<string, unknown>) {
    super(message, context);
    this.name = "OpenProjectAPIError";
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}
