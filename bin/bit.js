#!/usr/bin/env node

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, '..', 'src', 'cli.ts');

// Use tsx to run the TypeScript CLI
try {
  const require = createRequire(import.meta.url);
  const tsxBin = resolve(dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');

  execFileSync('node', [tsxBin, cliPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });
} catch (err) {
  // Fallback: try npx tsx
  try {
    execFileSync('npx', ['tsx', cliPath, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: process.env,
    });
  } catch {
    console.error('bitgit requires tsx. Install it: npm install -g tsx');
    process.exit(1);
  }
}
