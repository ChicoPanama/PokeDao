import { describe, it, expect } from 'vitest';
import prisma from '../prisma.js';

describe('Prisma Client - Unit Tests', () => {
  it('exports prisma client', () => {
    expect(prisma).toBeDefined();
  });

  it('has redditSignal model', () => {
    expect(prisma.redditSignal).toBeDefined();
  });

  it('has card model', () => {
    expect(prisma.card).toBeDefined();
  });

  it('has listing model', () => {
    expect(prisma.listing).toBeDefined();
  });

  it('has compSale model', () => {
    expect(prisma.compSale).toBeDefined();
  });
});
