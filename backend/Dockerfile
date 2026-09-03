# ==============================================================================
# Trustlify Backend — Production Dockerfile (optimized for Suga free tier)
# ==============================================================================
# Build context = REPO ROOT, Dockerfile = backend/Dockerfile.
# All host-side COPY paths are therefore prefixed with backend/.
# Node 22 is REQUIRED: @supabase/supabase-js needs the stable global WebSocket
# that ships in Node 22+ (absent in Node 20).
# ==============================================================================

# --- Stage 1: Compile TypeScript (needs devDependencies: typescript) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# --- Stage 2: Production-only dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# --- Stage 3: Minimal runtime image ---
FROM node:22-alpine AS runtime

# curl is used by the HEALTHCHECK below (not present in alpine by default)
RUN apk add --no-cache curl \
    && addgroup -g 1001 -S trustlify \
    && adduser -S trustlify -u 1001 -G trustlify

WORKDIR /app

# Production dependencies from the deps stage
COPY --from=deps --chown=trustlify:trustlify /app/node_modules ./node_modules

# Compiled JavaScript from the build stage
COPY --from=build --chown=trustlify:trustlify /app/dist ./dist

# package.json is REQUIRED at runtime: Node reads "type": "module" from it
# to treat dist/*.js as ESM. Omitting it causes ERR_REQUIRE_ESM.
COPY --from=build --chown=trustlify:trustlify /app/package.json ./package.json

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Container-level health check (useful for local docker run; Suga uses its
# own orchestration health signals, so this is informational).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

USER trustlify

CMD ["node", "dist/server.js"]