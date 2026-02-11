/**
 * Transaction building for OP_RETURN inscriptions
 *
 * Handles the mock-source-tx pattern and the sourceTXID overwrite bug.
 * Extracted from 12+ identical copies across b0ase.com.
 */

import { PrivateKey, Transaction, P2PKH, Script } from '@bsv/sdk';
import type { UTXO } from './utxo.js';

export interface InscriptionTxResult {
  tx: Transaction;
  txid: string;
  fee: number;
  changeSats: number;
}

/**
 * Build a signed transaction with an OP_RETURN data output.
 *
 * @param privateKey  - signing key
 * @param utxo        - input UTXO
 * @param opReturnScript - pre-built OP_RETURN script (from script.ts)
 * @param feeRate     - sats per byte (default 0.5)
 * @param payloadSize - estimated payload size for fee calc (if 0, uses 500 byte estimate)
 */
export async function buildInscriptionTx(opts: {
  privateKey: PrivateKey;
  utxo: UTXO;
  opReturnScript: Script;
  feeRate?: number;
  payloadSize?: number;
}): Promise<InscriptionTxResult> {
  const { privateKey, utxo, opReturnScript, feeRate = 0.5, payloadSize = 0 } = opts;
  const address = privateKey.toPublicKey().toAddress();

  const tx = new Transaction();

  // Build mock source transaction for SIGHASH verification.
  // We only need enough outputs to reach the UTXO's vout index.
  const mockSourceTx = new Transaction();
  for (let i = 0; i <= utxo.vout; i++) {
    mockSourceTx.addOutput({
      lockingScript: i === utxo.vout ? utxo.script : new Script(),
      satoshis: i === utxo.vout ? utxo.satoshis : 1,
    });
  }

  tx.addInput({
    sourceTXID: utxo.txid,
    sourceOutputIndex: utxo.vout,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey),
    sourceTransaction: mockSourceTx,
  });

  // CRITICAL: addInput() overwrites sourceTXID when sourceTransaction is provided.
  // Must re-set it after addInput().
  tx.inputs[0].sourceTXID = utxo.txid;

  // OP_RETURN output (0 satoshis)
  tx.addOutput({
    lockingScript: opReturnScript,
    satoshis: 0,
  });

  // Fee calculation
  const estimatedSize = (payloadSize || 500) + 200; // payload + tx overhead
  const fee = Math.max(500, Math.ceil(estimatedSize * feeRate));
  const changeSats = utxo.satoshis - fee;

  if (changeSats < 0) {
    throw new Error(
      `Insufficient sats for fee. Need ${fee}, have ${utxo.satoshis}`,
    );
  }

  // Change output
  if (changeSats > 0) {
    tx.addOutput({
      lockingScript: new P2PKH().lock(address),
      satoshis: changeSats,
    });
  }

  await tx.sign();

  const txid = tx.id('hex') as string;

  return { tx, txid, fee, changeSats };
}
