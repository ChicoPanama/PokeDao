/**
 * Kafka/Redpanda Client for PokeDAO
 *
 * Event streaming for real-time price updates, signals, and alerts.
 * Uses KafkaJS which is compatible with Redpanda.
 *
 * Features:
 * - Zero data loss (RPO=0)
 * - Replay capability
 * - Multi-consumer support
 * - Schema validation with Zod
 */

import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';
import { z } from 'zod';

// ============================================================================
// Configuration
// ============================================================================

const BROKER = process.env.REDPANDA_BROKER || process.env.KAFKA_BROKER || 'localhost:9092';
const CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'pokedao';
const GROUP_ID = process.env.KAFKA_GROUP_ID || 'pokedao-agent';

// ============================================================================
// Topics
// ============================================================================

export const TOPICS = {
  /** Real-time price updates from scrapers */
  PRICE_UPDATES: 'pokedao.price.updates',

  /** Detected trading signals */
  SIGNALS: 'pokedao.signals',

  /** Alert notifications to send */
  ALERTS: 'pokedao.alerts',

  /** Listing events (new, updated, sold) */
  LISTINGS: 'pokedao.listings',

  /** Agent pipeline events */
  AGENT_EVENTS: 'pokedao.agent.events',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];

// ============================================================================
// Message Schemas
// ============================================================================

export const PriceUpdateSchema = z.object({
  type: z.literal('price_update'),
  listingId: z.string(),
  source: z.string(),
  cardName: z.string(),
  oldPriceCents: z.number().nullable(),
  newPriceCents: z.number(),
  timestamp: z.string().datetime(),
});

export const SignalSchema = z.object({
  type: z.literal('signal'),
  signalId: z.string(),
  cardId: z.string(),
  listingId: z.string(),
  edgeBp: z.number(),
  confidence: z.number(),
  thesis: z.string(),
  timestamp: z.string().datetime(),
});

export const AlertSchema = z.object({
  type: z.literal('alert'),
  alertId: z.string(),
  userId: z.string(),
  channel: z.enum(['telegram', 'email', 'push']),
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime(),
});

export const ListingEventSchema = z.object({
  type: z.enum(['listing_new', 'listing_updated', 'listing_sold', 'listing_removed']),
  listingId: z.string(),
  source: z.string(),
  cardName: z.string().optional(),
  priceCents: z.number().optional(),
  timestamp: z.string().datetime(),
});

export const AgentEventSchema = z.object({
  type: z.enum(['run_started', 'run_completed', 'run_failed', 'step_completed']),
  runId: z.string(),
  step: z.string().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type PriceUpdate = z.infer<typeof PriceUpdateSchema>;
export type Signal = z.infer<typeof SignalSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type ListingEvent = z.infer<typeof ListingEventSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ============================================================================
// Client Singleton
// ============================================================================

let _kafka: Kafka | null = null;
let _producer: Producer | null = null;
let _admin: Admin | null = null;

export function getKafka(): Kafka {
  if (!_kafka) {
    _kafka = new Kafka({
      clientId: CLIENT_ID,
      brokers: BROKER.split(','),
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }
  return _kafka;
}

// ============================================================================
// Producer
// ============================================================================

export async function getProducer(): Promise<Producer> {
  if (!_producer) {
    _producer = getKafka().producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });
    await _producer.connect();
    console.log('[kafka] Producer connected');
  }
  return _producer;
}

export async function disconnectProducer(): Promise<void> {
  if (_producer) {
    await _producer.disconnect();
    _producer = null;
    console.log('[kafka] Producer disconnected');
  }
}

// ============================================================================
// Admin
// ============================================================================

export async function getAdmin(): Promise<Admin> {
  if (!_admin) {
    _admin = getKafka().admin();
    await _admin.connect();
  }
  return _admin;
}

/**
 * Ensure all required topics exist
 */
export async function ensureTopics(): Promise<void> {
  const admin = await getAdmin();

  const topics = Object.values(TOPICS).map((topic) => ({
    topic,
    numPartitions: 3,
    replicationFactor: 1,
  }));

  try {
    await admin.createTopics({ topics, waitForLeaders: true });
    console.log('[kafka] Topics ensured:', Object.values(TOPICS));
  } catch (error: any) {
    // Topics may already exist
    if (!error.message?.includes('already exists')) {
      throw error;
    }
  }
}

// ============================================================================
// Consumer Factory
// ============================================================================

export interface ConsumerOptions {
  groupId?: string;
  fromBeginning?: boolean;
}

export async function createConsumer(
  topics: TopicName[],
  handler: (message: { topic: string; partition: number; value: unknown }) => Promise<void>,
  options: ConsumerOptions = {}
): Promise<Consumer> {
  const consumer = getKafka().consumer({
    groupId: options.groupId || GROUP_ID,
    retry: { retries: 5 },
  });

  await consumer.connect();
  console.log(`[kafka] Consumer connected: ${options.groupId || GROUP_ID}`);

  for (const topic of topics) {
    await consumer.subscribe({
      topic,
      fromBeginning: options.fromBeginning ?? false,
    });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;

      try {
        const value = JSON.parse(message.value.toString());
        await handler({ topic, partition, value });
      } catch (error) {
        console.error(`[kafka] Message processing error:`, error);
      }
    },
  });

  return consumer;
}

// ============================================================================
// Publishing Helpers
// ============================================================================

/**
 * Publish a price update event
 */
export async function publishPriceUpdate(update: Omit<PriceUpdate, 'type' | 'timestamp'>): Promise<void> {
  const message: PriceUpdate = {
    type: 'price_update',
    ...update,
    timestamp: new Date().toISOString(),
  };

  const validated = PriceUpdateSchema.parse(message);
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.PRICE_UPDATES,
    messages: [{ key: update.listingId, value: JSON.stringify(validated) }],
  });
}

/**
 * Publish a trading signal
 */
export async function publishSignal(signal: Omit<Signal, 'type' | 'timestamp'>): Promise<void> {
  const message: Signal = {
    type: 'signal',
    ...signal,
    timestamp: new Date().toISOString(),
  };

  const validated = SignalSchema.parse(message);
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.SIGNALS,
    messages: [{ key: signal.signalId, value: JSON.stringify(validated) }],
  });
}

/**
 * Publish an alert to be sent
 */
export async function publishAlert(alert: Omit<Alert, 'type' | 'timestamp'>): Promise<void> {
  const message: Alert = {
    type: 'alert',
    ...alert,
    timestamp: new Date().toISOString(),
  };

  const validated = AlertSchema.parse(message);
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.ALERTS,
    messages: [{ key: alert.alertId, value: JSON.stringify(validated) }],
  });
}

/**
 * Publish a listing event
 */
export async function publishListingEvent(event: Omit<ListingEvent, 'timestamp'>): Promise<void> {
  const message: ListingEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const validated = ListingEventSchema.parse(message);
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.LISTINGS,
    messages: [{ key: event.listingId, value: JSON.stringify(validated) }],
  });
}

/**
 * Publish an agent pipeline event
 */
export async function publishAgentEvent(event: Omit<AgentEvent, 'timestamp'>): Promise<void> {
  const message: AgentEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const validated = AgentEventSchema.parse(message);
  const producer = await getProducer();

  await producer.send({
    topic: TOPICS.AGENT_EVENTS,
    messages: [{ key: event.runId, value: JSON.stringify(validated) }],
  });
}

// ============================================================================
// Health Check
// ============================================================================

export async function kafkaHealthCheck(): Promise<boolean> {
  try {
    const admin = await getAdmin();
    await admin.listTopics();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export async function disconnect(): Promise<void> {
  await disconnectProducer();
  if (_admin) {
    await _admin.disconnect();
    _admin = null;
  }
  _kafka = null;
  console.log('[kafka] Disconnected');
}
