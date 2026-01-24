/**
 * tRPC App Router
 *
 * Main router that combines all procedure routers.
 * Export the type for end-to-end type safety.
 */

import { router } from './trpc.js';
import { signalsRouter } from './procedures/signals.js';
import { cardsRouter } from './procedures/cards.js';

/**
 * Main application router
 */
export const appRouter = router({
  signals: signalsRouter,
  cards: cardsRouter,
});

/**
 * Export type for client-side type safety
 *
 * Usage in client:
 * ```typescript
 * import type { AppRouter } from '@pokedao/api/trpc';
 * const client = createTRPCClient<AppRouter>({ ... });
 * ```
 */
export type AppRouter = typeof appRouter;
