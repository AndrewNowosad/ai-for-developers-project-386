# ── Builder ──────────────────────────────────────────────────────────────────
# Full workspace install: generates Prisma client, compiles TypeScript, then
# uses `pnpm deploy` to produce a standalone flat node_modules for production.
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl && npm install -g pnpm@9

WORKDIR /build

# Copy workspace manifests first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json   ./apps/backend/
COPY apps/frontend/package.json  ./apps/frontend/
COPY packages/api-spec/package.json ./packages/api-spec/

# Install all dependencies (dev + prod) needed for the build
RUN pnpm install --frozen-lockfile

# Copy backend source
COPY apps/backend ./apps/backend

# Generate Prisma client — produces Alpine-compatible query-engine binaries
RUN pnpm --filter @booking/backend db:generate

# preserveSymlinks:true in tsconfig makes tsc resolve @prisma/client via its
# symlink path (apps/backend/node_modules/@prisma/client), so it finds
# .prisma/client at apps/backend/node_modules/.prisma/client — no extra copy needed.
# However, transitive deps are NOT symlinked into apps/backend/node_modules/ by
# pnpm's isolated linker:
#   - @types/node: needed for process, Buffer, etc.
#   - pino: needed for FastifyBaseLogger (fastify types import LogFn from 'pino').
#     Without pino, skipLibCheck silently swallows the "cannot find module" error
#     in the .d.ts file, leaving LogFn undefined and FastifyBaseLogger.error missing.
RUN node_types=$(find /build/node_modules/.pnpm -maxdepth 5 \
        -name "package.json" -path "*/node_modules/@types/node/package.json" \
        | head -1 | xargs dirname) && \
    ln -sf "$node_types" /build/apps/backend/node_modules/@types/node && \
    pino_pkg=$(find /build/node_modules/.pnpm -maxdepth 3 \
        -type d -path "*/pino@*/node_modules/pino" \
        | head -1) && \
    ln -sf "$pino_pkg" /build/apps/backend/node_modules/pino && \
    store=$(find /build/node_modules/.pnpm -maxdepth 1 -type d -name "@prisma+client@*" | head -1) && \
    rm -rf "$store/node_modules/.prisma" && \
    cp -r /build/apps/backend/node_modules/.prisma "$store/node_modules/.prisma"

# Compile TypeScript → dist/
RUN pnpm --filter @booking/backend build

# Create a standalone deployment directory with FLAT node_modules.
# pnpm deploy resolves all workspace symlinks, giving Node a normal
# node_modules layout where @prisma/client can locate .prisma/client.
# The "files" field in package.json controls what source files are included.
RUN pnpm --filter @booking/backend deploy --prod /deploy

# .prisma/client is a generated artifact (not a real npm package), so pnpm
# deploy doesn't copy it.  pnpm deploy keeps the pnpm virtual store layout,
# so @prisma/client lives at .pnpm/@prisma+client@<ver>/node_modules/@prisma/client
# and resolves .prisma/client from its sibling .prisma/ inside that store entry.
RUN store=$(find /deploy/node_modules/.pnpm -maxdepth 1 -type d -name "@prisma+client@*" | head -1) && \
    rm -rf "$store/node_modules/.prisma" && \
    cp -r /build/apps/backend/node_modules/.prisma "$store/node_modules/.prisma"

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

# Standalone deployment: flat node_modules + dist/ + prisma/ + package.json
COPY --from=builder /deploy ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
