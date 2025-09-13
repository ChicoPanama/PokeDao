import { z } from 'zod';

export const ReasonedSignal = z.object({
  edgeBp: z.number().int(),
  confidence: z.number().min(0).max(1),
  thesis: z.string().max(240),
  drivers: z.array(z.string()).default([]),
  flags: z.object({
    staleComps: z.boolean().default(false),
    highVolatility: z.boolean().default(false),
    lowLiquidity: z.boolean().default(false),
  }),
});

