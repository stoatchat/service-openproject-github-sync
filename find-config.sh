#!/bin/bash

# OpenProject Configuration Finder
# Run this script on your LOCAL machine (not the service environment)

set -e

OP_TOKEN="YOUR_OPENPROJECT_TOKEN_HERE"
OP_URL="https://op.stoatinternal.com"
AUTH_HEADER="Authorization: Basic $(echo -n "apikey:${OP_TOKEN}" | base64)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OpenProject Configuration Finder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test authentication
echo "1. Testing API Token..."
if ! curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/projects" > /dev/null 2>&1; then
    echo "❌ Token authentication failed!"
    echo "Please check that the token is valid and has API access."
    exit 1
fi
echo "✅ Token is valid!"
echo ""

# Find backend project
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Finding Backend Project ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PROJECT_INFO=$(curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/projects/backend")
PROJECT_ID=$(echo "$PROJECT_INFO" | jq -r '.id')
PROJECT_NAME=$(echo "$PROJECT_INFO" | jq -r '.name')
echo "✅ Project ID: $PROJECT_ID"
echo "   Name: $PROJECT_NAME"
echo ""
echo "📝 REPO_PROJECT_MAP=stoatchat/stoatchat:$PROJECT_ID"
echo ""

# Find types
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Finding Work Package Types"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TYPES=$(curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/types")
echo "✅ Available Types:"
echo "$TYPES" | jq -r '._embedded.elements[] | "   \(.id): \(.name)"'
echo ""

# Build TYPE_MAP
BUG_ID=$(echo "$TYPES" | jq -r '._embedded.elements[] | select(.name | ascii_downcase == "bug") | .id' | head -1)
TASK_ID=$(echo "$TYPES" | jq -r '._embedded.elements[] | select(.name | ascii_downcase == "task") | .id' | head -1)
FEATURE_ID=$(echo "$TYPES" | jq -r '._embedded.elements[] | select(.name | ascii_downcase == "feature") | .id' | head -1)

TYPE_MAP=""
[[ -n "$BUG_ID" ]] && TYPE_MAP="${TYPE_MAP}Bug:${BUG_ID},"
[[ -n "$TASK_ID" ]] && TYPE_MAP="${TYPE_MAP}Task:${TASK_ID},"
[[ -n "$FEATURE_ID" ]] && TYPE_MAP="${TYPE_MAP}Feature:${FEATURE_ID},"
TYPE_MAP=${TYPE_MAP%,}  # Remove trailing comma

echo "📝 TYPE_MAP=$TYPE_MAP"
echo ""

# Find custom fields
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Finding Custom Fields"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get a work package to inspect custom fields
WP=$(curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/work_packages?pageSize=1")
if echo "$WP" | jq -e '._embedded.elements[0]' > /dev/null 2>&1; then
    echo "✅ Found custom fields:"
    CUSTOM_FIELDS=$(echo "$WP" | jq -r '._embedded.elements[0] | keys[] | select(startswith("customField"))')

    if [ -n "$CUSTOM_FIELDS" ]; then
        echo "$CUSTOM_FIELDS" | while read -r field; do
            VALUE=$(echo "$WP" | jq -r "._embedded.elements[0].${field}")
            echo "   $field: $VALUE"
        done
        echo ""
        echo "📝 Look for the 'GitHub Issue' field above"
        echo "   (It should be an integer field, likely null or containing a GitHub issue number)"
        echo ""

        # Try to guess which one
        FIRST_FIELD=$(echo "$CUSTOM_FIELDS" | head -1)
        echo "   If unsure, try: OP_GITHUB_ISSUE_FIELD=$FIRST_FIELD"
    else
        echo "⚠️  No custom fields found"
        echo "   You'll need to create a 'GitHub Issue' integer custom field in OpenProject"
    fi
else
    echo "⚠️  No work packages found to inspect"
    echo "   Create a work package first, or manually find the custom field ID"
fi
echo ""

# Find users
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Finding Users (for ASSIGNEE_MAP)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
USERS=$(curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/users")
echo "✅ Available Users (first 10):"
echo "$USERS" | jq -r '._embedded.elements[0:10][] | "   \(.id): \(.login) (\(.firstName) \(.lastName))"'
echo ""
echo "📝 Map GitHub usernames to these IDs"
echo "   Example: ASSIGNEE_MAP=insertish:42,githubuser:43"
echo ""

# Find statuses
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Finding Statuses"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STATUSES=$(curl -s -H "$AUTH_HEADER" "$OP_URL/api/v3/statuses")
echo "✅ Available Statuses:"
echo "$STATUSES" | jq -r '._embedded.elements[] | "   \(.id): \(.name)"'
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuration Discovery Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Update your .env file with these values:"
echo ""
echo "REPO_PROJECT_MAP=stoatchat/stoatchat:$PROJECT_ID"
echo "TYPE_MAP=$TYPE_MAP"
echo "OP_GITHUB_ISSUE_FIELD=(see custom fields above)"
echo "ASSIGNEE_MAP=(map your GitHub usernames to OpenProject user IDs above)"
echo ""
echo "Don't forget to generate a SECRET_TOKEN:"
echo "  openssl rand -hex 32"
echo ""
