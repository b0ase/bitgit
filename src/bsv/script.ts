/**
 * OP_RETURN script builders
 *
 * Two formats:
 * 1. Simple: OP_FALSE OP_RETURN <protocol> <content-type> <payload>
 * 2. Bitcoin Schema: B + MAP + AIP (Bitcom protocols)
 *
 * Extracted from lib/blog-inscription.ts.
 */

import { PrivateKey, Script } from '@bsv/sdk';

// Bitcom protocol addresses
const B_PROTOCOL = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut';
const MAP_PROTOCOL = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';
const AIP_PROTOCOL = '15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva';

/**
 * Simple OP_RETURN: protocol tag + content-type + payload
 */
export function buildOpReturn(
  protocol: string,
  contentType: string,
  payload: string,
): Script {
  const script = new Script();
  script.writeOpCode(0);   // OP_FALSE
  script.writeOpCode(106); // OP_RETURN
  script.writeBin(Buffer.from(protocol, 'utf8'));
  script.writeBin(Buffer.from(contentType, 'utf8'));
  script.writeBin(Buffer.from(payload, 'utf8'));
  return script;
}

/**
 * Bitcoin Schema OP_RETURN: B (content) + MAP (metadata) + AIP (signature)
 *
 * @param content     - raw content (markdown, JSON, etc.)
 * @param contentType - MIME type (e.g. 'text/markdown', 'application/json')
 * @param mapData     - key-value pairs for MAP protocol indexing
 * @param signingKey  - optional PrivateKey for AIP authorship proof
 */
export function buildBitcoinSchema(
  content: string,
  contentType: string,
  mapData: Record<string, string>,
  signingKey?: PrivateKey,
): Script {
  const script = new Script();
  const contentBytes = Buffer.from(content, 'utf8');

  script.writeOpCode(0);   // OP_FALSE
  script.writeOpCode(106); // OP_RETURN

  // --- B Protocol: content ---
  script.writeBin(Buffer.from(B_PROTOCOL, 'utf8'));
  script.writeBin(contentBytes);
  script.writeBin(Buffer.from(contentType, 'utf8'));
  script.writeBin(Buffer.from('utf-8', 'utf8'));

  // --- Pipe separator ---
  script.writeBin(Buffer.from('|', 'utf8'));

  // --- MAP Protocol: metadata ---
  script.writeBin(Buffer.from(MAP_PROTOCOL, 'utf8'));
  script.writeBin(Buffer.from('SET', 'utf8'));

  // Collect buffers for AIP signing payload
  const sigParts: Buffer[] = [
    Buffer.from(B_PROTOCOL),
    contentBytes,
    Buffer.from(contentType),
    Buffer.from('utf-8'),
    Buffer.from('|'),
    Buffer.from(MAP_PROTOCOL),
    Buffer.from('SET'),
  ];

  for (const [key, value] of Object.entries(mapData)) {
    script.writeBin(Buffer.from(key, 'utf8'));
    script.writeBin(Buffer.from(value, 'utf8'));
    sigParts.push(Buffer.from(key), Buffer.from(value));
  }

  // --- Pipe separator ---
  script.writeBin(Buffer.from('|', 'utf8'));
  sigParts.push(Buffer.from('|'));

  // --- AIP Protocol: authorship proof ---
  if (signingKey) {
    const address = signingKey.toPublicKey().toAddress();
    const signingPayload = Buffer.concat(sigParts);
    const signature = signingKey.sign(Array.from(signingPayload));
    const sigBase64 = signature.toDER('base64') as string;

    script.writeBin(Buffer.from(AIP_PROTOCOL, 'utf8'));
    script.writeBin(Buffer.from('BITCOIN_ECDSA', 'utf8'));
    script.writeBin(Buffer.from(address, 'utf8'));
    script.writeBin(Buffer.from(sigBase64, 'utf8'));
  }

  return script;
}
