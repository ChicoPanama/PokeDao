/**
 * WebSocket Server
 *
 * Real-time updates for the dashboard via WebSocket connections.
 * Broadcasts new opportunities, price updates, and signals.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { getRedis } from './redis.js';

export interface WSMessage {
  type: 'opportunity' | 'price_update' | 'signal' | 'market_summary' | 'ping';
  data: any;
  timestamp: string;
}

// Track connected clients with their subscriptions
interface WSClient {
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

const clients = new Map<string, WSClient>();
let wss: InstanceType<typeof WebSocketServer> | null = null;

// Ping interval to keep connections alive
const PING_INTERVAL_MS = 30000;
const CLIENT_TIMEOUT_MS = 60000;

/**
 * Initialize WebSocket server
 */
export function initWebSocket(server: Server): InstanceType<typeof WebSocketServer> {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = `ws-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    console.log(`[WS] Client connected: ${clientId}`);

    clients.set(clientId, {
      ws,
      subscriptions: new Set(['opportunity', 'signal']), // Default subscriptions
      lastPing: Date.now(),
    });

    // Send welcome message
    sendToClient(clientId, {
      type: 'ping',
      data: { message: 'Connected to PokeDAO WebSocket', clientId },
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(clientId, message);
      } catch (error) {
        console.error(`[WS] Invalid message from ${clientId}:`, error);
      }
    });

    // Handle pong responses
    ws.on('pong', () => {
      const client = clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }
    });

    // Handle close
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WS] Error for ${clientId}:`, error);
      clients.delete(clientId);
    });
  });

  // Start ping interval
  setInterval(() => {
    const now = Date.now();
    for (const [clientId, client] of clients.entries()) {
      if (now - client.lastPing > CLIENT_TIMEOUT_MS) {
        console.log(`[WS] Client timeout: ${clientId}`);
        (client.ws as any).terminate();
        clients.delete(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        (client.ws as any).ping();
      }
    }
  }, PING_INTERVAL_MS);

  console.log('[WS] WebSocket server initialized');
  return wss;
}

/**
 * Handle message from client
 */
function handleClientMessage(clientId: string, message: any): void {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'subscribe':
      if (Array.isArray(message.channels)) {
        message.channels.forEach((channel: string) => {
          client.subscriptions.add(channel);
        });
        console.log(`[WS] ${clientId} subscribed to: ${message.channels.join(', ')}`);
      }
      break;

    case 'unsubscribe':
      if (Array.isArray(message.channels)) {
        message.channels.forEach((channel: string) => {
          client.subscriptions.delete(channel);
        });
      }
      break;

    case 'ping':
      sendToClient(clientId, {
        type: 'ping',
        data: { pong: true },
        timestamp: new Date().toISOString(),
      });
      break;

    default:
      console.log(`[WS] Unknown message type from ${clientId}: ${message.type}`);
  }
}

/**
 * Send message to specific client
 */
function sendToClient(clientId: string, message: WSMessage): void {
  const client = clients.get(clientId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message to all subscribed clients
 */
export function broadcast(channel: string, data: any): void {
  const message: WSMessage = {
    type: channel as any,
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = JSON.stringify(message);

  for (const [clientId, client] of clients.entries()) {
    if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(messageStr);
      } catch (error) {
        console.error(`[WS] Failed to send to ${clientId}:`, error);
      }
    }
  }
}

/**
 * Broadcast new opportunity
 */
export function broadcastOpportunity(opportunity: {
  id: string;
  cardName: string;
  setName?: string;
  spreadPct: number;
  buyPriceCents: number;
  sellPriceCents: number;
  source: string;
}): void {
  broadcast('opportunity', opportunity);
}

/**
 * Broadcast price update
 */
export function broadcastPriceUpdate(update: {
  cardKey: string;
  cardName: string;
  source: string;
  oldPriceCents?: number;
  newPriceCents: number;
  changePct: number;
}): void {
  broadcast('price_update', update);
}

/**
 * Broadcast new signal
 */
export function broadcastSignal(signal: {
  id: string;
  cardName: string;
  thesis: string;
  confidence: number;
  edgeBp: number;
}): void {
  broadcast('signal', signal);
}

/**
 * Broadcast market summary
 */
export function broadcastMarketSummary(summary: {
  totalListings: number;
  activeOpportunities: number;
  topMover: string;
  sentiment: string;
}): void {
  broadcast('market_summary', summary);
}

/**
 * Get connected client count
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Subscribe to Redis pub/sub for cross-instance broadcasts
 */
export async function subscribeToRedisUpdates(): Promise<void> {
  try {
    const redis = getRedis();
    const subscriber = redis.duplicate();
    await subscriber.connect();

    await subscriber.subscribe('pokedao:ws:opportunity', (message) => {
      try {
        broadcast('opportunity', JSON.parse(message));
      } catch (e) {
        console.error('[WS] Failed to parse Redis message:', e);
      }
    });

    await subscriber.subscribe('pokedao:ws:signal', (message) => {
      try {
        broadcast('signal', JSON.parse(message));
      } catch (e) {
        console.error('[WS] Failed to parse Redis message:', e);
      }
    });

    console.log('[WS] Subscribed to Redis pub/sub channels');
  } catch (error) {
    console.error('[WS] Failed to subscribe to Redis:', error);
  }
}

/**
 * Publish update to Redis for cross-instance distribution
 */
export async function publishUpdate(channel: string, data: any): Promise<void> {
  try {
    const redis = getRedis();
    await redis.publish(`pokedao:ws:${channel}`, JSON.stringify(data));
  } catch (error) {
    console.error('[WS] Failed to publish to Redis:', error);
  }
}

/**
 * Shutdown WebSocket server
 */
export function shutdownWebSocket(): void {
  if (wss) {
    for (const [clientId, client] of clients.entries()) {
      client.ws.close(1001, 'Server shutting down');
    }
    clients.clear();
    wss.close();
    wss = null;
    console.log('[WS] WebSocket server shutdown');
  }
}
