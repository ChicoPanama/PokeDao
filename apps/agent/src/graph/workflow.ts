/**
 * LangGraph Agent Workflow
 *
 * State machine orchestration for the signal detection pipeline.
 * Replaces the sequential tick.ts with a graph-based workflow that supports:
 * - Visual debugging
 * - Retry/checkpoint
 * - Parallel execution (future)
 * - Human-in-the-loop (future)
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state.js';
import { fetchNode } from './nodes/fetch.js';
import { normalizeNode } from './nodes/normalize.js';
import { featuresNode } from './nodes/features.js';
import { signalNode } from './nodes/signal.js';
import { validateNode } from './nodes/validate.js';
import { outputNode } from './nodes/output.js';

// ============================================================================
// Conditional Edges
// ============================================================================

/**
 * Determine if we should continue after fetch
 */
function shouldContinueAfterFetch(state: AgentStateType): string {
  if (state.smokeMode) {
    return 'end';
  }
  if (state.listings.length === 0) {
    console.log('[workflow] No listings fetched, ending early');
    return 'end';
  }
  return 'normalize';
}

/**
 * Determine if we should continue after signal detection
 */
function shouldContinueAfterSignal(state: AgentStateType): string {
  if (state.candidates.length === 0) {
    console.log('[workflow] No signal candidates, skipping validation');
    return 'end';
  }
  return 'validate';
}

/**
 * Check for fatal errors
 */
function shouldAbortOnError(state: AgentStateType): string {
  const fatalErrors = state.errors.filter((e) => !e.recoverable);
  if (fatalErrors.length > 0) {
    console.error('[workflow] Fatal error detected, aborting');
    return 'end';
  }
  return 'continue';
}

// ============================================================================
// Workflow Graph
// ============================================================================

/**
 * Build the agent workflow graph
 */
function buildWorkflow() {
  const workflow = new StateGraph(AgentState)
    // Add nodes
    .addNode('fetch', fetchNode)
    .addNode('normalize', normalizeNode)
    .addNode('features', featuresNode)
    .addNode('signal', signalNode)
    .addNode('validate', validateNode)
    .addNode('output', outputNode)

    // Start -> Fetch
    .addEdge(START, 'fetch')

    // Fetch -> Normalize (conditional)
    .addConditionalEdges('fetch', shouldContinueAfterFetch, {
      normalize: 'normalize',
      end: END,
    })

    // Normalize -> Features
    .addEdge('normalize', 'features')

    // Features -> Signal
    .addEdge('features', 'signal')

    // Signal -> Validate (conditional)
    .addConditionalEdges('signal', shouldContinueAfterSignal, {
      validate: 'validate',
      end: END,
    })

    // Validate -> Output
    .addEdge('validate', 'output')

    // Output -> End
    .addEdge('output', END);

  return workflow;
}

// ============================================================================
// Compiled Graph
// ============================================================================

/**
 * Compiled agent graph - ready for execution
 */
export const agentGraph = buildWorkflow().compile();

// ============================================================================
// Execution Helpers
// ============================================================================

/**
 * Run the agent pipeline with default initial state
 */
export async function runAgentGraph(options?: {
  smokeMode?: boolean;
  runId?: string;
}): Promise<AgentStateType> {
  const runId = options?.runId || `run_${Date.now()}`;

  console.log(`[workflow] Starting run: ${runId}`);
  const startedAt = new Date();

  const initialState: Partial<AgentStateType> = {
    runId,
    startedAt,
    smokeMode: options?.smokeMode ?? process.env.AGENT_SMOKE_ONLY === 'true',
  };

  const result = await agentGraph.invoke(initialState);

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`[workflow] Completed: ${runId} (${durationMs}ms)`);
  console.log(`[workflow] Metrics:`, result.metrics);

  if (result.errors.length > 0) {
    console.warn(`[workflow] Errors (${result.errors.length}):`, result.errors);
  }

  return result;
}

/**
 * Run with streaming updates (for observability)
 */
export async function* streamAgentGraph(options?: {
  smokeMode?: boolean;
  runId?: string;
}): AsyncGenerator<{ node: string; state: Partial<AgentStateType> }> {
  const runId = options?.runId || `run_${Date.now()}`;

  const initialState: Partial<AgentStateType> = {
    runId,
    startedAt: new Date(),
    smokeMode: options?.smokeMode ?? false,
  };

  for await (const event of await agentGraph.stream(initialState)) {
    for (const [node, state] of Object.entries(event)) {
      yield { node, state: state as Partial<AgentStateType> };
    }
  }
}

// ============================================================================
// Graph Visualization
// ============================================================================

/**
 * Get Mermaid diagram of the workflow
 */
export function getWorkflowDiagram(): string {
  return `
graph TD
    START((Start)) --> fetch[Fetch Listings]
    fetch -->|has listings| normalize[Normalize]
    fetch -->|no listings| END((End))
    normalize --> features[Attach Comps]
    features --> signal[Detect Signals]
    signal -->|has candidates| validate[Validate & Persist]
    signal -->|no candidates| END
    validate --> output[Stage & Alert]
    output --> END
  `.trim();
}
