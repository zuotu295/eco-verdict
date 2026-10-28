# TESTING.md — How EcoVerdict is tested

## Layers

### 1. Stand-in suite — `tests/` (20 passed)

The real GenLayer SDK is not installed for these tests. `conftest.py`
installs a small stand-in `genlayer` module implementing exactly the
surface the contract uses (`gl.Contract`, `gl.public`, `gl.message`,
`gl.nondet.exec_prompt`, `gl.nondet.web.render`,
`gl.vm.run_nondet_unsafe`) and loads `contracts/eco_verdict.py`
itself, so the tests exercise the deployable file. Queued LLM
responses drive the leader and the validator in order; queued web
pages drive `render`, and a URL with no queued page raises,
mimicking a failed fetch.

Covered: filing and validation, duplicate ids, source rules,
missing-record views, agreement on verdict, summary wording
allowed to differ, verdict and category disagreement writing
nothing, malformed output writing nothing, all-sources-failed
returning `UNVERIFIED` / `source_unreachable` without an LLM call,
partial fetch still judging the loaded sources, terminal
`VERDICTED` state, prompt-tag sanitisation, summary truncation,
and claim independence with creation-order listing.

```
.venv-repro/bin/python -m pytest tests -q
```

### 2. Direct-mode smoke — `tests_direct/` (2 passed)

Runs the contract in-process in the real GenVM via the genlayer-test
direct fixtures. No network call, no chain transaction. Filing and
views only; assessment is not run here because it needs live
validators, a live web fetch, and a live LLM.

```
.venv-repro/bin/python -m pytest tests_direct -v
```

The two suites run separately: the stand-in replaces the `genlayer`
module in-process, so they cannot share one pytest process.

### 3. Offline static checks — `scripts/check_contract.py` (all passed)

Checks the GenVM dependency header, minimal imports (`genlayer`,
`json` only), the six public methods with their kinds and return
types, `TreeMap` / `u32(0)` storage, the presence of
`gl.nondet.exec_prompt`, `gl.nondet.web.render` and
`gl.vm.run_nondet_unsafe`, the absence of `gl.evm`, and the pinned
Studionet configuration (chain 61999, `https://studio.genlayer.com/api`).

### 4. Linter — `genvm-lint check` (passed)

Lint passed (3 checks), validation passed, 6 methods (4 view,
2 write). The linter notes a newer `py-genlayer` runner is
available; the contract stays on the pinned runner
`1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`, the same
pin used by the deployed instance.

### 5. Studionet integration — `tests_integration/` (live validators)

Deploys one instance on Stable Studionet, files two demo claims
against the same stable public source (the Wikipedia article on
Patagonia, Inc.), and assesses both with live validators that fetch
the source on-chain. Assertions are limited to what the design
guarantees: each assessment completes, the status becomes
`VERDICTED`, and verdict and category are members of their closed
sets. Actual verdicts are recorded in `evidence/`, not forced here.

One interruption is recorded honestly in `evidence/EVIDENCE.md`: the
first integration run deployed and filed successfully, then the
first assess transaction failed before sending when the Studio RPC
returned HTTP 502 at gas estimation. The recovery script
`scripts/assess_existing.py` assessed the same deployed instance
afterwards; no transaction was ever blindly resent.

```
.venv-repro/bin/gltest --network studionet tests_integration -v -s
```

### 6. Frontend call verification — `frontend/scripts/verify-frontend-call.mjs`

Runs the same genlayer-js calls the web app uses, but with a
throwaway generated account instead of MetaMask, so the write path
is exercised without a personal wallet. It files a claim with a
fresh id and reads it back as `FILED`. The account is discarded
afterwards.

```
cd frontend
CONTRACT_ADDRESS=0x... node scripts/verify-frontend-call.mjs
```

## Environment

Python 3.12.3, genlayer-test 0.29.2, genlayer-py 0.16.3,
genvm-linter 0.11.0, pytest 9.1.1; pins in
`requirements.lock.txt`. Direct mode on a fresh machine may hit an
HTTP 404 downloading GenVM v0.3.0-rc7; the local fix is copying the
genvm-linter cached tarball into `~/.cache/gltest-direct/`.

## Browser wallet regression tests

Run `cd frontend && npm ci && npm test && npm run build`.
The tests use EIP-1193 wallet doubles with no Snaps support and the
actual pinned genlayer-js SDK. They cover existing/unknown networks,
rejected authorization, empty accounts, a wallet that does not switch,
standard-provider transaction forwarding and failed execution receipts.
No test requires a private key or a funded account.

Manual browser check: open the demo, connect the browser wallet,
approve Stable Studionet (61999), and confirm that no Snap request
appears. Rejecting a request must leave the button disconnected.
Changing accounts or networks must clear the connected indicator;
the next connection/write revalidates both. Wallet signing still needs
the wallet owner's approval.
