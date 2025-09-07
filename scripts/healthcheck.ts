#!/usr/bin/env node
/**
 * Phase 0 Healthcheck - Verify DB and Redis connectivity
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'
import 'dotenv/config'

const prisma = new PrismaClient()

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1 as connected`
    console.log('✅ Database: Connected')
    return true
  } catch (error) {
    console.error('❌ Database: Failed to connect', error)
    return false
  }
}

async function checkRedis() {
  try {
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })
    
    await redis.connect()
    await redis.ping()
    await redis.disconnect()
    
    console.log('✅ Redis: Connected')
    return true
  } catch (error) {
    console.error('❌ Redis: Failed to connect', error)
    return false
  }
}

async function checkPrismaSchema() {
  try {
    // Test a simple count query on each table
    const cardCount = await prisma.card.count()
    const userCount = await prisma.user.count()
    
    console.log('✅ Prisma Schema: Valid')
    console.log(`   - Cards: ${cardCount}`)
    console.log(`   - Users: ${userCount}`)
    return true
  } catch (error) {
    console.error('❌ Prisma Schema: Invalid', error)
    return false
  }
}

async function main() {
  console.log('🔍 PokeDAO Phase 0 - Environment Healthcheck\n')
  
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkPrismaSchema()
  ])
  
  const allPassed = checks.every(Boolean)
  
  console.log('\n' + '='.repeat(50))
  if (allPassed) {
    console.log('🎉 Phase 0 COMPLETE - All systems operational!')
    console.log('✅ Ready to proceed to Phase 1 (Schema Groundwork)')
  } else {
    console.log('❌ Phase 0 FAILED - Fix issues above before proceeding')
    process.exit(1)
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)
