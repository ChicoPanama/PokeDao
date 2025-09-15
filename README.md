# 🎯 PokeDAO: Production-Ready Pokemon Card Market Intelligence Platform

[![GitHub](https://img.shields.io/github/license/ChicoPanama/PokeDao)](LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/ChicoPanama/PokeDao)](https://github.com/ChicoPanama/PokeDao/commits/main)
[![GitHub repo size](https://img.shields.io/github/repo-size/ChicoPanama/PokeDao)](https://github.com/ChicoPanama/PokeDao)
[![Release](https://img.shields.io/github/v/release/ChicoPanama/PokeDao)](https://github.com/ChicoPanama/PokeDao/releases/tag/v1.0.0-mvp)

> **A complete, production-ready Pokemon card market intelligence system with AI-powered analysis and automated social media posting**

## 🚀 **What is PokeDAO?**

PokeDAO is a **fully operational market intelligence platform** that combines **multi-source data collection**, **AI-powered analysis**, and **automated social media posting** to identify Pokemon card arbitrage opportunities. The system is **production-ready** with comprehensive safety controls, monitoring, and deployment infrastructure.

### **📊 System Status:**
- ✅ **Agent Orchestration System** - BullMQ workers with 6-step pipeline
- ✅ **X/Twitter Social Posting** - Automated thread posting with safety controls
- ✅ **Database Infrastructure** - PostgreSQL + Redis with full migrations
- ✅ **API Server** - FastAPI with health monitoring and RESTful endpoints
- ✅ **Data Pipeline** - 61 utility scripts for comprehensive market analysis
- ✅ **Docker Deployment** - Full containerization with health checks

---

## 🏗️ **Architecture Overview**

### **Core Components**

```
📁 PokeDAO Production System
├── 🤖 Agent Orchestration (apps/agent/)
│   ├── BullMQ worker infrastructure
│   ├── 6-step pipeline: fetch → normalize → features → signal → validate → output
│   ├── Daily posting pipeline with cron scheduling
│   └── Real-time opportunity detection
├── 📱 Social Media Integration (packages/social/x/)
│   ├── X/Twitter posting client with dry-run support
│   ├── Thread formatting and safety controls
│   └── Rate limiting and error handling
├── 🗄️ Database Layer (api/prisma/)
│   ├── PostgreSQL with comprehensive schema
│   ├── Redis for caching and job queues
│   └── Full migration and seeding system
├── 🌐 API Server (api/)
│   ├── FastAPI with health monitoring
│   ├── RESTful endpoints for data access
│   └── Real-time market intelligence
├── 🔧 Shared Utilities (packages/shared/)
│   ├── Database operations and normalization
│   ├── Fee calculations and pricing logic
│   └── Title parsing and caching
└── 📊 Data Pipeline (scripts/)
    ├── 61 utility scripts for data collection
    ├── Multi-source market analysis
    └── Comprehensive validation and processing
```

### **Key Technologies**
- **Node.js + TypeScript** - Core runtime and type safety
- **BullMQ + Redis** - Job queue and worker orchestration
- **PostgreSQL** - Primary database with Prisma ORM
- **FastAPI** - RESTful API server
- **Docker** - Containerized deployment
- **Twitter API v2** - Social media integration

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- Docker and Docker Compose
- pnpm package manager

### **Installation & Setup**

```bash
# Clone the repository
git clone https://github.com/ChicoPanama/PokeDao.git
cd PokeDao

# Install dependencies
pnpm install

# Start infrastructure services
docker-compose up -d

# Run database migrations
cd api && npx prisma migrate deploy

# Start the API server
pnpm -F api dev
```

### **System Verification**

```bash
# Test X/Twitter posting (dry-run mode)
pnpm x:dry

# Test agent orchestration system
pnpm agent:tick

# Check API health
curl http://localhost:3000/health

# Verify database connectivity
cd api && npx prisma studio
```

---

## 🎯 **Core Features**

### **🤖 Agent Orchestration System**
- **Automated Data Collection** - Multi-source market data ingestion
- **6-Step Processing Pipeline** - fetch → normalize → features → signal → validate → output
- **BullMQ Worker Infrastructure** - Scalable job processing with Redis
- **Real-time Opportunity Detection** - Continuous market analysis
- **Cron-based Scheduling** - Configurable execution intervals

### **📱 Social Media Integration**
- **X/Twitter Posting** - Automated thread generation and posting
- **Safety Controls** - Dry-run mode and kill switches
- **Thread Formatting** - AIXBT-style investment theses
- **Rate Limiting** - Respectful API usage with backoff
- **Error Handling** - Comprehensive retry and fallback logic

### **🗄️ Database Infrastructure**
- **PostgreSQL** - Primary data storage with comprehensive schema
- **Redis** - Caching and job queue management
- **Prisma ORM** - Type-safe database operations
- **Migration System** - Version-controlled schema changes
- **Seed Data** - Initial dataset for testing and development

### **🌐 API Server**
- **FastAPI** - High-performance RESTful API
- **Health Monitoring** - System status and connectivity checks
- **Data Endpoints** - Programmatic access to market intelligence
- **Real-time Updates** - Live market data and opportunity feeds
- **Authentication** - Secure API access controls

### **📊 Data Pipeline**
- **61 Utility Scripts** - Comprehensive data collection and analysis tools
- **Multi-source Integration** - eBay, TCGPlayer, Fanatics, Phygitals, Pokemon TCG API
- **Data Validation** - Quality assurance and outlier detection
- **Normalization Engine** - Consistent data formatting across sources
- **Market Analysis** - Advanced pricing and arbitrage detection

---

## 🛠️ **Production Deployment**

### **Docker Infrastructure**
```bash
# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f
```

### **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Configure required variables:
# - DATABASE_URL (PostgreSQL connection)
# - REDIS_URL (Redis connection)
# - X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (Twitter API)
# - AGENT_ENABLED, POSTING_ENABLED, POSTING_DRY_RUN (Safety controls)
```

### **Safety Controls**
- **POSTING_ENABLED=false** - Disable live posting by default
- **POSTING_DRY_RUN=true** - Enable dry-run mode for testing
- **AGENT_SMOKE_ONLY=true** - Database-free testing mode
- **Rate Limiting** - Built-in API usage controls
- **Error Handling** - Comprehensive retry and fallback logic

---

## 📊 **System Monitoring**

### **Health Checks**
```bash
# API Health
curl http://localhost:3000/health
# Response: {"status":"ok","redis":"PONG"}

# Database Connectivity
cd api && npx prisma db push

# Agent System Status
pnpm agent:tick
```

### **Logging & Debugging**
- **Structured Logging** - Comprehensive system event tracking
- **Debug Mode** - AGENT_DEBUG=true for detailed pipeline logs
- **Error Tracking** - Centralized error collection and reporting
- **Performance Metrics** - Execution time and resource usage monitoring

---

## 🗂️ **Project Structure**

```
📁 PokeDAO/
├── 📁 apps/agent/                    # Agent orchestration system
│   ├── src/index.ts                  # Main worker entry point
│   ├── src/tick.ts                   # Agent execution logic
│   ├── src/steps/                    # 6-step processing pipeline
│   ├── src/pipelines/                # Daily posting and scheduling
│   └── package.json                  # Agent dependencies
├── 📁 packages/social/x/             # X/Twitter integration
│   ├── client.ts                     # Twitter API client
│   └── post.ts                       # Thread formatting
├── 📁 packages/shared/               # Shared utilities
│   ├── db.ts                         # Database operations
│   ├── fees.ts                       # Fee calculations
│   ├── money.ts                      # Currency handling
│   └── titleCache.ts                 # Title parsing cache
├── 📁 api/                           # API server
│   ├── src/index.ts                  # FastAPI server
│   ├── src/routes/                   # API endpoints
│   ├── prisma/schema.prisma          # Database schema
│   └── Dockerfile                    # API containerization
├── 📁 scripts/                       # Data pipeline (61 scripts)
│   ├── x-dry-run.ts                  # Twitter posting test
│   ├── agent-smoke-tick.ts           # Agent system test
│   ├── collect-ebay-sold.ts          # eBay data collection
│   └── [58 additional utility scripts]
├── 📁 worker/                        # Data processing workers
├── 📁 bot/                           # Telegram bot integration
├── 📁 ml/                            # Machine learning components
├── 📁 research/                      # Research and analysis tools
├── docker-compose.yml                # Infrastructure orchestration
└── package.json                      # Workspace configuration
```

---

## 🧪 **Testing & Verification**

### **System Tests**
```bash
# Test X/Twitter posting (dry-run)
pnpm x:dry
# Expected: [DRY RUN][X] Thread with 4 tweets

# Test agent orchestration
pnpm agent:tick
# Expected: Agent tick executed successfully

# Test API health
curl http://localhost:3000/health
# Expected: {"status":"ok","redis":"PONG"}

# Test database connectivity
cd api && npx prisma studio
# Expected: Database browser opens successfully
```

### **Build Verification**
```bash
# Build all components
pnpm build

# Run preflight checks
pnpm run preflight

# Verify TypeScript compilation
pnpm -r run build
```

---

## 🔒 **Security & Safety**

### **Production Safety**
- **Dry-run Mode** - All posting disabled by default
- **Kill Switches** - Environment-based system controls
- **Rate Limiting** - Respectful API usage
- **Error Handling** - Comprehensive retry and fallback logic
- **Input Validation** - Data sanitization and validation

### **Data Protection**
- **Environment Variables** - Secure credential management
- **Database Security** - Connection pooling and access controls
- **API Authentication** - Secure endpoint access
- **Logging Controls** - Sensitive data protection

---

## 📈 **Performance & Scalability**

### **System Metrics**
- **Agent Processing** - 15-minute execution cycles
- **Database Performance** - Optimized queries with indexing
- **API Response Time** - Sub-second endpoint responses
- **Memory Usage** - Efficient resource utilization
- **Error Recovery** - Automatic retry and fallback mechanisms

### **Scalability Features**
- **Horizontal Scaling** - Docker-based service scaling
- **Queue Management** - BullMQ job distribution
- **Database Pooling** - Connection optimization
- **Caching Strategy** - Redis-based performance optimization

---

## 🤝 **Contributing**

### **Development Setup**
```bash
# Clone and setup
git clone https://github.com/ChicoPanama/PokeDao.git
cd PokeDao
pnpm install

# Start development environment
docker-compose up -d
pnpm -F api dev
```

### **Code Standards**
- **TypeScript** - Full type safety
- **ESLint** - Code quality enforcement
- **Prettier** - Consistent formatting
- **Testing** - Comprehensive test coverage
- **Documentation** - Clear code documentation

---

## 📄 **License & Usage**

This project is licensed under the **MIT License** - see [LICENSE](LICENSE) file for details.

### **Commercial Use**
- ✅ Use for personal trading and investment
- ✅ Build commercial applications on top of this data
- ✅ Extend for other trading card games
- ⚠️ **Respect platform ToS** when collecting data

---

## 🔗 **Links & Resources**

- 🌐 **Repository**: [https://github.com/ChicoPanama/PokeDao](https://github.com/ChicoPanama/PokeDao)
- 🏷️ **Latest Release**: [v1.0.0-mvp](https://github.com/ChicoPanama/PokeDao/releases/tag/v1.0.0-mvp)
- 📊 **Pokemon TCG API**: [https://pokemontcg.io](https://pokemontcg.io)
- 🛒 **TCGPlayer**: [https://tcgplayer.com](https://tcgplayer.com)
- 🏪 **eBay**: [https://ebay.com](https://ebay.com)

---

## 🎉 **Production Status**

**PokeDAO v1.0.0-mvp is now fully operational and production-ready!**

- ✅ **Complete agent orchestration system** with BullMQ workers
- ✅ **X/Twitter social posting** with safety controls and dry-run mode
- ✅ **Comprehensive database infrastructure** with PostgreSQL and Redis
- ✅ **FastAPI server** with health monitoring and RESTful endpoints
- ✅ **61 utility scripts** for data collection and market analysis
- ✅ **Docker containerization** with full deployment infrastructure
- ✅ **Zero-failure deployment** with comprehensive testing and verification

**This represents a complete, production-ready Pokemon card market intelligence system with AI-powered analysis and automated social media posting capabilities.**

---

**Built with ❤️ for the Pokemon card community**