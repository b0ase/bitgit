/**
 * Transaction broadcast with multi-provider fallback
 *
 * Chain: WhatsOnChain → GorillaPool ARC → TAAL ARC
 * Extracted from 8+ identical copies across b0ase.com.
 */

const WHATSONCHAIN_API = 'https://api.whatsonchain.com/v1/bsv/main';
const GORILLAPOOL_ARC = 'https://arc.gorillapool.io/v1/tx';
const TAAL_ARC = 'https://arc.taal.com/v1/tx';

/**
 * Broadcast a signed transaction to the BSV network.
 * Tries WoC first, then GorillaPool ARC, then TAAL ARC.
 * Always trims the returned TXID.
 */
export async function broadcast(rawTx: string): Promise<string> {
  // 1. WhatsOnChain
  const wocRes = await fetch(`${WHATSONCHAIN_API}/tx/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txhex: rawTx }),
  });
  if (wocRes.ok) {
    return (await wocRes.text()).replace(/"/g, '').trim();
  }
  const wocErr = await wocRes.text();

  // 2. GorillaPool ARC (binary)
  const gpRes = await fetch(GORILLAPOOL_ARC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: Buffer.from(rawTx, 'hex'),
  });
  if (gpRes.ok) {
    const data = await gpRes.json();
    return (data.txid || '').trim();
  }
  const gpErr = await gpRes.text();

  // 3. TAAL ARC (binary)
  const taalRes = await fetch(TAAL_ARC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: Buffer.from(rawTx, 'hex'),
  });
  if (taalRes.ok) {
    const data = await taalRes.json();
    return (data.txid || '').trim();
  }
  const taalErr = await taalRes.text();

  throw new Error(
    `Broadcast failed on all providers:\n  WoC: ${wocErr}\n  GorillaPool: ${gpErr}\n  TAAL: ${taalErr}`,
  );
}
