import dotenv from 'dotenv';

export function loadAndValidateEnv(required: string[] = []) {
  dotenv.config({ path: '.env' });
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

export default loadAndValidateEnv;
