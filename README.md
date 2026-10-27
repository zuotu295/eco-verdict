# EcoVerdict — The Green Court

Every green claim gets its day in court.

Companies publish environmental claims every day: "100% recycled
packaging", "carbon neutral by 2030", "sustainably sourced timber".
Some are backed by independent certification; others are slogans
dressed as facts. EcoVerdict lets anyone file such a claim together
with the public sources that should prove it, and puts it through
GenLayer validator consensus: validators fetch the sources live,
on-chain, and must agree exactly on the verdict before it is sealed
as shared state.

- **Demo site:** https://zuotu295.github.io/eco-verdict/
- **Contract (Stable Studionet, chain 61999):**
  `0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003`
- **Explorer:**
  https://explorer-studio.genlayer.com/address/0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003

## How it works

1. **File a claim.** A claim id, a subject, the claim text as stated
   in public (10–500 characters), and 1–3 source URLs (https only).
   The record starts as `FILED`.
2. **Run the assessment.** Any wallet can trigger it. Each validator
   independently loads the filed sources live from the open web and
   reads what they show. Page text is never stored and never
   compared: pages change, and consensus is on the decision, not on
   the page.
3. **Read the verdict.** The record becomes `VERDICTED` with one of
   `GREEN` (sources directly support the claim), `GREENWASH`
   (sources contradict it, or the claim goes beyond what the
   sources show), or `UNVERIFIED` (sources do not cover the claim,
   or cannot be loaded), plus a reason category from a closed list
   and a short summary. `VERDICTED` is terminal: a corrected claim
   is filed as a new record, so the docket stays an honest public
   record.

See [MECHANISM.md](MECHANISM.md) for the full design, including the
equivalence rule, how sources are weighed, and the failure modes.

## Why GenLayer is necessary

Whether a source supports a claim is a judgement call, not a
computation, and the evidence itself lives on the open web, outside
any ordinary contract's reach. A single backend LLM call is one
opinion that never touches the source. EcoVerdict fetches the
sources inside the contract's non-deterministic step and puts the
judgement through validator consensus, while deterministic code
locks input bounds, lifecycle, and storage. The "real-time or
authoritative data" in this project is the live web itself: the
verdict is only as current as the sources it read.

## Repository layout

- `contracts/eco_verdict.py` — the Intelligent Contract (6 methods:
  2 write, 4 view).
- `frontend/` — Vite + vanilla JS + genlayer-js web app ("The Green
  Court" botanical art-deco docket).
- `tests/` — stand-in unit tests (20 passed).
- `tests_direct/` — direct-mode GenVM smoke tests (2 passed).
- `tests_integration/` — Studionet integration test with live
  validators (see `evidence/EVIDENCE.md`).
- `examples/call_examples.py` — exact call arguments for the demo
  claims.
- `evidence/` — on-chain evidence (deploy/file/assess receipts and
  final records).
- `scripts/check_contract.py` — offline static checks.
- `scripts/assess_existing.py` — recovery script used when a Studio
  gateway failure interrupted the integration run (see evidence).

## Run the tests

From the project root, with the reproducible environment
(Python 3.12.3, genlayer-test 0.29.2, genlayer-py 0.16.3,
genvm-linter 0.11.0, pytest 9.1.1; pins in
`requirements.lock.txt`):

```
.venv-repro/bin/python -m pytest tests -q
.venv-repro/bin/python -m pytest tests_direct -v
.venv-repro/bin/python scripts/check_contract.py
.venv-repro/bin/genvm-lint check contracts/eco_verdict.py
```

The stand-in suite and the direct-mode suite run separately: the
stand-in replaces the `genlayer` module in-process, so the two
suites cannot share one pytest process. See [TESTING.md](TESTING.md).

## Run the frontend

```
cd frontend
npm install
VITE_CONTRACT_ADDRESS=0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003 npm run build
```

Open the demo site, connect MetaMask (it switches to Studionet
automatically), and file or assess claims. The frontend never holds
a key: writes are signed in the user's own wallet.

## Sustained use

The docket is permanent on-chain state, not a demo database: any
future frontend, watchdog group, or journalist can point at the
same contract instance and read every filed claim and verdict. The
contract accepts new claims indefinitely, so the docket grows with
use instead of expiring when this site does. Future work, not done
here: a second assessment round for contested verdicts, a registry
of certification domains with deterministic weighting, and a
Studio-UI deployment.

## Limits (stated honestly)

- The verdict judges the filed sources only. It does not audit
  internal company records, test products in a lab, or prove that a
  source document itself is genuine.
- Fetched page text is truncated to 6000 characters per source, so
  very long reports are judged on their opening sections. Filers
  should link the specific page that carries the claim.
- If every source fails to load, the verdict is `UNVERIFIED` /
  `source_unreachable` without an LLM call.
- No Studio-UI deployment has been performed; deployment here is
  via the gltest CLI path against the same Studionet RPC.
- No payment, escrow, or funds movement is involved in this
  project. No personal wallet or private key was used at any point:
  all on-chain callers were auto-generated test accounts or one
  discarded throwaway account for the frontend check.

## License

MIT — see [LICENSE](LICENSE).
