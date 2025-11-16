# OpenProject-GitHub Two-Way Sync Service

A Deno-based webhook service that maintains bidirectional synchronization between OpenProject work packages and GitHub repository issues.

## Features

- **Two-way sync**: Changes in GitHub issues automatically update OpenProject work packages and vice versa
- **Webhook-driven**: Real-time synchronization using webhooks from both platforms
- **Startup reconciliation**: Automatically creates missing items on both sides when the service starts
- **Field mapping**: Syncs title, description, assignee, and status
- **Conflict resolution**: Last-write-wins strategy based on timestamps
- **Multiple repositories**: Support for syncing multiple GitHub repos to different OpenProject projects

## Synced Fields

| Field | GitHub | OpenProject |
|-------|--------|-------------|
| Title | `title` | `subject` (with `[OP#<id>]` prefix on GitHub) |
| Description | `body` | `description.raw` |
| Type | `type` | `type` (Bug, Task, Feature, etc - mapped via config) |
| Assignee | `assignee.login` | `assignee` (mapped via config) |
| Status | `state` (open/closed) | `status` (see mapping below) |

## Status Mapping

**GitHub → OpenProject:**
- `open` → `new`
- `closed` → `closed`

**OpenProject → GitHub:**
- `new`, `in specification`, `specified`, `developed`, `in testing`, `tested`, `test failed`, `on hold` → `open`
- `closed`, `rejected` → `closed`

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# GitHub Personal Access Token (requires repo scope)
GH_TOKEN=ghp_xxxxxxxxxxxxx

# OpenProject API Token
OP_TOKEN=your_op_api_token

# OpenProject instance URL
OP_URL=https://op.stoatinternal.com

# Secret token for webhook authentication
SECRET_TOKEN=your_secret_token_here

# Repository to Project mapping
REPO_PROJECT_MAP=stoatchat/for-web:8,stoatchat/another-repo:99

# Assignee mapping (optional)
ASSIGNEE_MAP=githubuser1:42,githubuser2:123

# Type mapping (optional - maps GitHub issue types to OpenProject type IDs)
TYPE_MAP=Bug:1,Task:2,Feature:3

# OpenProject custom field ID for "GitHub Issue"
OP_GITHUB_ISSUE_FIELD=customField123
```

### Finding OpenProject IDs

**Custom Field ID (`OP_GITHUB_ISSUE_FIELD`):**

The ID of the custom field in OpenProject that stores the GitHub issue number:
1. Go to OpenProject → Administration → Custom fields
2. Find the "GitHub Issue" field (should be an integer field)
3. The ID is in the URL or visible when inspecting work packages via API

**Type IDs for TYPE_MAP:**

To find OpenProject work package type IDs:
1. Make an API request: `curl -H "Authorization: Basic <token>" https://op.stoatinternal.com/api/v3/types`
2. Note the ID for each type (Bug, Task, Feature, etc.)
3. Map GitHub issue type names to these IDs in `TYPE_MAP`

Example: If OpenProject shows Bug=1, Task=2, Feature=3, use:
```bash
TYPE_MAP=Bug:1,Task:2,Feature:3
```

## Running the Service

### Development

```bash
deno task start
```

Or with watch mode:

```bash
deno task watch
```

### Production (Docker)

```bash
docker build -t openproject-github-sync .
docker run -d \
  -p 8000:8000 \
  -e GH_TOKEN=your_github_token \
  -e OP_TOKEN=your_op_token \
  -e OP_URL=https://op.stoatinternal.com \
  -e SECRET_TOKEN=your_secret \
  -e REPO_PROJECT_MAP=stoatchat/for-web:8 \
  -e ASSIGNEE_MAP=user1:42 \
  -e TYPE_MAP=Bug:1,Task:2,Feature:3 \
  -e OP_GITHUB_ISSUE_FIELD=customField123 \
  openproject-github-sync
```

## Webhook Setup

### GitHub Webhooks

For each repository you want to sync:

1. Go to repository Settings → Webhooks → Add webhook
2. Set Payload URL to: `https://your-domain.com/webhook/YOUR_SECRET_TOKEN/github`
3. Set Content type to: `application/json`
4. Select individual events: **Issues**
5. Save the webhook

### OpenProject Webhooks

For each project you want to sync:

1. Go to project Settings → Webhooks → New webhook
2. Set URL to: `https://your-domain.com/webhook/YOUR_SECRET_TOKEN/openproject`
3. Select events: **Work package created**, **Work package updated**
4. Save the webhook

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /webhook/:token/github` - GitHub webhook receiver
- `POST /webhook/:token/openproject` - OpenProject webhook receiver

## How It Works

### Startup Behavior

When the service starts, it performs a full reconciliation:

1. Fetches all issues from configured GitHub repositories
2. Fetches all work packages from configured OpenProject projects
3. Creates OpenProject work packages for any GitHub issues without an `[OP#]` prefix
4. Creates GitHub issues for any OpenProject work packages without a GitHub issue number
5. Links newly created items by updating titles and custom fields

### Webhook Processing

**GitHub → OpenProject:**
1. Receive webhook for issue event (opened, edited, closed, assigned, etc.)
2. Check if issue has `[OP#123]` prefix in title
3. If yes: Update existing work package #123
4. If no: Create new work package and add prefix to GitHub issue title
5. Sync title, description, type, assignee, and status

**OpenProject → GitHub:**
1. Receive webhook for work package event (created, updated)
2. Check if work package has GitHub issue number in custom field
3. If yes: Update existing GitHub issue
4. If no: Create new GitHub issue and store issue number in work package
5. Sync title (with `[OP#]` prefix), description, type, assignee, and status

### Conflict Resolution

Uses last-write-wins strategy:
- Compares `updated_at` timestamp from GitHub with `updatedAt` from OpenProject
- Only applies changes if the source is newer than the target
- Prevents ping-pong updates

## Development

### Project Structure

```
/
├── main.ts                 # Entry point
├── src/
│   ├── config.ts          # Configuration loading
│   ├── server.ts          # HTTP server
│   ├── middleware/
│   │   └── auth.ts        # Webhook authentication
│   ├── clients/
│   │   ├── github.ts      # GitHub API client
│   │   └── openproject.ts # OpenProject API client
│   ├── types/
│   │   ├── github.ts      # GitHub types
│   │   └── openproject.ts # OpenProject types
│   ├── mappers/
│   │   ├── status.ts      # Status mapping
│   │   ├── assignee.ts    # Assignee mapping
│   │   └── link.ts        # Link detection
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
└── CLAUDE.md             # Detailed project specification
```

## Troubleshooting

### Issues not syncing

1. Check webhook delivery in GitHub/OpenProject settings
2. Check service logs for errors
3. Verify `REPO_PROJECT_MAP` is correct
4. Verify custom field ID is correct

### Assignees not syncing

1. Check `ASSIGNEE_MAP` configuration
2. Verify GitHub usernames and OpenProject user IDs are correct
3. Note: If no mapping exists, assignee field is skipped (not an error)

### Status not syncing

1. Check that OpenProject has "new" and "closed" statuses
2. Check service logs for status mapping initialization
3. Verify OpenProject status names match expected values

## License

MIT
