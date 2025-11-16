# Quick Configuration Setup

## Option 1: Browser Console (Easiest)

1. Open https://op.stoatinternal.com in your browser
2. Log in to OpenProject
3. Open Developer Tools (F12) → Console tab
4. Copy and paste the entire contents of `find-op-config.js` into the console
5. Press Enter

The script will automatically find and display all the values you need for your `.env` file.

## Option 2: Manual API Testing

If the script doesn't work, the token might need different permissions. Try this:

### Test the token first:

```bash
# From your local machine (not the service environment):
curl -v -H "Authorization: Basic $(echo -n 'apikey:YOUR_OPENPROJECT_TOKEN' | base64)" \
  https://op.stoatinternal.com/api/v3/projects
```

**Expected:** JSON response with projects
**If 401:** Token is invalid or expired - regenerate it

### Regenerate the API Token:

1. Go to https://op.stoatinternal.com/my/access_token
2. Click "Generate API token" or regenerate existing one
3. Copy the new token
4. Update `.env` with the new `OP_TOKEN`

### Find Project ID:

**Method A - From URL:**
1. Go to https://op.stoatinternal.com/projects/backend
2. Click any work package
3. The project ID is in the breadcrumb or API responses

**Method B - From API:**
```bash
curl -H "Authorization: Basic $(echo -n 'apikey:YOUR_NEW_TOKEN' | base64)" \
  https://op.stoatinternal.com/api/v3/projects/backend | jq '.id'
```

### Find Type IDs:

```bash
curl -H "Authorization: Basic $(echo -n 'apikey:YOUR_TOKEN' | base64)" \
  https://op.stoatinternal.com/api/v3/types | \
  jq '._embedded.elements[] | "\(.id): \(.name)"'
```

### Find Custom Field ID:

```bash
curl -H "Authorization: Basic $(echo -n 'apikey:YOUR_TOKEN' | base64)" \
  https://op.stoatinternal.com/api/v3/work_packages/1 | \
  jq 'keys | map(select(startswith("customField")))'
```

Look for the "GitHub Issue" field - it should be an integer field.

## Common Issues

### 401 Unauthenticated

**Cause:** Token is invalid, expired, or has wrong format
**Fix:** Regenerate the API token in OpenProject user settings

### 403 Forbidden

**Cause:** Token is valid but lacks permissions
**Fix:** Make sure the token has API access enabled

### Network/CORS Errors

**Cause:** Browser security restrictions
**Fix:** Use curl from command line instead of browser console

## Once You Have All Values

Update your `.env` file:

```bash
GH_TOKEN=your_github_token_here
OP_TOKEN=your_openproject_token_here
OP_URL=https://op.stoatinternal.com
SECRET_TOKEN=generate_random_secret_here
REPO_PROJECT_MAP=stoatchat/stoatchat:8
ASSIGNEE_MAP=insertish:42
TYPE_MAP=Bug:1,Task:2,Feature:3
OP_GITHUB_ISSUE_FIELD=customField42
```

Then start the service:

```bash
deno task start
```
