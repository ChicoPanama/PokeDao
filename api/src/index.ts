import Fastify from 'fastify'
import cors from '@fastify/cors'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()
const fastify = Fastify({
  logger: {
    level: 'info'
  }
})

// Register CORS
await fastify.register(cors, {
  origin: true
})

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { ok: true, timestamp: new Date().toISOString() }
})

// Get all cards
fastify.get('/api/cards', async (request, reply) => {
  const cards = await prisma.card.findMany({
    include: {
      listings: {
        where: { isActive: true }
      },
      evaluations: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })
  return { cards }
})

// Get card by ID
fastify.get('/api/cards/:id', async (request, reply) => {
  const { id } = request.params as { id: string }
  
  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      listings: {
        where: { isActive: true }
      },
      evaluations: {
        orderBy: { createdAt: 'desc' }
      }
    }
  })
  
  if (!card) {
    reply.code(404)
    return { error: 'Card not found' }
  }
  
  return { card }
})

// Create a new listing
fastify.post('/api/listings', async (request, reply) => {
  const body = request.body as any
  
  const listing = await prisma.listing.create({
    data: {
      cardId: body.cardId,
      source: body.source,
      price: body.price,
      currency: body.currency || 'USD',
      url: body.url,
      seller: body.seller
    }
  })
  
  return { listing }
})

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001')
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`🚀 API Server running on http://localhost:${port}`)
    console.log(`📊 Health check: http://localhost:${port}/health`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
