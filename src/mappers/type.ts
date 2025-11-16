/**
 * Type mapping between GitHub issue types and OpenProject types
 */

import type { OPType } from "../types/openproject.ts";
import type { Config } from "../config.ts";
import { OpenProjectClient } from "../clients/openproject.ts";
import * as logger from "../utils/logger.ts";

/**
 * Type mapping cache to avoid repeated API calls
 */
let typeCache: OPType[] | null = null;

/**
 * Initialize type cache by fetching from OpenProject
 */
export async function initializeTypeMapping(client: OpenProjectClient): Promise<void> {
  if (!typeCache) {
    typeCache = await client.getTypes();
    logger.info("Type mapping initialized", {
      types: typeCache.map(t => ({ id: t.id, name: t.name })),
    });
  }
}

/**
 * Get OpenProject type ID by name
 */
function getTypeIdByName(name: string): number | null {
  if (!typeCache) {
    logger.error("Type cache not initialized");
    return null;
  }

  const type = typeCache.find(t => t.name.toLowerCase() === name.toLowerCase());
  return type ? type.id : null;
}

/**
 * Map GitHub issue type to OpenProject type ID
 * Uses configured mapping or tries to find by name match
 */
export function mapGitHubTypeToOPType(
  githubType: string | null,
  config: Config,
): number | null {
  if (!githubType) {
    return null;
  }

  // First check if there's a configured mapping
  const mappedTypeId = config.typeMap.get(githubType);
  if (mappedTypeId !== undefined) {
    return mappedTypeId;
  }

  // Fall back to trying to find by name match
  const typeId = getTypeIdByName(githubType);
  if (typeId) {
    logger.debug(`Found type by name match: ${githubType} -> ${typeId}`);
    return typeId;
  }

  logger.debug(`No type mapping found for GitHub type: ${githubType}`);
  return null;
}

/**
 * Map OpenProject type to GitHub issue type
 * Uses reverse lookup in configured mapping or type name
 */
export function mapOPTypeToGitHubType(
  opTypeId: number,
  config: Config,
): string | null {
  // Reverse lookup in the type map
  for (const [ghType, opId] of config.typeMap.entries()) {
    if (opId === opTypeId) {
      return ghType;
    }
  }

  // Fall back to using the OpenProject type name
  const typeName = getTypeNameFromCache(opTypeId);
  if (typeName) {
    logger.debug(`Using OP type name as GitHub type: ${typeName}`);
    return typeName;
  }

  logger.debug(`No type mapping found for OpenProject type ID: ${opTypeId}`);
  return null;
}

/**
 * Get type href for OpenProject API
 */
export function getTypeHref(typeId: number): string {
  return `/api/v3/types/${typeId}`;
}

/**
 * Get type name from type cache
 */
export function getTypeNameFromCache(typeId: number): string | null {
  if (!typeCache) {
    return null;
  }

  const type = typeCache.find(t => t.id === typeId);
  return type ? type.name : null;
}

/**
 * Extract type ID from OpenProject type link href
 */
export function extractTypeIdFromHref(href: string): number | null {
  const match = href.match(/\/api\/v3\/types\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
