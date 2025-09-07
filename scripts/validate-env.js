const dotenv = require('dotenv');

function loadAndValidateEnv(required = []) {
  // Load .env from repo root when running locally.
  dotenv.config({ path: '.env' });

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please add them to your `.env` (not committed) or configure your environment.');
    process.exit(1);
  }
}

module.exports = loadAndValidateEnv;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAndValidateEnv = loadAndValidateEnv;
const dotenv_1 = __importDefault(require("dotenv"));
/**
 * Load .env (if present) and validate required environment variables.
 * Call from service entrypoints with the list of keys that must be present.
 */
function loadAndValidateEnv(required = []) {
    // Load .env from repo root when running locally. If deployments use a secret
    // manager, this is a no-op because env vars will already be present.
    dotenv_1.default.config({ path: '.env' });
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        console.error('Please add them to your `.env` (not committed) or configure your environment.');
        process.exit(1);
    }
}
exports.default = loadAndValidateEnv;
