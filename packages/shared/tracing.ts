/**
 * OpenTelemetry tracing utilities for PokeDAO agent pipeline
 *
 * This module provides lightweight tracing for observability without
 * requiring the full OpenTelemetry SDK until it's needed.
 */

// Simple logger for tracing (avoids circular dependencies)
const logger = {
  debug: (obj: Record<string, unknown>, msg: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[tracing] ${msg}`, JSON.stringify(obj));
    }
  },
  error: (obj: Record<string, unknown>, msg: string) => {
    console.error(`[tracing] ${msg}`, JSON.stringify(obj));
  },
};

// Simple span interface for basic tracing
export interface Span {
  name: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
  end: () => void;
  setStatus: (status: 'ok' | 'error', message?: string) => void;
  addEvent: (name: string, attributes?: Record<string, unknown>) => void;
  setAttribute: (key: string, value: string | number | boolean) => void;
}

// Simple tracer implementation
export interface Tracer {
  startSpan: (name: string, attributes?: Record<string, string | number | boolean>) => Span;
}

// In-memory span storage for debugging (limited to last 100 spans)
const recentSpans: Array<{
  name: string;
  duration: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
}> = [];
const MAX_RECENT_SPANS = 100;

function createSpan(name: string, attributes: Record<string, string | number | boolean> = {}): Span {
  const startTime = Date.now();
  let status: 'ok' | 'error' = 'ok';
  let statusMessage: string | undefined;
  const events: Span['events'] = [];

  const span: Span = {
    name,
    startTime,
    attributes: { ...attributes },
    events,

    end() {
      const duration = Date.now() - startTime;

      // Log span completion
      if (status === 'error') {
        logger.error({ span: name, duration, status, message: statusMessage, ...span.attributes }, `Span ${name} completed with error`);
      } else {
        logger.debug({ span: name, duration, status, ...span.attributes }, `Span ${name} completed`);
      }

      // Store in recent spans
      recentSpans.push({
        name,
        duration,
        status,
        attributes: { ...span.attributes, statusMessage },
      });

      // Trim to max size
      if (recentSpans.length > MAX_RECENT_SPANS) {
        recentSpans.shift();
      }
    },

    setStatus(s: 'ok' | 'error', message?: string) {
      status = s;
      statusMessage = message;
    },

    addEvent(eventName: string, eventAttributes?: Record<string, unknown>) {
      events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes: eventAttributes,
      });
      logger.debug({ span: name, event: eventName, ...eventAttributes }, `Span event: ${eventName}`);
    },

    setAttribute(key: string, value: string | number | boolean) {
      span.attributes[key] = value;
    },
  };

  return span;
}

/**
 * Create a tracer for a specific component
 */
export function createTracer(componentName: string): Tracer {
  return {
    startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
      return createSpan(`${componentName}:${name}`, {
        component: componentName,
        ...attributes,
      });
    },
  };
}

/**
 * Get recent spans for debugging
 */
export function getRecentSpans() {
  return [...recentSpans];
}

/**
 * Clear recent spans
 */
export function clearRecentSpans() {
  recentSpans.length = 0;
}

/**
 * Helper to wrap an async function with tracing
 */
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const span = tracer.startSpan(name, attributes);
  try {
    const result = await fn(span);
    span.setStatus('ok');
    return result;
  } catch (error) {
    span.setStatus('error', error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Create the default agent tracer
 */
export const agentTracer = createTracer('pokedao-agent');
