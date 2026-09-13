FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
# turbo prune's json output only carries package.json files, but the
# postinstall script (`prisma generate`) needs the schema present at install
# time, before the full source is copied in below.
COPY --from=pruner /app/out/full/apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=installer --chown=nestjs:nodejs /app .

USER nestjs
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
