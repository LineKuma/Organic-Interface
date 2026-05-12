# =============================================================================
# Stage 1: Builder - Install dependencies and build all packages
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack and install specific pnpm version
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# Copy workspace configuration files
COPY pnpm-workspace.yaml pnpm-lock.yaml turbo.json package.json tsconfig.base.json ./

# Install dependencies (uses workspace config from pnpm-workspace.yaml)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages using turbo
# Use --force to ensure dependencies are properly linked
RUN pnpm install && pnpm build

# =============================================================================
# Stage 2: Runner - Minimal runtime image
# =============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm@9.1.0

# Copy node_modules from builder (pnpm workspace dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy built packages
COPY --from=builder /app/packages ./packages

# Copy package.json and configs for reference
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/tsconfig.base.json ./tsconfig.base.json

# Set environment
ENV NODE_ENV=development

# Default command - keep container running
CMD ["tail", "-f", "/dev/null"]