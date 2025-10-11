import { describe, it, expect } from 'vitest';
import { getRedis } from '../redis.js';

describe('Redis Client - Unit Tests', () => {
  it('exports getRedis function', () => {
    expect(typeof getRedis).toBe('function');
  });

  it('getRedis returns a client', () => {
    const client = getRedis();
    expect(client).toBeDefined();
  });

  it('client has isOpen property', () => {
    const client = getRedis();
    expect(client).toHaveProperty('isOpen');
  });

  it('client has get method', () => {
    const client = getRedis();
    expect(typeof client.get).toBe('function');
  });

  it('client has set method', () => {
    const client = getRedis();
    expect(typeof client.set).toBe('function');
  });

  it('client has connect method', () => {
    const client = getRedis();
    expect(typeof client.connect).toBe('function');
  });
});
