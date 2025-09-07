import dotenv from 'dotenv';

/**
 * Load .env (if present) and validate required environment variables.
 * Call from service entrypoints with the list of keys that must be present.
 */
export function loadAndValidateEnv(required: string[] = []) {
  // Load .env from repo root when running locally. If deployments use a secret
  // manager, this is a no-op because env vars will already be present.
  dotenv.config({ path: '.env' });

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please add them to your `.env` (not committed) or configure your environment.');
    process.exit(1);
  }
}

export default loadAndValidateEnv;
