/**
 * OpenProject-GitHub Two-Way Sync Service
 * Entry point
 */

import { loadConfig } from "./src/config.ts";
import { GitHubClient } from "./src/clients/github.ts";
import { OpenProjectClient } from "./src/clients/openproject.ts";
import { startServer } from "./src/server.ts";
import { performReconciliationSync } from "./src/sync/reconcile.ts";
import { initializeStatusMapping } from "./src/mappers/status.ts";
import * as logger from "./src/utils/logger.ts";

async function main() {
  try {
    logger.info("Starting OpenProject-GitHub sync service...");

    // Load configuration
    const config = await loadConfig();

    // Initialize API clients
    const ghClient = new GitHubClient(config.githubToken);
    const opClient = new OpenProjectClient(config.opUrl, config.opToken);

    // Initialize status mapping (fetch statuses from OpenProject)
    logger.info("Initializing status mapping...");
    await initializeStatusMapping(opClient);

    // Perform startup reconciliation sync
    logger.info("Performing startup reconciliation sync...");
    await performReconciliationSync(config, ghClient, opClient);

    // Start HTTP server
    logger.info("Starting HTTP server...");
    await startServer(config);
  } catch (error) {
    logger.error("Fatal error during startup", { error: String(error) });
    Deno.exit(1);
  }
}

// Run the main function
main();
