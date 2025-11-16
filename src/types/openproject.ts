/**
 * OpenProject API type definitions
 */

export interface OPLink {
  href: string;
  title?: string;
}

export interface OPLinks {
  self: OPLink;
  [key: string]: OPLink | undefined;
}

export interface OPUser {
  _type: "User";
  id: number;
  name: string;
  _links: OPLinks;
}

export interface OPStatus {
  _type: "Status";
  id: number;
  name: string;
  _links: OPLinks;
}

export interface OPDescription {
  format: "markdown" | "textile" | "plain";
  raw: string;
  html?: string;
}

export interface OPCustomField {
  [key: string]: unknown;
}

export interface OPWorkPackage {
  _type: "WorkPackage";
  id: number;
  lockVersion: number;
  subject: string;
  description: OPDescription;
  createdAt: string;
  updatedAt: string;
  _links: {
    self: OPLink;
    status: OPLink;
    assignee?: OPLink;
    project: OPLink;
    type: OPLink;
    [key: string]: OPLink | undefined;
  };
  // Custom fields are dynamic
  [key: string]: unknown;
}

export interface OPWorkPackageCollection {
  _type: "Collection";
  total: number;
  count: number;
  pageSize: number;
  offset: number;
  _embedded: {
    elements: OPWorkPackage[];
  };
}

export interface OPStatusCollection {
  _type: "Collection";
  _embedded: {
    elements: OPStatus[];
  };
}

export interface CreateWorkPackageRequest {
  subject: string;
  description?: {
    raw: string;
  };
  _links: {
    type: {
      href: string;
    };
    status?: {
      href: string;
    };
    assignee?: {
      href: string;
    };
  };
  [key: string]: unknown; // For custom fields
}

export interface UpdateWorkPackageRequest {
  lockVersion: number;
  subject?: string;
  description?: {
    raw: string;
  };
  _links?: {
    status?: {
      href: string;
    };
    assignee?: {
      href: string | null;
    };
  };
  [key: string]: unknown; // For custom fields
}

export interface OPWebhookPayload {
  action: "work_package:created" | "work_package:updated";
  work_package: {
    id: number;
    _links: {
      self: {
        href: string;
      };
    };
  };
}

export interface OPErrorResponse {
  _type: "Error";
  errorIdentifier: string;
  message: string;
}
