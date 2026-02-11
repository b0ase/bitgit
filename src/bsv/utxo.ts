/**
 * UTXO fetching from WhatsOnChain
 *
 * Extracted from 10+ identical copies across b0ase.com scripts.
 */

import { Script, P2PKH } from '@bsv/sdk';

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';
const FETCH_TIMEOUT_MS = 30_000;

export interface UTXO {
  txid: string;
  vout: number;
  satoshis: number;
  script: Script;
}

/** Raw shape returned by WhatsOnChain API */
interface WocUtxo {
  tx_hash: string;
  tx_pos: number;
  value: number;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Fetch all UTXOs for an address, sorted largest-first.
 */
export async function fetchUtxos(address: string): Promise<UTXO[]> {
  const url = `${WHATSONCHAIN_API}/address/${address}/unspent`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
  }

  const raw: WocUtxo[] = await response.json();
  const lockScript = new P2PKH().lock(address);

  return raw
    .sort((a, b) => b.value - a.value)
    .map((u) => ({
      txid: u.tx_hash,
      vout: u.tx_pos,
      satoshis: u.value,
      script: lockScript,
    }));
}

/**
 * Select a single UTXO with at least `minSats` satoshis.
 * Optionally exclude specific txids (e.g. unconfirmed change).
 */
export async function selectUtxo(
  address: string,
  minSats = 1000,
  excludeTxids: string[] = [],
): Promise<UTXO> {
  const utxos = await fetchUtxos(address);
  const eligible = utxos.filter(
    (u) => u.satoshis >= minSats && !excludeTxids.includes(u.txid),
  );

  if (eligible.length === 0) {
    throw new Error(
      `No UTXO with >= ${minSats} sats. Found ${utxos.length} total UTXOs.`,
    );
  }

  return eligible[0]; // largest first
}
