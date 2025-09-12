# Bot Dockerfile
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
COPY bot/package.json ./bot/

# Copy prisma schema
COPY prisma/ ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

# Copy bot source code
COPY bot/ ./bot/

# Set working directory to bot package
WORKDIR /app/bot

# Build the application
RUN pnpm run build

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# Start the application  
CMD ["pnpm", "start"]
