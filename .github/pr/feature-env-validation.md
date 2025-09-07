Title: chore(env): centralize env validation, add .env.example, and enforce fail-fast checks

Summary
-------
This change adds a centralized environment validator and wiring to the main entrypoints (API, bot, worker). It also
provides safe `.env.example` files (no real secrets), package-local shims for TypeScript compilation, and a small
self-test script to validate environment variables locally and in CI.

Why
---
- Prevent accidental app startup with missing critical environment variables.
- Avoid committing real secrets by providing placeholder examples and normalizing `.gitignore`.
- Fail fast during development and CI with clear error messages for missing or malformed env vars.

What changed
------------
- `scripts/validate-env.js` — runtime validator (loads `.env` and checks required keys; basic format checks for `PORT` and `REDIS_URL`).
- `scripts/validate-env.ts` — TypeScript copy (kept for local dev reference).
- `scripts/validate-env-selftest.js` — small runner to verify env locally or in CI.
- `.env.example`, `worker/.env.example` — replaced literal example keys with placeholders.
- `api/src/lib/validate-env.ts`, `bot/src/lib/validate-env.ts`, `worker/src/lib/validate-env.ts` — shims that re-export the runtime validator (keeps TypeScript rootDir safe).
- Entrypoints updated:
  - `bot/src/index.ts` — validates `TELEGRAM_BOT_TOKEN` at startup.
  - `api/src/index.ts` — validates `PORT` and `REDIS_URL` at startup.
  - `worker/src/main.ts` — validates `POKEMON_TCG_API_KEY`, `PRICE_TRACKER_API_KEY`, `DEEPSEEK_API_KEY` at startup.
- Normalized `.gitignore` to ensure `.env` is ignored.

How to test locally
-------------------
1. Create a local `.env` file in the repo root with the required keys (do not commit):

   PORT=3000
   REDIS_URL=redis://localhost:6379
   TELEGRAM_BOT_TOKEN=xxx
   POKEMON_TCG_API_KEY=xxx
   PRICE_TRACKER_API_KEY=xxx
   DEEPSEEK_API_KEY=xxx

2. Run the env self-test:

```bash
node ./scripts/validate-env-selftest.js
```

You should see: "✅ Env self-test passed"

CI
--
I originally added a GitHub Actions workflow to run the self-test on PRs but removed it from this branch because the push was blocked by token scope. Please add the workflow via the GitHub UI or with a token that has `workflow` scope when creating the PR.

Notes
-----
- If you'd like a single shared TypeScript module rather than runtime `require` + shims, we can convert the validator into a workspace package and add types.
- I recommend rotating any real keys if you discover they were previously committed.

Checklist for reviewers
----------------------
- [ ] Confirm `.env.example` contains no real secrets
- [ ] Run `node ./scripts/validate-env-selftest.js` locally
- [ ] Review entrypoint wiring for early validation
