FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN npm install -g pnpm@9.15.0
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/game/package.json apps/game/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.server.json ./
COPY apps ./apps
COPY packages ./packages

FROM deps AS api
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pnpm db:generate
WORKDIR /app/apps/api
USER node
CMD ["pnpm", "start"]

FROM deps AS game
WORKDIR /app/apps/game
USER node
CMD ["pnpm", "start"]

FROM deps AS web-build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_MODE=real
RUN pnpm --filter @mini-connecta/web build
RUN cp -r apps/web/public apps/web/.next/standalone/apps/web/public && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone ./
USER node
CMD ["node", "apps/web/server.js"]
