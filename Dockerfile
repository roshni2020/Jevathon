# Guardian MCP — one image that runs the API and serves the dashboard.
# The MCP server is a separate entrypoint in the same image:
#   docker compose exec guardian npx tsx packages/guardian-mcp/server.ts
FROM node:22-alpine AS web
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# tsx runs the TypeScript directly, so there is no server build step to keep in sync.
COPY package*.json ./
RUN npm ci
COPY packages ./packages
COPY apps/api ./apps/api
COPY --from=web /app/apps/web/dist ./apps/web/dist

# Do not run as root: this process holds a Jev key and parent sessions.
USER node
EXPOSE 8787
# The API answers /api/health without touching Jev, so this stays cheap.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://localhost:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "apps/api/server.ts"]
