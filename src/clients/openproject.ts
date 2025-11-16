/**
 * OpenProject API client
 */

import type {
  OPWorkPackage,
  OPWorkPackageCollection,
  OPStatusCollection,
  OPStatus,
  OPTypeCollection,
  OPType,
  CreateWorkPackageRequest,
  UpdateWorkPackageRequest,
  OPErrorResponse,
} from "../types/openproject.ts";
import { OpenProjectAPIError } from "../utils/errors.ts";
import * as logger from "../utils/logger.ts";

export class OpenProjectClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.token = token;
  }

  private getAuthHeader(): string {
    return "Basic " + btoa(`apikey:${this.token}`);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      "Authorization": this.getAuthHeader(),
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      // Check for OpenProject error response
      if (data._type === "Error") {
        const error = data as OPErrorResponse;
        throw new OpenProjectAPIError(
          `OpenProject API error: ${error.message}`,
          response.status,
          { url, errorIdentifier: error.errorIdentifier },
        );
      }

      if (!response.ok) {
        throw new OpenProjectAPIError(
          `OpenProject API error: ${response.status} ${response.statusText}`,
          response.status,
          { url, response: data },
        );
      }

      return data;
    } catch (error) {
      if (error instanceof OpenProjectAPIError) {
        throw error;
      }
      throw new OpenProjectAPIError(
        `Failed to make OpenProject API request: ${error}`,
        undefined,
        { url, error: String(error) },
      );
    }
  }

  /**
   * List all work packages for a project
   */
  async listWorkPackages(projectId: number): Promise<OPWorkPackage[]> {
    logger.debug(`Fetching work packages from project ${projectId}`);

    const allWorkPackages: OPWorkPackage[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const result = await this.request<OPWorkPackageCollection>(
        "GET",
        `/api/v3/projects/${projectId}/work_packages?offset=${offset}&pageSize=${pageSize}`,
      );

      allWorkPackages.push(...result._embedded.elements);

      if (result._embedded.elements.length < pageSize) {
        break;
      }
      offset += pageSize;
    }

    logger.info(`Fetched ${allWorkPackages.length} work packages from project ${projectId}`);
    return allWorkPackages;
  }

  /**
   * Get a single work package
   */
  async getWorkPackage(id: number): Promise<OPWorkPackage> {
    logger.debug(`Fetching work package ${id}`);
    return await this.request<OPWorkPackage>(
      "GET",
      `/api/v3/work_packages/${id}`,
    );
  }

  /**
   * Create a new work package
   */
  async createWorkPackage(
    projectId: number,
    data: CreateWorkPackageRequest,
  ): Promise<OPWorkPackage> {
    logger.info(`Creating work package in project ${projectId}`, { subject: data.subject });
    return await this.request<OPWorkPackage>(
      "POST",
      `/api/v3/projects/${projectId}/work_packages`,
      data,
    );
  }

  /**
   * Update an existing work package
   */
  async updateWorkPackage(
    id: number,
    data: UpdateWorkPackageRequest,
  ): Promise<OPWorkPackage> {
    logger.info(`Updating work package ${id}`, { updates: Object.keys(data) });
    return await this.request<OPWorkPackage>(
      "PATCH",
      `/api/v3/work_packages/${id}`,
      data,
    );
  }

  /**
   * Get all available statuses
   */
  async getStatuses(): Promise<OPStatus[]> {
    logger.debug("Fetching available statuses");
    const result = await this.request<OPStatusCollection>(
      "GET",
      "/api/v3/statuses",
    );
    logger.info(`Fetched ${result._embedded.elements.length} statuses`);
    return result._embedded.elements;
  }

  /**
   * Get all available types
   */
  async getTypes(): Promise<OPType[]> {
    logger.debug("Fetching available types");
    const result = await this.request<OPTypeCollection>(
      "GET",
      "/api/v3/types",
    );
    logger.info(`Fetched ${result._embedded.elements.length} types`);
    return result._embedded.elements;
  }

  /**
   * Get the default work package type for a project
   * This is needed when creating work packages
   */
  async getDefaultTypeHref(projectId: number): Promise<string> {
    // For now, we'll use a standard approach - typically type ID 1 is "Task"
    // This could be enhanced to fetch available types from the project
    return `/api/v3/types/1`;
  }
}
