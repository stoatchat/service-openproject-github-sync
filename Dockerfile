# Build stage
FROM denoland/deno:latest AS builder
WORKDIR /app
COPY . .
RUN deno cache main.ts

# Production stage
FROM denoland/deno:latest
WORKDIR /app
COPY --from=builder /app .
CMD ["deno", "run", "--allow-read=.env", "--allow-net", "--allow-env=GH_TOKEN,OP_TOKEN,OP_URL,SECRET_TOKEN,REPO_PROJECT_MAP,ASSIGNEE_MAP,OP_GITHUB_ISSUE_FIELD", "main.ts"]
EXPOSE 8000
