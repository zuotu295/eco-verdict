# DEPLOY.md — Deploying EcoVerdict

## Target

- Network: Stable Studionet (chain 61999)
- RPC: `https://studio.genlayer.com/api`
- Contract file: `contracts/eco_verdict.py` (no constructor arguments)
- Deployed instance (canonical):
  `0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003`
- Explorer:
  https://explorer-studio.genlayer.com/address/0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003

## Deploy with gltest (the path used here)

From the project root, with the reproducible environment:

```
.venv-repro/bin/gltest --network studionet tests_integration -v -s
```

This deploys the contract, files the two demo claims, and assesses
both with live validators. Wait for each transaction to reach
FINALIZED (status 7) and check `tx_execution_succeeded` on every
receipt; FINALIZED alone is never treated as proof of execution.

## Deploy with GenLayer Studio (alternative, not performed here)

Open Studio, create a contract from `contracts/eco_verdict.py`,
and deploy to Studionet. The contract takes no constructor
arguments. Record the new address in `evidence/EVIDENCE.md` and in
the frontend `.env` (`VITE_CONTRACT_ADDRESS`), then rebuild the
frontend; do not edit the deployed contract file afterwards, or
its SHA-256 will no longer match the deployed source.

## Frontend

```
cd frontend
npm install
VITE_CONTRACT_ADDRESS=<address> npm run build
```

The demo site is served from the `gh-pages` branch:
https://zuotu295.github.io/eco-verdict/

## Demo claims (already on the canonical instance)

- `demo-patagonia-1pct` — VERDICTED, GREEN / supported.
- `demo-patagonia-100pct` — VERDICTED, GREENWASH / contradicted.
- `node-verify-mvr0w980` — FILED, unassessed (frontend check).

See `examples/call_examples.py` for the exact call arguments and
`evidence/EVIDENCE.md` for every transaction hash.

## Notes

- If the Studio RPC returns a gateway error (HTTP 502) at gas
  estimation, no transaction was sent: check the transaction list
  before retrying, and never blindly resend.
- Do not use this deployment flow for Appeal.
- No personal wallet or private key is involved at any step.
