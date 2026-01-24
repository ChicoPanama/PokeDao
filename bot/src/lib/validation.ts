/**
 * Input validation utilities for Telegram bot
 *
 * Validates and sanitizes user input from callback queries
 * to prevent injection attacks and invalid data.
 */

// CUID pattern (Prisma default ID format)
// CUIDs are 25 characters: 'c' followed by 24 alphanumeric chars
const CUID_PATTERN = /^c[a-z0-9]{24}$/;

// CUID2 pattern (newer format, variable length 21-24 chars)
const CUID2_PATTERN = /^[a-z0-9]{21,24}$/;

// Max ID length for safety
const MAX_ID_LENGTH = 30;

/**
 * Check if a string is a valid CUID or CUID2
 */
export function isValidCuid(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > MAX_ID_LENGTH) return false;

  return CUID_PATTERN.test(id) || CUID2_PATTERN.test(id);
}

/**
 * Extract and validate an ID from callback data
 *
 * @param prefix - The callback prefix (e.g., 'bought:', 'watch:')
 * @param data - The full callback data string
 * @returns The validated ID or null if invalid
 */
export function sanitizeCallbackId(
  prefix: string,
  data: string | undefined
): string | null {
  if (!data || typeof data !== 'string') return null;
  if (!data.startsWith(prefix)) return null;

  const id = data.slice(prefix.length);

  if (!isValidCuid(id)) return null;

  return id;
}

/**
 * Validate a Telegram user ID
 */
export function isValidTelegramId(id: number | string | undefined): boolean {
  if (id === undefined || id === null) return false;

  const numId = typeof id === 'string' ? parseInt(id, 10) : id;

  // Telegram IDs are positive integers
  return Number.isInteger(numId) && numId > 0 && numId < Number.MAX_SAFE_INTEGER;
}

/**
 * Sanitize a string for safe logging (remove PII markers)
 */
export function sanitizeForLog(text: string, maxLength: number = 100): string {
  if (!text || typeof text !== 'string') return '[empty]';

  // Truncate and remove newlines
  return text.slice(0, maxLength).replace(/[\n\r]/g, ' ');
}
