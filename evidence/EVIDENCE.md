# EVIDENCE.md — Recorded on-chain evidence for EcoVerdict

Network: Stable Studionet (chain 61999, RPC `https://studio.genlayer.com/api`).
Contract file SHA-256 at deployment:
`26f5b96863e90519784ea406527fdf5e79be92cd107a77c810655780c3245c39`
(unchanged since; the contract file was not modified after deployment).

Canonical contract:
`0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003`
Explorer:
https://explorer-studio.genlayer.com/address/0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003

All transactions below reached status 7 (FINALIZED) with
`tx_execution_succeeded` verified. No transaction was ever blindly
resent: the one failure in this record happened before sending (see
"Interruption"), so the later assessment was a first send, not a
resend. No personal wallet or private key was used: all callers were
auto-generated test accounts, except one discarded throwaway account
for the frontend write check.

## Deploy

- Deploy tx: `0x7dca98731616651abb4744f6067cd1cef38007e8ca4f4784f6b0b2b143703049`
- Contract: `0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003`

## Demo claims filed (both FINALIZED)

Both cite the same stable public source, the Wikipedia article on
Patagonia, Inc. (`https://en.wikipedia.org/wiki/Patagonia,_Inc.`),
so the docket shows one supported claim and one contradicted claim
side by side.

- `demo-patagonia-1pct` — "Patagonia commits 1% of its total sales
  to environmental groups."
  File tx: `0x49a4e1d32f7e4e4f5701e9e8ffba7c0a5a2fc0a37e9a82b3b3105edf0352ebca`
- `demo-patagonia-100pct` — "Patagonia donates 100% of its sales to
  environmental groups."
  File tx: `0x0fb8bcff833a4e1a421bf688264d33416ac8682ed70502d0221cb765afa86bbd`

## Assessments (live validators, live web fetch, FINALIZED)

- `demo-patagonia-1pct` — assess tx:
  `0x84194651b91558d117ba715d4f5727184fe625be2521f61a7098a9669d010114`
  Result: `VERDICTED`, verdict `GREEN`, category `supported`.
  Summary: "Source 1 directly supports the claim, stating that since
  1985, Patagonia has committed 1% of its total sales to
  environmental groups through One Percent for the Planet."
  The summary quotes the source's own wording, which is the
  observable trace that validators read the fetched page rather
  than answering from memory.
- `demo-patagonia-100pct` — assess tx:
  `0xf6e18377d92c8466153212a35f48db09801d747579aa7a29c0015a387e21246b`
  Result: `VERDICTED`, verdict `GREENWASH`, category `contradicted`.
  Summary: "Source 1 says Patagonia has committed 1% of total sales
  to environmental groups since 1985. That directly contradicts the
  claim that it donates 100% of its sales."
  The same source that supports the 1% claim contradicts the 100%
  claim, which is exactly the discrimination the mechanism is built
  for.

The full machine-readable record is `studionet_assess.json` in this
directory. After these two assessments the contract holds 2
assessed claims; the frontend check below added a third, unassessed
claim.

## Frontend write check (throwaway account, discarded afterwards)

Using the same genlayer-js calls as the web app, a freshly
generated account filed claim `node-verify-mvr0w980` and read it
back as `FILED`:

- Tx: `0xe901530aba535317b68afb5162d3093add89bed4e459c18f3329dad9012ae533`
- Receipt status: 7 (FINALIZED)
- Record: `node-verify-mvr0w980`, `FILED`, filer
  `0xd3b850C550223B610C87ac12511DB5F4b4221d54`
- Script: `frontend/scripts/verify-frontend-call.mjs`

Browser MetaMask writes were never executed by the assistant (no
personal wallet used); the code path is the same one verified here.

## Interruption (recorded, not hidden)

The first integration run deployed the contract and filed both
demo claims successfully, then the first assess transaction failed
before sending: the Studio RPC returned HTTP 502 Bad Gateway at
`eth_estimateGas`. Because the failure happened at gas estimation,
no assess transaction reached the network. The recovery run
(`tests_integration/test_assess_existing.py`, pytest path so the
gltest configuration loads) assessed the same deployed instance
afterwards and passed in 124.93s. An earlier recovery attempt as a
plain script failed immediately because `get_contract_factory`
needs the pytest-loaded configuration; that script was removed and
is not part of this repository.

## What was not done

- No Studio-UI deployment.
- No second assessment round for contested verdicts.
- No live prompt-injection test against the fetch path (the
  sanitiser is covered by unit tests only).
- No payment, escrow, or funds movement of any kind.
