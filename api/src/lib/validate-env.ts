// Re-export the runtime JS validator to centralize behavior while keeping this file in the package
// so TypeScript's rootDir doesn't need to cross package boundaries.
const loadAndValidateEnv = require('../../scripts/validate-env.js');
export default loadAndValidateEnv;
export { loadAndValidateEnv };
