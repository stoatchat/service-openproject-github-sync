# Configuration Guide

I've created a `.env` file for you with the tokens you provided, but there are a few values that need to be filled in. The OpenProject API is returning "Access denied" from this environment, so you'll need to find these values directly.

## Values to Find

### 1. Backend Project ID

**Current placeholder:** `BACKEND_PROJECT_ID` in `REPO_PROJECT_MAP`

**How to find it:**

**Option A - Via Web UI:**
1. Go to https://op.stoatinternal.com/projects/backend
2. Click on "Project settings" (gear icon)
3. The project ID should be visible in the settings page

**Option B - Via API (from your local machine):**
```bash
curl -H "Authorization: Basic $(echo -n 'apikey:74b417798ae1a1c038cf9cd3677cd1d5a44568c477f4d1b998c4d1eb03016d5f' | base64)" \
  https://op.stoatinternal.com/api/v3/projects/backend | jq '.id'
```

**Option C - From any work package URL:**
1. Open any work package in the backend project
2. Look at the API link in the page
3. The project reference will be there

**Expected value:** An integer like `8` or `42`

**Update in .env:**
```bash
REPO_PROJECT_MAP=stoatchat/stoatchat:8  # Replace 8 with actual ID
```

---

### 2. Type IDs (for TYPE_MAP)

**Current placeholder:** `FIND_ME` for Bug, Task, Feature

**How to find them:**

**Option A - Via browser console:**
1. Open https://op.stoatinternal.com in your browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Run:
```javascript
fetch('/api/v3/types', {
  headers: {
    'Authorization': 'Basic ' + btoa('apikey:74b417798ae1a1c038cf9cd3677cd1d5a44568c477f4d1b998c4d1eb03016d5f')
  }
})
.then(r => r.json())
.then(data => {
  data._embedded.elements.forEach(t => console.log(t.id + ': ' + t.name));
});
```

**Option B - Via API from your machine:**
```bash
curl -H "Authorization: Basic $(echo -n 'apikey:74b417798ae1a1c038cf9cd3677cd1d5a44568c477f4d1b998c4d1eb03016d5f' | base64)" \
  https://op.stoatinternal.com/api/v3/types | jq '._embedded.elements[] | "\(.id): \(.name)"'
```

**Expected output:**
```
1: Task
2: Bug
3: Feature
...
```

**Update in .env:**
```bash
TYPE_MAP=Bug:2,Task:1,Feature:3  # Use actual IDs from your OpenProject
```

---

### 3. Custom Field ID (OP_GITHUB_ISSUE_FIELD)

**Current placeholder:** `FIND_ME`

**How to find it:**

**Option A - Via Administration:**
1. Go to OpenProject → Administration (top right menu)
2. Click "Custom fields" in the left sidebar
3. Find the "GitHub Issue" field (should be an Integer field)
4. Note the ID shown in the list

**Option B - Via browser console on a work package:**
1. Open any work package: https://op.stoatinternal.com/work_packages/1
2. Open Developer Tools → Console
3. Run:
```javascript
fetch('/api/v3/work_packages/1', {
  headers: {
    'Authorization': 'Basic ' + btoa('apikey:74b417798ae1a1c038cf9cd3677cd1d5a44568c477f4d1b998c4d1eb03016d5f')
  }
})
.then(r => r.json())
.then(data => {
  Object.keys(data).filter(k => k.startsWith('customField')).forEach(k => {
    console.log(k + ': ' + data[k]);
  });
});
```

**Expected output:**
```
customField42: null
customField43: 123
...
```

Look for the field that's used for GitHub issue numbers (it will be the "GitHub Issue" field you created).

**Update in .env:**
```bash
OP_GITHUB_ISSUE_FIELD=customField42  # Use actual field ID
```

---

### 4. User IDs (for ASSIGNEE_MAP) - Optional

**How to find them:**

**Option A - Via Administration:**
1. Go to OpenProject → Administration → Users
2. Click on a user
3. The ID is in the URL: `/users/42` means user ID is 42

**Option B - Via API:**
```bash
curl -H "Authorization: Basic $(echo -n 'apikey:74b417798ae1a1c038cf9cd3677cd1d5a44568c477f4d1b998c4d1eb03016d5f' | base64)" \
  https://op.stoatinternal.com/api/v3/users | jq '._embedded.elements[] | "\(.id): \(.login) (\(.name))"'
```

**Update in .env:**
```bash
ASSIGNEE_MAP=insertish:42,other_github_user:43
```

---

### 5. SECRET_TOKEN

**Current value:** `CHANGE_ME_GENERATE_RANDOM_TOKEN`

Generate a secure random token:

```bash
# On Linux/Mac:
openssl rand -hex 32

# Or use this online: https://www.random.org/strings/
```

**Update in .env:**
```bash
SECRET_TOKEN=your_generated_random_token_here
```

---

## After Configuration

Once you've filled in all the values, your `.env` should look like:

```bash
GH_TOKEN=github_pat_...
OP_TOKEN=74b417798...
OP_URL=https://op.stoatinternal.com
SECRET_TOKEN=a1b2c3d4e5f6...
REPO_PROJECT_MAP=stoatchat/stoatchat:8
ASSIGNEE_MAP=insertish:42
TYPE_MAP=Bug:2,Task:1,Feature:3
OP_GITHUB_ISSUE_FIELD=customField42
```

Then you can start the service:

```bash
deno task start
```

## Webhook URLs

After the service is running, configure webhooks:

**GitHub webhook:**
```
URL: https://your-domain.com/webhook/YOUR_SECRET_TOKEN/github
Content type: application/json
Events: Issues
```

**OpenProject webhook:**
```
URL: https://your-domain.com/webhook/YOUR_SECRET_TOKEN/openproject
Events: Work package created, Work package updated
```

## Troubleshooting

If you get "Access denied" from OpenProject API even from your local machine:
1. Check that the API token has the correct permissions in OpenProject
2. Make sure you're using an admin account or have project access
3. Try regenerating the API token in your OpenProject user settings
