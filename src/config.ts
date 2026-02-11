/**
 * .bit.yaml config parser
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

export interface BitConfig {
  project: {
    name: string;
    domain?: string;
    token?: string;
  };
  wallet: {
    key_env?: string;
    key_file?: string;
  };
  content: {
    type: 'blog' | 'repo' | 'domain' | 'custom';
    source: string;
    format: 'op_return' | 'bitcoin_schema';
    protocol: string;
  };
  db?: {
    supabase_url_env: string;
    supabase_key_env: string;
    version_table?: string;
  };
  dns_dex?: {
    token_symbol?: string;
    verification_code?: string;
  };
}

const CONFIG_FILENAME = '.bit.yaml';

/**
 * Find and load .bit.yaml from cwd or parent directories.
 */
export function loadConfig(cwd = process.cwd()): BitConfig {
  let dir = resolve(cwd);

  while (true) {
    const configPath = resolve(dir, CONFIG_FILENAME);
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf8');
      return parseYaml(raw) as BitConfig;
    }

    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  throw new Error(
    `No ${CONFIG_FILENAME} found. Run \`bit init\` to create one.`,
  );
}

/**
 * Resolve the WIF private key from config.
 * Checks env var name from config, then falls back to common names.
 */
export function resolvePrivateKey(config: BitConfig): string {
  // From config wallet.key_env
  if (config.wallet.key_env) {
    const wif = process.env[config.wallet.key_env];
    if (wif) return wif;
  }

  // From config wallet.key_file
  if (config.wallet.key_file) {
    const keyPath = config.wallet.key_file.replace('~', process.env.HOME || '');
    if (existsSync(keyPath)) {
      return readFileSync(keyPath, 'utf8').trim();
    }
  }

  // Fallback: generic env var
  const wif = process.env.BSV_PRIVATE_KEY;
  if (wif) return wif;

  throw new Error(
    'No private key found. Set wallet.key_env in .bit.yaml or BSV_PRIVATE_KEY env var.',
  );
}

/**
 * Get the config file path for a directory (even if it doesn't exist yet).
 */
export function configPath(cwd = process.cwd()): string {
  return resolve(cwd, CONFIG_FILENAME);
}
