import loadAndValidateEnv from './validate-env';

/**
 * Simple developer self-test. Run with: node ./scripts/validate-env-selftest.js
 * This will fail-fast if required test vars are missing or invalid.
 */
function run() {
  // For a self-test we require PORT and REDIS_URL — these are common and have format checks
  loadAndValidateEnv(['PORT', 'REDIS_URL']);
  console.log('✅ Env self-test passed');
}

if (require.main === module) run();
