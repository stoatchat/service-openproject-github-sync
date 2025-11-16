# OpenProject-GitHub Two-Way Sync Service

## Project Overview

A Deno-based webhook service that maintains bidirectional synchronization between OpenProject work packages and GitHub repository issues. The service ensures both platforms stay in sync for title, description, assignee, and status fields.

## Architecture

### Service Type
- **Event-driven webhook receiver** (not polling)
- Listens for webhooks from both GitHub and OpenProject
- Performs full reconciliation sync on startup
- Runs as a persistent HTTP server

### Technology Stack
- **Runtime**: Deno (TypeScript)
- **HTTP Server**: Deno's native HTTP server
- **APIs**: GitHub REST API v3, OpenProject API v3
- **Environment**: Docker-ready, configurable via environment variables

## Data Flow

```
GitHub Issue ←→ Sync Service ←→ OpenProject Work Package
     ↓                                      ↓
  Webhook                              Webhook
     ↓                                      ↓
  HTTP Server (this service)
     ↓
  Sync Logic
     ↓
  API Calls to update both sides
```

## Field Mapping

### Synced Fields

| Field | GitHub | OpenProject | Notes |
|-------|--------|-------------|-------|
| Title | `title` | `subject` | GitHub prefixed with `[OP#<id>]` |
| Description | `body` | `description.raw` | Plain text/markdown |
| Assignee | `assignee.login` | `assignee` (user ID) | Mapped via config |
| Status | `state` (open/closed) | `status` | See status mapping below |

### Status Mapping

**GitHub → OpenProject:**
- `open` → `new` (status ID to be determined from OP API)
- `closed` → `closed` (status ID to be determined from OP API)

**OpenProject → GitHub:**
- `new`, `in specification`, `specified`, `developed`, `in testing`, `tested`, `test failed`, `on hold` → `open`
- `closed`, `rejected` → `closed`

### Assignee Mapping

Configured via environment variable as comma-separated pairs:

```
ASSIGNEE_MAP=github_user1:op_user_id1,github_user2:op_user_id2
```

Example:
```
ASSIGNEE_MAP=johndoe:42,janedoe:123
```

If no mapping exists, the assignee field is not synced for that user.

## Linking Strategy

### OpenProject → GitHub
- Use custom field "GitHub Issue" (integer field) to store GitHub issue number
- Field stores the issue number only (e.g., `123` for issue #123)

### GitHub → OpenProject
- Prefix issue title with `[OP#<id>]` (e.g., `[OP#456] Fix login bug`)
- Parse this prefix to identify linked work packages

### Detecting Links
1. For OP work packages: Check if "GitHub Issue" field is populated
2. For GitHub issues: Check if title starts with `[OP#\d+]` pattern

## Webhook Endpoints

### Authentication
Simple token-based auth using URL path parameter:

```
POST /webhook/:token/github
POST /webhook/:token/openproject
```

The `:token` must match `SECRET_TOKEN` environment variable.

### GitHub Webhook
- **Events to subscribe**: `issues` (opened, edited, closed, reopened, assigned, unassigned)
- **Payload**: Standard GitHub issue webhook payload

### OpenProject Webhook
- **Events to subscribe**: Work package created, updated
- **Payload**: OpenProject webhook payload with work package data

## Startup Behavior

On service startup, perform full reconciliation sync:

1. **Fetch all issues/work packages** for configured repo/project pairs
2. **Identify unlinked items**:
   - GitHub issues without `[OP#]` prefix
   - OP work packages without "GitHub Issue" field populated
3. **Create corresponding items**:
   - For unlinked GitHub issues → Create OP work package
   - For unlinked OP work packages → Create GitHub issue
4. **Do NOT attempt to match** existing items (always create new counterparts)

## Conflict Resolution

**Last-write-wins strategy:**
- Compare timestamps from both systems
- Apply the most recent change
- Timestamps to compare:
  - GitHub: `issue.updated_at`
  - OpenProject: `work_package.updatedAt`

## Configuration

### Environment Variables

```bash
# Authentication tokens
GH_TOKEN=<github_pat>              # GitHub Personal Access Token
OP_TOKEN=<openproject_api_key>     # OpenProject API Key
SECRET_TOKEN=<webhook_secret>       # Webhook URL authentication

# Service URLs
OP_URL=https://op.stoatinternal.com  # OpenProject instance URL

# Repository to Project mapping (comma-separated)
REPO_PROJECT_MAP=stoatchat/for-web:8,stoatchat/my-repo:999

# User mapping (optional, comma-separated github_user:op_user_id pairs)
ASSIGNEE_MAP=johndoe:42,janedoe:123

# OpenProject custom field ID for "GitHub Issue" field
OP_GITHUB_ISSUE_FIELD=customField123
```

### Multiple Repository Support

The `REPO_PROJECT_MAP` format:
```
owner/repo:project_id,owner/repo2:project_id2
```

Each mapping creates a bidirectional sync between that GitHub repository and OpenProject project.

## Error Handling

### Strategy
- **Log all errors** to stdout/stderr with context
- **Do not retry** webhook processing (webhooks can be re-delivered)
- **Continue processing** other items if one fails
- **Return HTTP 500** if webhook processing fails entirely

### Error Logging Format
```
[ERROR] [timestamp] [source] Message
  Context: {additional context as JSON}
```

## API Interactions

### GitHub API
- **Authentication**: Bearer token (`Authorization: Bearer ${GH_TOKEN}`)
- **Endpoints used**:
  - `GET /repos/:owner/:repo/issues` - List issues
  - `GET /repos/:owner/:repo/issues/:number` - Get issue
  - `POST /repos/:owner/:repo/issues` - Create issue
  - `PATCH /repos/:owner/:repo/issues/:number` - Update issue

### OpenProject API
- **Authentication**: Basic auth (`Authorization: Basic ${btoa('apikey:' + OP_TOKEN)}`)
- **Endpoints used**:
  - `GET /api/v3/projects/:id/work_packages` - List work packages
  - `GET /api/v3/work_packages/:id` - Get work package
  - `POST /api/v3/projects/:id/work_packages` - Create work package
  - `PATCH /api/v3/work_packages/:id` - Update work package
  - `GET /api/v3/statuses` - Get available statuses
  - `GET /api/v3/projects/:id/available_assignees` - Get assignees

### Rate Limiting
- Implement basic rate limit handling (retry with exponential backoff if 429 received)
- GitHub: 5000 requests/hour for authenticated requests
- OpenProject: Check response headers for limits

## Implementation Phases

### Phase 1: Core Infrastructure
1. Set up Deno HTTP server with webhook endpoints
2. Environment configuration loading
3. Webhook authentication middleware
4. Basic logging infrastructure

### Phase 2: API Client Layer
1. GitHub API client with authentication
2. OpenProject API client with authentication
3. Type definitions for both APIs
4. Error handling for API calls

### Phase 3: Data Mapping
1. Status mapping logic (with OP status ID lookup on startup)
2. Assignee mapping logic
3. Title formatting (add/remove `[OP#]` prefix)
4. Link detection utilities

### Phase 4: Sync Logic
1. GitHub → OpenProject sync function
2. OpenProject → GitHub sync function
3. Conflict resolution (timestamp comparison)
4. Create missing items on both sides

### Phase 5: Webhook Handlers
1. GitHub webhook parser and handler
2. OpenProject webhook parser and handler
3. Event filtering (only process relevant events)

### Phase 6: Startup Sync
1. Fetch all issues/work packages for configured mappings
2. Identify unlinked items
3. Create corresponding items on both sides
4. Link newly created items

### Phase 7: Testing & Deployment
1. Manual testing with real GitHub/OP instances
2. Docker build and deployment
3. Webhook registration on both platforms
4. Monitoring and logging verification

## File Structure

```
/
├── main.ts                 # Entry point, HTTP server setup
├── src/
│   ├── config.ts          # Environment configuration parsing
│   ├── server.ts          # HTTP server and routing
│   ├── middleware/
│   │   └── auth.ts        # Webhook authentication
│   ├── clients/
│   │   ├── github.ts      # GitHub API client
│   │   └── openproject.ts # OpenProject API client
│   ├── types/
│   │   ├── github.ts      # GitHub type definitions
│   │   └── openproject.ts # OpenProject type definitions
│   ├── mappers/
│   │   ├── status.ts      # Status mapping logic
│   │   ├── assignee.ts    # Assignee mapping logic
│   │   └── link.ts        # Link detection/formatting
│   ├── sync/
│   │   ├── github-to-op.ts   # GitHub → OP sync
│   │   ├── op-to-github.ts   # OP → GitHub sync
│   │   └── reconcile.ts      # Startup reconciliation
│   ├── handlers/
│   │   ├── github-webhook.ts    # GitHub webhook handler
│   │   └── openproject-webhook.ts # OP webhook handler
│   └── utils/
│       ├── logger.ts      # Logging utilities
│       └── errors.ts      # Error definitions
├── deno.json              # Deno configuration
├── deno.lock             # Dependency lock file
├── .env.example          # Example environment file
├── Dockerfile            # Docker build configuration
├── CLAUDE.md             # This file
└── README.md             # User documentation
```

## TypeScript Type Definitions

### Core Types

```typescript
// Configuration
interface Config {
  githubToken: string;
  opToken: string;
  opUrl: string;
  secretToken: string;
  repoProjectMap: Map<string, number>; // "owner/repo" -> project_id
  assigneeMap: Map<string, number>;    // github_username -> op_user_id
  opGithubIssueField: string;          // Custom field ID
}

// Link information
interface LinkedPair {
  githubRepo: string;
  githubIssueNumber: number;
  opProjectId: number;
  opWorkPackageId: number;
}

// Sync direction
type SyncDirection = 'github-to-op' | 'op-to-github';
```

## Success Criteria

The service is considered complete when:

1. ✅ Webhooks from GitHub update OpenProject work packages
2. ✅ Webhooks from OpenProject update GitHub issues
3. ✅ All specified fields (title, description, assignee, status) sync correctly
4. ✅ Status mapping works according to specification
5. ✅ Assignee mapping works (with graceful handling of missing mappings)
6. ✅ Links are maintained via custom field and title prefix
7. ✅ Startup sync creates missing items on both sides
8. ✅ Conflicts are resolved using last-write-wins
9. ✅ Service runs reliably in Docker
10. ✅ Errors are logged appropriately

## Open Questions / Future Enhancements

- **Deletion handling**: What happens when an issue/work package is deleted?
- **Comment sync**: May be valuable in future
- **Label/tag sync**: Could enhance categorization
- **Bidirectional search**: Web UI to search linked items
- **Metrics/monitoring**: Track sync success rates
- **Database**: Consider storing sync state for better conflict resolution
