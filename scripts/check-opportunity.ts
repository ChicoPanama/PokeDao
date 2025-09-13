import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const opportunities = await db.opportunity.findMany({
    where: { status: 'PENDING' },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  if (opportunities.length === 0) {
    console.log('No PENDING Opportunity found.');
  } else {
    console.log('Recent PENDING Opportunities:');
    for (const opp of opportunities) {
      console.log({ id: opp.id, cardId: opp.cardId, createdAt: opp.createdAt });
    }
  }
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    return db.$disconnect().finally(() => process.exit(1));
  });
