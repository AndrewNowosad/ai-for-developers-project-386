# ── Builder ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

RUN npm install -g pnpm@10

WORKDIR /build

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json   ./apps/backend/
COPY apps/frontend/package.json  ./apps/frontend/
COPY packages/api-spec/package.json ./packages/api-spec/

RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY apps/frontend ./apps/frontend

# Build static assets
RUN pnpm --filter @booking/frontend build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /build/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
