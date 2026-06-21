FROM node:22-bookworm-slim AS deps
WORKDIR /app

# sharp needs libvips and build tooling for its native bindings.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips-dev build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci
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

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Prisma's query engine needs OpenSSL at runtime; sharp needs libvips.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl libvips42 \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
