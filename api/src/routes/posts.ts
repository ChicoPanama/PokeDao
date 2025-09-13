import type { FastifyInstance } from 'fastify';
import prisma from '../lib/prisma.js';

export async function registerPosts(app: FastifyInstance) {
  app.get('/posts/pending', async (_req, reply) => {
    const rows = await prisma.postQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: { scheduledAt: 'asc' },
      take: 50,
    });
    return reply.send({ ok: true, items: rows, count: rows.length });
  });
}

