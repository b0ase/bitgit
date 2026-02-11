/**
 * bit status — show Bitcoin state for this project
 */

import { PrivateKey } from '@bsv/sdk';
import { loadConfig, resolvePrivateKey } from '../config.js';
import { fetchUtxos } from '../bsv/utxo.js';
import { getDb } from '../db.js';

export async function status(): Promise<void> {
  const config = loadConfig();

  console.log(`bit status — ${config.project.name}\n`);

  // Wallet info
  let address: string;
  try {
    const wif = resolvePrivateKey(config);
    const privateKey = PrivateKey.fromWif(wif);
    address = privateKey.toPublicKey().toAddress();

    const utxos = await fetchUtxos(address);
    const totalSats = utxos.reduce((sum, u) => sum + u.satoshis, 0);

    console.log('Wallet:');
    console.log(`  Address:  ${address}`);
    console.log(`  UTXOs:    ${utxos.length}`);
    console.log(`  Balance:  ${totalSats.toLocaleString()} sats`);
    console.log();
  } catch (err: any) {
    console.log(`Wallet: not configured (${err.message})\n`);
    address = '';
  }

  // Domain info
  if (config.project.domain) {
    console.log('Domain:');
    console.log(`  Name:     ${config.project.domain}`);

    // Check DNS-DEX registration
    try {
      const db = getDb(config);
      const { data } = await db
        .from('dnsdex_domains')
        .select('status, bsv_txid, verified_at')
        .eq('domain', config.project.domain)
        .maybeSingle();

      if (data) {
        console.log(`  DNS-DEX:  ${data.status}`);
        if (data.bsv_txid) {
          console.log(`  TXID:     ${data.bsv_txid}`);
          console.log(`  Explorer: https://whatsonchain.com/tx/${data.bsv_txid}`);
        }
      } else {
        console.log('  DNS-DEX:  not registered');
      }
    } catch {
      console.log('  DNS-DEX:  (DB not available)');
    }

    // Check DNS TXT records
    try {
      const { execSync } = await import('child_process');
      const txt = execSync(`dig +short TXT _dnsdex.${config.project.domain} 2>/dev/null`, {
        encoding: 'utf8',
      }).trim();
      console.log(`  DNS TXT:  ${txt || '(not set)'}`);
    } catch {
      console.log('  DNS TXT:  (could not resolve)');
    }

    console.log();
  }

  // Token info
  if (config.project.token) {
    console.log('Token:');
    console.log(`  Symbol:   ${config.project.token}`);

    try {
      const db = getDb(config);
      const { data } = await db
        .from('path402_tokens')
        .select('id, name, total_supply, current_supply, base_price_sats, deploy_txid')
        .eq('symbol', config.project.token)
        .maybeSingle();

      if (data) {
        console.log(`  Name:     ${data.name}`);
        console.log(`  Supply:   ${data.current_supply}/${data.total_supply}`);
        console.log(`  Price:    ${data.base_price_sats} sats`);
        if (data.deploy_txid) {
          console.log(`  On-chain: https://whatsonchain.com/tx/${data.deploy_txid}`);
        }

        // Holder count
        const { count } = await db
          .from('path402_holdings')
          .select('*', { count: 'exact', head: true })
          .eq('token_id', data.id)
          .gt('balance', 0);

        console.log(`  Holders:  ${count || 0}`);
      } else {
        console.log('  (not found in path402_tokens)');
      }
    } catch {
      console.log('  (DB not available)');
    }

    console.log();
  }

  // Version chain
  console.log('Version chain:');
  try {
    const db = getDb(config);
    const versionTable = config.db?.version_table || 'blog_post_versions';
    const { data, error } = await db
      .from(versionTable)
      .select('file_path, content_hash, inscription_txid, created_at')
      .eq('project', config.project.name)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log(`  (query failed: ${error.message})`);
    } else if (!data || data.length === 0) {
      console.log('  No inscriptions yet. Run `bit push` to inscribe content.');
    } else {
      console.log(`  Latest ${data.length} inscription(s):`);
      for (const row of data) {
        const date = new Date(row.created_at).toISOString().split('T')[0];
        console.log(`  ${date}  ${row.file_path || '(unknown)'}`);
        console.log(`          ${row.inscription_txid}`);
      }
    }
  } catch {
    console.log('  (DB not available)');
  }

  // Content source
  console.log(`\nConfig:`);
  console.log(`  Source:   ${config.content.source}`);
  console.log(`  Format:   ${config.content.format}`);
  console.log(`  Protocol: ${config.content.protocol}`);
}
