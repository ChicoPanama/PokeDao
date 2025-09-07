// Re-export the runtime JS validator (keeps TS rootDir safe)
const loadAndValidateEnv = require('../../scripts/validate-env.js');
export default loadAndValidateEnv;
export { loadAndValidateEnv };
