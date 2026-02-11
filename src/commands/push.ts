/**
 * bit push — git push + inscribe changed content on BSV
 *
 * 1. git push to remote (if commits to push)
 * 2. Detect changes since last inscription (git diff)
 * 3. Inscribe changed content on BSV
 * 4. Update version chain in DB
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, relative } from 'path';
import { createHash } from 'crypto';
import { PrivateKey } from '@bsv/sdk';
import { loadConfig, resolvePrivateKey } from '../config.js';
import { fetchUtxos, type UTXO } from '../bsv/utxo.js';
import { buildInscriptionTx } from '../bsv/tx.js';
import { buildOpReturn, buildBitcoinSchema } from '../bsv/script.js';
import { broadcast } from '../bsv/broadcast.js';
import { getDb } from '../db.js';

export async function push(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const skipGit = args.includes('--skip-git');
  const config = loadConfig();
  const cwd = process.cwd();

  console.log(`bit push — ${config.project.name}`);
  if (dryRun) console.log('  (dry run — no transactions will be broadcast)\n');

  // 1. Git push
  if (!skipGit) {
    try {
      const status = execSync('git status --porcelain', { cwd, encoding: 'utf8' }).trim();
      if (status) {
        console.log('Warning: uncommitted changes exist. Pushing what is committed.\n');
      }

      // Check if there are commits to push
      try {
        const ahead = execSync('git rev-list --count @{upstream}..HEAD', {
          cwd,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (parseInt(ahead) > 0) {
          console.log(`Pushing ${ahead} commit(s) to remote...`);
          if (!dryRun) {
            execSync('git push', { cwd, stdio: 'inherit' });
          }
          console.log();
        } else {
          console.log('Git: up to date with remote.\n');
        }
      } catch {
        // No upstream tracking — skip git push
        console.log('Git: no upstream branch. Skipping git push.\n');
      }
    } catch (err: any) {
      console.log(`Git push failed: ${err.message}. Continuing with inscription.\n`);
    }
  }

  // 2. Find changed content
  const sourceDir = resolve(cwd, config.content.source);
  if (!existsSync(sourceDir)) {
    console.error(`Content source not found: ${config.content.source}`);
    process.exit(1);
  }

  // Get last inscribed commit from DB (if configured)
  let lastInscribedCommit: string | null = null;
  let db;
  try {
    db = getDb(config);
    const versionTable = config.db?.version_table || 'blog_post_versions';
    const { data } = await db
      .from(versionTable)
      .select('content_hash, inscription_txid')
      .eq('project', config.project.name)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.inscription_txid) {
      console.log(`Last inscription: ${data.inscription_txid}`);
    }
  } catch {
    // DB not available — inscribe everything in source
  }

  // Find files to inscribe
  let filesToInscribe: string[] = [];

  try {
    // Try git diff to find changes
    const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null || echo ""', {
      cwd,
      encoding: 'utf8',
    }).trim();

    const diffBase = lastTag || 'HEAD~1';
    const diff = execSync(`git diff --name-only ${diffBase} -- "${config.content.source}"`, {
      cwd,
      encoding: 'utf8',
    }).trim();

    if (diff) {
      filesToInscribe = diff.split('\n').filter((f) => existsSync(resolve(cwd, f)));
    }
  } catch {
    // No git history — fall through
  }

  // If no git diff results, use all files in source directory
  if (filesToInscribe.length === 0) {
    try {
      const allFiles = execSync(`find "${sourceDir}" -type f -name "*.md" -o -name "*.json" | sort`, {
        cwd,
        encoding: 'utf8',
      }).trim();
      if (allFiles) {
        filesToInscribe = allFiles.split('\n').map((f) => relative(cwd, f));
      }
    } catch {}
  }

  if (filesToInscribe.length === 0) {
    console.log('No content files found to inscribe.');
    return;
  }

  console.log(`Found ${filesToInscribe.length} file(s) to inscribe:`);
  filesToInscribe.forEach((f) => console.log(`  ${f}`));
  console.log();

  if (dryRun) {
    console.log('Dry run — skipping inscription.');
    return;
  }

  // 3. Inscribe on BSV
  const wif = resolvePrivateKey(config);
  const privateKey = PrivateKey.fromWif(wif);
  const address = privateKey.toPublicKey().toAddress();

  console.log(`Treasury: ${address}`);

  const utxos = await fetchUtxos(address);
  if (utxos.length === 0) {
    console.error('No UTXOs found. Fund the treasury address first.');
    process.exit(1);
  }

  let currentUtxo = utxos[0];
  let totalFees = 0;
  const results: { file: string; txid: string }[] = [];

  for (let i = 0; i < filesToInscribe.length; i++) {
    const filePath = resolve(cwd, filesToInscribe[i]);
    const content = readFileSync(filePath, 'utf8');
    const contentHash = createHash('sha256').update(content).digest('hex');

    console.log(`[${i + 1}/${filesToInscribe.length}] ${filesToInscribe[i]} (${content.length} bytes)`);

    // Build OP_RETURN script based on format
    let opReturnScript;
    const payloadSize = content.length;

    if (config.content.format === 'bitcoin_schema') {
      const mapData: Record<string, string> = {
        app: config.project.domain || config.project.name,
        type: config.content.type,
        file: filesToInscribe[i],
        hash: contentHash,
      };

      // Extract slug from filename for blog posts
      if (config.content.type === 'blog') {
        const slug = filesToInscribe[i]
          .replace(/^.*\//, '')
          .replace(/\.md$/, '');
        mapData.slug = slug;
      }

      opReturnScript = buildBitcoinSchema(
        content,
        content.endsWith('.json') ? 'application/json' : 'text/markdown',
        mapData,
        privateKey,
      );
    } else {
      const payload = JSON.stringify({
        protocol: config.content.protocol,
        file: filesToInscribe[i],
        hash: contentHash,
        content,
        timestamp: new Date().toISOString(),
      });
      opReturnScript = buildOpReturn(
        config.content.protocol,
        'application/json',
        payload,
      );
    }

    try {
      const { tx, fee, changeSats } = await buildInscriptionTx({
        privateKey,
        utxo: currentUtxo,
        opReturnScript,
        payloadSize,
      });

      const rawTx = tx.toHex();
      const txid = await broadcast(rawTx);

      totalFees += fee;
      results.push({ file: filesToInscribe[i], txid });

      console.log(`  TXID: ${txid}`);
      console.log(`  Fee: ${fee} sats | Remaining: ${changeSats} sats`);
      console.log(`  https://whatsonchain.com/tx/${txid}`);

      // 4. Update version chain in DB
      if (db && config.db?.version_table) {
        try {
          await db.from(config.db.version_table).insert({
            project: config.project.name,
            file_path: filesToInscribe[i],
            content_hash: contentHash,
            inscription_txid: txid,
            created_at: new Date().toISOString(),
          });
        } catch (dbErr: any) {
          console.log(`  DB update failed: ${dbErr.message}`);
        }
      }

      // Chain: use change output as next input
      currentUtxo = {
        txid,
        vout: 1, // change is output index 1 (after OP_RETURN at 0)
        satoshis: changeSats,
        script: currentUtxo.script,
      };

      // Small delay for mempool propagation
      if (i < filesToInscribe.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (err: any) {
      console.log(`  FAILED: ${err.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Inscribed: ${results.length}/${filesToInscribe.length} files`);
  console.log(`Total fees: ${totalFees} sats`);

  if (results.length > 0) {
    console.log('\nInscriptions:');
    results.forEach((r) => console.log(`  ${r.file} → ${r.txid}`));
  }
}
