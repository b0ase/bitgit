/**
 * bit init — scaffold .bit.yaml + .well-known/path402.json
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, basename } from 'path';
import { stringify as toYaml } from 'yaml';
import { configPath, type BitConfig } from '../config.js';
import * as readline from 'readline';

function ask(prompt: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${prompt}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function detectProjectName(): string {
  const cwd = process.cwd();

  // Try package.json
  const pkgPath = resolve(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name.replace(/^@[^/]+\//, '');
    } catch {}
  }

  // Try git remote
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    const match = remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {}

  // Fall back to directory name
  return basename(cwd);
}

export async function init(): Promise<void> {
  const cfgPath = configPath();
  if (existsSync(cfgPath)) {
    console.log('.bit.yaml already exists. Delete it first to re-initialize.');
    return;
  }

  console.log('bit init — setting up Bitcoin config for this project\n');

  const detectedName = detectProjectName();
  const name = await ask('Project name', detectedName);
  const domain = await ask('Domain (optional)');
  const token = await ask('Token symbol (optional)');
  const contentType = await ask('Content type (blog/repo/domain/custom)', 'blog') as BitConfig['content']['type'];
  const source = await ask(
    'Content source directory',
    contentType === 'blog' ? 'content/blog/' : contentType === 'repo' ? '.' : '',
  );
  const format = await ask('Inscription format (bitcoin_schema/op_return)', 'bitcoin_schema') as BitConfig['content']['format'];

  const config: BitConfig = {
    project: {
      name,
      ...(domain ? { domain } : {}),
      ...(token ? { token } : {}),
    },
    wallet: {
      key_env: 'BOASE_TREASURY_PRIVATE_KEY',
    },
    content: {
      type: contentType,
      source,
      format,
      protocol: `${name}-${contentType}`,
    },
    db: {
      supabase_url_env: 'NEXT_PUBLIC_SUPABASE_URL',
      supabase_key_env: 'SUPABASE_SERVICE_ROLE_KEY',
      version_table: 'blog_post_versions',
    },
    ...(domain
      ? {
          dns_dex: {
            token_symbol: token ? `$${token}` : `$${domain}`,
          },
        }
      : {}),
  };

  writeFileSync(cfgPath, toYaml(config), 'utf8');
  console.log(`\nCreated ${cfgPath}`);

  // Generate .well-known/path402.json
  if (domain) {
    const wellKnownDir = resolve(process.cwd(), 'public', '.well-known');
    mkdirSync(wellKnownDir, { recursive: true });

    const path402 = {
      name,
      domain,
      token: token || undefined,
      protocol: '$402',
      endpoints: {
        press: `https://${domain}/api/path402/press`,
        discover: `https://${domain}/api/path402/discover`,
      },
    };

    const wellKnownPath = resolve(wellKnownDir, 'path402.json');
    writeFileSync(wellKnownPath, JSON.stringify(path402, null, 2), 'utf8');
    console.log(`Created ${wellKnownPath}`);

    // Print DNS records
    console.log(`\nAdd these DNS TXT records for ${domain}:`);
    console.log(`  _path402.${domain}  →  v=path402; endpoint=https://${domain}/api/path402`);
    console.log(`  _dnsdex.${domain}   →  dnsdex-verify=pending`);
  }

  console.log('\nDone. Run `bit status` to verify, `bit push` to inscribe.');
}
