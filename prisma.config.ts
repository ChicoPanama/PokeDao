import path from 'node:path';
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'api', 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      return new PrismaPg(pool);
    },
  },
  seed: {
    command: 'node api/prisma/seed.mjs',
  },
});
