FROM node:22.23.4-bookworm-slim AS deps
WORKDIR /app

# sharp needs libvips and build tooling for its native bindings.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips-dev build-essential git \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# Reuse verified Prisma engine downloads without changing build networking.
RUN --mount=type=cache,id=rtrda-prisma-engine-cache,target=/root/.cache/prisma \
    npm ci --no-audit --no-fund
# Generate the Prisma client (reads prisma/schema.prisma); needed for typecheck/build.
# `prisma generate` doesn't connect, but the config resolves DATABASE_URL — pass
# a throwaway value so it loads. The real URL is injected at runtime by compose.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

FROM deps AS builder
WORKDIR /app
COPY . .
# Content is served from Postgres at runtime; the build must not need the
# database. Generated client is already present from the deps stage.
RUN npm test
RUN npm run lint
RUN npm run typecheck
RUN npm run build

FROM node:22.23.4-bookworm-slim AS runner
WORKDIR /app

# Prisma's query engine needs OpenSSL at runtime; sharp needs libvips.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libvips42 \
  && rm -rf /var/lib/apt/lists/*

FROM deps AS pr-center-api-build
WORKDIR /app
COPY . .
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
# tsx is a runtime dependency; discard test/lint tooling after client generation.
RUN npm prune --omit=dev --ignore-scripts --no-audit --no-fund
FROM runner AS pr-center-api
COPY --from=pr-center-api-build /app /app
ENV NODE_ENV=production
ENV PR_CENTER_API_HOST=0.0.0.0
ENV PR_CENTER_API_PORT=3100
EXPOSE 3100
CMD ["npm", "run", "pr-center:api"]

FROM deps AS activity-report-auth
WORKDIR /app
COPY . .
ENV NODE_ENV=production
ENV ACTIVITY_AUTH_HOST=0.0.0.0
ENV ACTIVITY_AUTH_PORT=3101
EXPOSE 3101
CMD ["npm", "run", "activity-auth:api"]

FROM runner AS web-runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
