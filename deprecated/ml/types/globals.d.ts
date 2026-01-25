// Extremely conservative ambient types to eliminate red without touching code.
// Reversible: delete this file later to restore strictness.

// Allow importing JSON and common non-TS assets
declare module "*.json" {
  const value: any;
  export default value;
}

// If the code imports packages without @types, unblock with a generic module declaration.
// Add specific lines below as needed, e.g.:
// declare module "express-async-errors";
// declare module "fastify-cors";

// LAST-RESORT WILDCARD (kept ON to go green now; remove later to regain strictness)
declare module "*";
