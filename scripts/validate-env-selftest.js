const loadAndValidateEnv = require('./validate-env.js');

function run() {
  loadAndValidateEnv(['PORT', 'REDIS_URL']);
  console.log('✅ Env self-test passed');
}

if (require.main === module) run();
