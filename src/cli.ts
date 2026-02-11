#!/usr/bin/env npx tsx
/**
 * bit — Bitcoin CLI for the PATH Protocol
 *
 * Usage:
 *   bit init              Scaffold .bit.yaml for a new project
 *   bit push              git push + inscribe changed content on BSV
 *   bit register <domain> Inscribe a domain on DNS-DEX
 *   bit status            Show Bitcoin state for this project
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load .env.local from cwd, then .env
const cwd = process.cwd();
for (const envFile of ['.env.local', '.env']) {
  const p = resolve(cwd, envFile);
  if (existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'init': {
      const { init } = await import('./commands/init.js');
      await init();
      break;
    }
    case 'push': {
      const { push } = await import('./commands/push.js');
      await push(args.slice(1));
      break;
    }
    case 'register': {
      const domain = args[1];
      if (!domain) {
        console.error('Usage: bit register <domain>');
        process.exit(1);
      }
      const { register } = await import('./commands/register.js');
      await register(domain, args.slice(2));
      break;
    }
    case 'status': {
      const { status } = await import('./commands/status.js');
      await status();
      break;
    }
    case '--help':
    case '-h':
    case undefined: {
      const { showBanner } = await import('./banner.js');
      showBanner();
      console.log(`Commands:
  bit init                Scaffold .bit.yaml for a new project
  bit push                git push + inscribe changed content on BSV
  bit register <domain>   Inscribe a domain on DNS-DEX
  bit status              Show Bitcoin state for this project

Options:
  --help, -h   Show this help
  --version    Show version

Examples:
  bit init
  bit push
  bit push --dry-run
  bit register kwegwong.com
  bit status
`);
      break;
    }
    case '--version': {
      const { readFileSync } = await import('fs');
      const { resolve } = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = resolve(fileURLToPath(import.meta.url), '..');
      const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
      console.log(pkg.version);
      break;
    }
    default: {
      console.error(`Unknown command: ${command}`);
      console.error('Run `bit --help` for usage.');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message || err);
  process.exit(1);
});
