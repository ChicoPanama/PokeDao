/**
 * LangGraph Agent State
 *
 * Defines the typed state that flows through the agent pipeline.
 * Each step reads from and writes to this shared state.
 */

import { Annotation } from '@langchain/langgraph';

// ============================================================================
// Domain Types
// ============================================================================

export interface MarketListing {
  id: string;
  source: string;
  sourceId: string;
  title: string;
  priceCents: number;
  url?: string;
  cardName?: string;
  setName?: string;
  grade?: number;
  gradeCompany?: string;
  condition?: string;
  seller?: string;
  seenAt: Date;
}

export interface NormalizedListing {
  listingId: string;
  canonicalCardId?: string;
  cardName: string;
  setName: string;
  cardNumber?: string;
  variant?: string;
  grade?: number;
  gradeCompany?: string;
  priceCents: number;
  source: string;
  url?: string;
  dataQuality: number;
}

export interface ListingWithComps extends NormalizedListing {
  comps: CompSale[];
  medianCompCents?: number;
  compCount: number;
}

export interface CompSale {
  id: string;
  priceCents: number;
  soldAt: Date;
  source: string;
  grade?: number;
}

export interface SignalCandidate {
  listing: ListingWithComps;
  edgeBp: number;
  confidence: number;
  thesis: string;
  risks: string[];
}

export interface ValidatedSignal {
  id: string;
  cardId: string;
  listingId: string;
  edgeBp: number;
  confidence: number;
  thesis: string;
  status: 'ACTIVE' | 'PENDING';
  createdAt: Date;
}

export interface PipelineError {
  step: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

// ============================================================================
// Agent State Definition
// ============================================================================

/**
 * LangGraph state annotation for the agent pipeline.
 *
 * Uses reducers to define how state is updated at each step:
 * - Default reducer: Replace value entirely
 * - Array reducer: Append to existing array
 * - Custom reducer: Merge logic for specific fields
 */
export const AgentState = Annotation.Root({
  // Pipeline inputs
  runId: Annotation<string>(),
  startedAt: Annotation<Date>(),
  smokeMode: Annotation<boolean>({
    value: (_, b) => b ?? false,
    default: () => false,
  }),

  // Step 1: Fetch outputs
  listings: Annotation<MarketListing[]>({
    value: (_, newVal) => newVal ?? [], // Replace
    default: () => [],
  }),

  // Step 2: Normalize outputs
  normalized: Annotation<NormalizedListing[]>({
    value: (_, newVal) => newVal ?? [],
    default: () => [],
  }),

  // Step 3: Feature attachment outputs
  withComps: Annotation<ListingWithComps[]>({
    value: (_, newVal) => newVal ?? [],
    default: () => [],
  }),

  // Step 4: Signal detection outputs
  candidates: Annotation<SignalCandidate[]>({
    value: (_, newVal) => newVal ?? [],
    default: () => [],
  }),

  // Step 5: Validation outputs
  validated: Annotation<ValidatedSignal[]>({
    value: (_, newVal) => newVal ?? [],
    default: () => [],
  }),

  // Step 6: Output tracking
  alertsSent: Annotation<number>({
    value: (_, n) => n ?? 0,
    default: () => 0,
  }),
  postsQueued: Annotation<number>({
    value: (_, n) => n ?? 0,
    default: () => 0,
  }),

  // Error tracking (append-only)
  errors: Annotation<PipelineError[]>({
    value: (existing, newErrors) => [...(existing ?? []), ...(newErrors ?? [])],
    default: () => [],
  }),

  // Metrics
  metrics: Annotation<Record<string, number>>({
    default: () => ({}),
    reducer: (existing, newMetrics) => ({ ...existing, ...newMetrics }),
  }),
});

export type AgentStateType = typeof AgentState.State;
