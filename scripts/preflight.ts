import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
];

for (const c of checks) {
  try {
    c.run();
  } catch (e: any) {
    fail(`${c.name} failed: ${e?.message || e}`);
  }
}

ok('Preflight OK');
