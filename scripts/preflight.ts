import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

type Check = { name: string; run: () => void };

function ok(msg: string) {
  console.log(`✔ ${msg}`);
}
function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const root = process.cwd();
dotenv.config({ path: join(root, '.env') });

const checks: Check[] = [
  {
    name: 'Node.js version',
    run: () => {
      const [major] = process.versions.node.split('.').map((x) => parseInt(x, 10));
      const min = 18;
      if (Number.isNaN(major) || major < min) {
        fail(`Node ${min}+ required, found ${process.versions.node}`);
      }
      ok(`Node ${process.versions.node}`);
    },
  },
  {
    name: 'pnpm available',
    run: () => {
      const v = execSync('pnpm --version', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      ok(`pnpm ${v}`);
    },
  },
  {
    name: 'worker depends on @pokedao/shared via workspace',
    run: () => {
      const pkg = readJson(join(root, 'worker', 'package.json'));
      const dep = pkg?.dependencies?.['@pokedao/shared'];
      if (!dep || !String(dep).startsWith('workspace:')) {
        fail('worker/package.json must depend on "@pokedao/shared": "workspace:*"');
      }
      ok(`worker -> @pokedao/shared (${dep})`);
    },
  },
  {
    name: 'no direct relative imports of packages/shared in worker',
    run: () => {
      const src = readFileSync(join(root, 'worker', 'src', 'featurizer.ts'), 'utf8') +
        '\n' + readFileSync(join(root, 'worker', 'src', 'scorer.ts'), 'utf8');
      const bad = src.match(/\.\.\/\.\.\/packages\/shared\//g);
      if (bad) {
        fail('Found relative imports to ../../packages/shared in worker sources');
      }
      ok('imports use @pokedao/shared');
    },
  },
  {
    name: 'shared package is ESM and exposes dist types',
    run: () => {
      const shared = readJson(join(root, 'packages', 'shared', 'package.json'));
      if (shared.type !== 'module') fail('packages/shared/package.json must set "type": "module"');
      if (shared.main !== 'dist/index.js') fail('packages/shared/package.json main must be dist/index.js');
      if (shared.types !== 'dist/index.d.ts') fail('packages/shared/package.json types must be dist/index.d.ts');
      ok('packages/shared configured (type/main/types)');
    },
  },
  {
    name: 'Prisma client installed',
    run: () => {
      const p1 = existsSync(join(root, 'node_modules', '.pnpm'));
      const clientOk = (() => {
        try {
          // Resolution check only; do not import code
          const path = require.resolve('@prisma/client', { paths: [root] });
          return !!path;
        } catch {
          return false;
        }
      })();
      if (!p1 || !clientOk) fail('Prisma client not installed. Run: pnpm i && pnpm --filter api prisma generate');
      ok('Prisma client present');
    },
  },
  {
    name: 'Ollama reachable',
    run: () => {
      const base = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      try {
        const out = execSync(`curl -fsS ${base}/api/tags`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
        const json = JSON.parse(out);
        const model = process.env.QWEN_MODEL || 'qwen2.5:7b-instruct';
        const has = Array.isArray(json?.models) && json.models.some((m: any) => String(m?.name || '').includes(model.split(':')[0]));
        ok(`Ollama at ${base}${has ? ` (model present: ${model})` : ''}`);
      } catch {
        console.log('✖ Ollama not reachable (optional for AI parsing)');
      }
    },
  },
  {
    name: 'eBay APP ID presence',
    run: () => {
      if (process.env.EBAY_APP_ID) {
        console.log('✔ eBay APP ID present');
      } else {
        console.log('⚠ eBay APP ID missing (collector will be skipped)');
      }
    },
  },
];

for (const c of checks) {
  try {
    c.run();
  } catch (e: any) {
    fail(`${c.name} failed: ${e?.message || e}`);
  }
}

ok('Preflight OK');
