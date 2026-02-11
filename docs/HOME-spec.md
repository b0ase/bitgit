# $HOME — Identity Layer for bitgit

## The Product Stack

```
Bitcoin Corp ($BCORP)
│
├── PROTOCOL LAYER
│   ├── $401 (path401.com) ── Identity keychain protocol
│   ├── $402 (path402.com) ── Payment rail protocol
│   └── $403 (path403.com) ── Conditions machine protocol
│
├── DEVELOPER TOOLS
│   ├── bitgit (npmjs.com/package/bitgit)
│   │   └── bit push = content on-chain, signed with $HOME/$401
│   └── (future: bit-sdk — library for apps to integrate)
│
├── EXECUTIVE TOOLS
│   ├── bit-sign.online ── Signature + $401 binding
│   │   └── Sign with finger → links to $401 keychain → on-chain
│   ├── bitcoin-contracts ── Contract signing + inscription
│   └── bitcoin-shares ── Equity tokens + cap table on-chain
│
└── INFRASTRUCTURE
    ├── dns-dex.com ── Domain tokenization
    ├── b0ase.com ── Venture studio hub
    └── bitcoin-corp.com ── Corporate portal
```

## Two Audiences, One Protocol

| | Developers | Executives |
|---|---|---|
| **Product** | bitgit | bit-sign.online |
| **Action** | `bit push` | Sign with finger on phone |
| **Identity** | `$HOME/.401/` config | TLDraw canvas → $401 keychain |
| **On-chain** | AIP-signed inscription | Signature + commitment inscription |
| **Protocol** | $401 (same) | $401 (same) |
| **Marketing** | npm, GitHub, dev community | LinkedIn, boardrooms, investors |

Both products funnel into path401.com as the protocol page.

## $HOME Spec

### Directory Structure

```
$HOME/
├── .401/
│   ├── identity.json       # $401 chain state
│   ├── signing.key.enc     # AES-256 encrypted signing key
│   ├── authorities.json    # co-signers (KYC, company, government)
│   └── strands/
│       ├── github.json     # verified GitHub strand
│       ├── twitter.json    # verified Twitter strand
│       ├── email.json      # verified email strand
│       └── kyc.json        # authority-verified KYC strand
└── .bit.yaml               # (per-project, but can reference $HOME/.401/)
```

### identity.json

```json
{
  "$401": {
    "version": 1,
    "chain_txid": "abc123...def",
    "address": "1ABcDeFgHiJkLmNoPqRs...",
    "created": "2026-02-11T00:00:00Z",
    "strands": [
      {
        "type": "github",
        "handle": "b0ase",
        "verified_txid": "...",
        "verified_at": "2026-02-01"
      },
      {
        "type": "twitter",
        "handle": "b0ase",
        "verified_txid": "...",
        "verified_at": "2026-02-01"
      }
    ],
    "authorities": [
      {
        "name": "Bitcoin Corp",
        "type": "company",
        "co_sign_txid": "...",
        "trust_level": "employee",
        "signed_at": "2026-02-11"
      }
    ]
  }
}
```

### Trust Levels

```
Unsigned $401          = pseudonymous (self-attested strands only)
Self-signed strands    = "I proved I own this GitHub/Twitter/email"
Company co-signed      = "This company vouches for this person"
KYC co-signed          = "A regulated entity verified this person's real identity"
Government co-signed   = "Notarized" (future — digital notary)
```

Trust is additive. Each co-signature increases the weight.
The identity is portable — it's on BSV, not in any company's database.

## bitgit Integration

### Current: Treasury Key Signing

```
bit push → signs with BOASE_TREASURY_PRIVATE_KEY → project-level identity
```

### Future: $HOME Identity Signing

```
bit push → loads $HOME/.401/signing.key.enc
         → prompts for passphrase (or uses keychain)
         → AIP signature links to $401 chain
         → inscription is signed by a PERSON, not a project
```

### New Commands

```bash
bit id init              # create $HOME/.401/ and generate signing key
bit id link github       # verify GitHub ownership → add strand
bit id link twitter      # verify Twitter ownership → add strand
bit id link email        # verify email → add strand
bit id status            # show identity, strands, trust level
bit id export            # export $401 identity bundle (for backup/transfer)
```

### .bit.yaml Update

```yaml
wallet:
  key_env: BOASE_TREASURY_PRIVATE_KEY    # project treasury (funds)

identity:
  home: true                              # use $HOME/.401/ for AIP signing
  # OR
  key_env: PERSONAL_SIGNING_KEY           # explicit override
```

Two keys, two purposes:
- **Treasury key** = pays the miner fee (project-level)
- **Identity key** = signs the content (person-level, from $HOME/.401/)

## bit-sign.online Integration

### The Executive Flow

1. Executive opens bit-sign.online on phone
2. Document displayed (contract, commitment, cap table entry)
3. Executive signs with finger on TLDraw canvas
4. System captures:
   - Written signature (SVG path data)
   - Timestamp
   - Device fingerprint
   - Document hash
5. All packaged into a $401 signing ceremony:
   ```json
   {
     "p": "401-sign",
     "signer": "$401_chain_txid",
     "document_hash": "sha256...",
     "signature_svg": "<path data>",
     "timestamp": "2026-02-11T...",
     "device": "iPhone 15 Pro"
   }
   ```
6. Inscribed on BSV with AIP (linked to signer's $401)
7. Signer's $401 now has a new strand: "signed document X at time Y"

### The Marketing Loop

```
Executive uses bit-sign.online
  → gets a $401 identity (if they don't have one)
  → their signed documents are on-chain
  → they see path401.com as the protocol page
  → they want their company on-chain
  → bitcoin-contracts (signed agreements)
  → bitcoin-shares (equity on-chain)
  → bitcoin-corp (full corporate structure)
```

bit-sign.online is the gateway drug. The beautiful signing experience
makes executives comfortable with on-chain identity. Then you upsell
the full stack.

## bitcoin-contracts Integration

Contracts signed via bit-sign.online or bitgit:

```bash
# Developer flow
bit sign contract.pdf              # sign a contract with $401 identity

# Executive flow
# → bit-sign.online UI → finger signature → $401 → on-chain
```

Both produce the same on-chain artifact:
- Document hash
- Signer's $401 reference
- Signature (AIP for developers, SVG+AIP for executives)
- Timestamp
- Counter-signatures (other parties)

## bitcoin-shares Integration

Cap table entries linked to $401 identities:

```
Shareholder: $401_chain_txid_of_richard
Shares: 1,000,000
Class: Common
Signed: bit-sign.online ceremony txid
```

Every shareholder is a $401 identity. Every share transfer is a $401-signed transaction.
The cap table IS the blockchain. No spreadsheet. No Carta. Just Bitcoin.

## Implementation Priority

1. **$HOME/.401/ directory + `bit id init`** — create identity locally
2. **`bit id link github`** — OAuth verify → strand inscription
3. **`bit push` with $HOME identity** — AIP signs with personal key
4. **bit-sign.online MVP** — TLDraw + $401 binding
5. **bitcoin-contracts** — document signing ceremonies
6. **bitcoin-shares** — cap table on $401 identities

Steps 1-3 are bitgit features. Steps 4-6 are separate products
that consume the same $401 protocol.
