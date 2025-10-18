# PokeDAO Runbook

## Daily Operations

### Reset Database Locally
```bash
pnpm -w run db:reset
```

### Rebuild & Start Services
```bash
docker compose down --remove-orphans && docker compose up -d --build
```

### Monitor Logs
```bash
# All services
docker compose logs -f --tail=200

# Specific service
docker compose logs -f pokedao-web
```

### Health Checks
```bash
# Quick smoke test
bash scripts/smoke.sh

# Manual health check
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

### Database Operations
```bash
# Add new migration
pnpm -w exec prisma migrate dev --name meaningful_name

# Deploy migrations (production)
pnpm -w exec prisma migrate deploy

# Generate client after schema changes
pnpm -w exec prisma generate

# Reset with fresh seed data
pnpm -w run db:reset
```

### Monitoring
```bash
# Prometheus metrics
curl http://localhost:3000/metrics

# API catalog
curl http://localhost:3000/api/_routes

# Database connection check
docker exec pokedao-db psql -U pokedao -d pokedao -c "SELECT version();"
```

## Development

### Package Operations
```bash
# Install dependencies
pnpm -w install

# Build all packages
pnpm -w run build

# Type check all packages
pnpm -w run typecheck

# Lint all packages
pnpm -w run lint

# Test (when available)
pnpm -w run test
```

### Service-Specific Commands
```bash
# Start API only
pnpm --filter @pokedao/api start

# Start worker only  
pnpm --filter @pokedao/worker start

# Start bot only
pnpm --filter @pokedao/bot start
```

## Troubleshooting

### Common Issues

**Services fail to start:**
1. Check Docker resources (RAM/CPU)
2. Verify environment variables in `.env`
3. Check logs: `docker compose logs [service]`

**Database connection errors:**
1. Verify Postgres is running: `docker compose ps db`
2. Check DATABASE_URL format
3. Reset containers: `docker compose restart db`

**TypeScript errors:**
1. Regenerate Prisma client: `pnpm exec prisma generate`
2. Clean build: `pnpm -w run clean && pnpm -w run build`
3. Check package versions for drift

**Health checks failing:**
1. Verify Redis connection: `docker exec pokedao-redis redis-cli ping`
2. Check API logs for startup errors
3. Ensure port 3000 is available

### Emergency Procedures

**Complete reset:**
```bash
# Stop everything
docker compose down --volumes --remove-orphans

# Remove images
docker rmi $(docker images "pokedao-*" -q)

# Clean rebuild
docker compose up -d --build --force-recreate
```

**Data backup (before reset):**
```bash
# Export database
docker exec pokedao-db pg_dump -U pokedao pokedao > backup.sql

# Restore later
docker exec -i pokedao-db psql -U pokedao -d pokedao < backup.sql
```
