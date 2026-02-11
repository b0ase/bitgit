# bitgit

**`git push` for Bitcoin.** Inscribe content, register domains, and manage tokens on BSV.

```
npm install -g bitgit
```

## Commands

```bash
bit init                # scaffold .bit.yaml for your project
bit push                # git push + inscribe changed content on BSV
bit register <domain>   # inscribe a domain on DNS-DEX
bit status              # show wallet, domain, token & version chain
```

## Quick Start

```bash
# 1. Set up your project
cd your-project
bit init

# 2. Add your BSV private key (WIF) to .env.local
# 3. Push content to Bitcoin
bit push
```

`bit push` does two things:
1. `git push` to your remote (if there are commits to push)
2. Inscribes changed content on BSV (OP_RETURN with Bitcoin Schema)

Every inscription is chained — each transaction's change output feeds the next input, so you can inscribe dozens of files in one session without waiting for confirmations.

## .bit.yaml

`bit init` creates a `.bit.yaml` in your project root:

```yaml
project:
  name: my-project
  domain: my-project.com
  token: MYTOKEN

wallet:
  key_env: BSV_PRIVATE_KEY

content:
  type: blog              # blog | repo | domain | custom
  source: content/blog/   # directory to watch
  format: bitcoin_schema  # bitcoin_schema | op_return
  protocol: my-project-blog

db:
  supabase_url_env: NEXT_PUBLIC_SUPABASE_URL
  supabase_key_env: SUPABASE_SERVICE_ROLE_KEY
  version_table: blog_post_versions

dns_dex:
  token_symbol: $my-project.com
```

## Inscription Formats

### Bitcoin Schema (default)

Uses the B + MAP + AIP Bitcom protocols:
- **B** — content storage (full markdown/JSON)
- **MAP** — queryable metadata (indexed by GorillaPool)
- **AIP** — cryptographic authorship proof (ECDSA signature)

### Simple OP_RETURN

`OP_FALSE OP_RETURN <protocol> <content-type> <payload>`

## DNS-DEX Domain Registration

```bash
bit register my-project.com
bit register my-project.com --category=business --supply=1000000000
```

Inscribes a `dnsdex-domain` token on BSV and prints the DNS TXT records to add for verification.

## Broadcast Fallback Chain

Transactions are broadcast with automatic fallback:
1. WhatsOnChain API
2. GorillaPool ARC
3. TAAL ARC

## Dry Run

All commands support `--dry-run` to preview without broadcasting:

```bash
bit push --dry-run
bit register example.com --dry-run
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BSV_PRIVATE_KEY` | Yes | BSV private key (WIF format) |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase URL for version chain DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role key |

Configure via `wallet.key_env` in `.bit.yaml` to use any env var name.

## Lineage

`bitgit` is the evolution of [`bgit`](https://www.npmjs.com/package/bgit-cli) (v2, 2026). Same DNA — commit/push to Bitcoin — but instead of wrapping git with a payment gate, `bit` adds Bitcoin alongside git.

## Part of the PATH Protocol

- [$401](https://path401.com) — Identity
- [$402](https://path402.com) — Payment
- [$403](https://path403.com) — Conditions
- [DNS-DEX](https://dns-dex.com) — Domain tokenization
- [b0ase.com](https://b0ase.com) — Venture studio

## License

MIT
