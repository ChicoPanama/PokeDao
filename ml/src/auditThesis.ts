import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Paper-mode stub: fill thesis with a short placeholder, and block none.
export async function auditAndThesisForNewSignals({ take = 50 } = {}) {
  const raws = await prisma.signal.findMany({
    where: { thesis: '' },
    orderBy: { createdAt: 'desc' },
    take,
    include: { card: true, marketListing: true },
  });

  let updated = 0,
    blocked = 0;
  for (const sig of raws) {
    const thesis = `Paper-mode: ${sig.kind} candidate. Edge ${Math.round(sig.edgeBp / 100)}%, conf ${Math.round(sig.confidence * 100)}%.`;
    await prisma.signal.update({ where: { id: sig.id }, data: { thesis } });
    updated++;
  }
  return { updated, blocked };
}

