# API Dockerfile
FROM node:20-bullseye-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package files
COPY api/package.json ./api/

# Copy prisma schema
COPY prisma/ ./prisma/

# Install dependencies (from root)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Copy API source code
COPY api/ ./api/

# Set working directory to API package
WORKDIR /app/api

# Build the application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["pnpm", "start"]
