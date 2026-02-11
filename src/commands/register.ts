/**
 * bit register <domain> — inscribe a domain on DNS-DEX
 */

import { createHash } from 'crypto';
import { PrivateKey } from '@bsv/sdk';
import { loadConfig, resolvePrivateKey } from '../config.js';
import { selectUtxo } from '../bsv/utxo.js';
import { buildInscriptionTx } from '../bsv/tx.js';
import { buildOpReturn } from '../bsv/script.js';
import { broadcast } from '../bsv/broadcast.js';
import { getDb } from '../db.js';

export async function register(domain: string, args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const supply = parseInt(args.find((a) => a.startsWith('--supply='))?.split('=')[1] || '1000000000');
  const category = args.find((a) => a.startsWith('--category='))?.split('=')[1] || 'other';

  let config;
  try {
    config = loadConfig();
  } catch {
    // No config — use env vars directly
    config = null;
  }

  console.log(`bit register — inscribing ${domain} on DNS-DEX`);
  if (dryRun) console.log('  (dry run)\n');

  const ts = new Date().toISOString();
  const tick = `$${domain}`;

  // In dry-run mode, skip key resolution if no key available
  let wif: string | undefined;
  let address = '(no key configured)';
  try {
    wif = config ? resolvePrivateKey(config) : (
      process.env.BSV_PRIVATE_KEY ||
      undefined
    );
    if (wif) {
      const privateKey = PrivateKey.fromWif(wif);
      address = privateKey.toPublicKey().toAddress();
    }
  } catch {}

  if (!wif && !dryRun) {
    console.error('No private key found. Set BSV_PRIVATE_KEY or wallet.key_env in .bit.yaml.');
    process.exit(1);
  }

  // Build DNS-DEX inscription document
  const doc = {
    p: 'dnsdex-domain',
    v: '1.0',
    op: 'mint',
    tick,
    domain,
    supply,
    owner: {
      wallet: config?.dns_dex?.token_symbol || tick,
      type: 'treasury_key',
    },
    x402: {
      fee_cents: 1,
      initial_price: 0,
    },
    meta: {
      category,
      description: `https://${domain}`,
      timestamp: ts,
    },
    verification: {
      method: 'treasury_key',
      proof: createHash('sha256')
        .update(`${domain}:${address}:${ts}`)
        .digest('hex')
        .slice(0, 32),
      verified_at: ts,
    },
    platform: 'dns-dex.com',
  };

  const payload = JSON.stringify(doc);
  const contentHash = createHash('sha256').update(payload).digest('hex');

  console.log(`Treasury: ${address}`);
  console.log(`Tick: ${tick} | Supply: ${supply.toLocaleString()} | Category: ${category}`);
  console.log(`Payload: ${payload.length} bytes\n`);

  if (dryRun) {
    console.log('Dry run — would inscribe:');
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  const privateKey = PrivateKey.fromWif(wif!);

  const utxo = await selectUtxo(address);
  const opReturnScript = buildOpReturn('dnsdex-domain', 'application/json', payload);

  const { tx, fee, changeSats } = await buildInscriptionTx({
    privateKey,
    utxo,
    opReturnScript,
    payloadSize: payload.length,
  });

  const txid = await broadcast(tx.toHex());
  const origin = `${txid}_0`;
  const inscriptionId = `${txid}i0`;

  console.log('Domain inscribed on BSV!');
  console.log(`  TXID:       ${txid}`);
  console.log(`  Origin:     ${origin}`);
  console.log(`  Fee:        ${fee} sats`);
  console.log(`  Explorer:   https://whatsonchain.com/tx/${txid}`);
  console.log(`  Ordinal:    https://1satordinals.com/inscription/${inscriptionId}`);

  // Update DB
  try {
    const db = getDb(config || undefined);
    const { error } = await db
      .from('dnsdex_domains')
      .upsert({
        domain,
        status: 'active',
        bsv_txid: txid,
        bsv_origin: origin,
        inscription_id: inscriptionId,
        content_hash: contentHash,
        verification_method: 'treasury_key',
        verified_at: ts,
        updated_at: ts,
      }, { onConflict: 'domain' });

    if (error) {
      console.log(`\nDB update failed: ${error.message}`);
    } else {
      console.log(`\nDB: ${domain} → active`);
    }
  } catch (err: any) {
    console.log(`\nDB not available: ${err.message}`);
  }

  // Print DNS records to add
  console.log(`\nAdd these DNS TXT records for ${domain}:`);
  console.log(`  _dnsdex.${domain}              →  dnsdex-verify=${txid}`);
  console.log(`  _dnsdex-verification.${domain}  →  ${doc.verification.proof}`);
}
