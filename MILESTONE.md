# EcoVerdict — Supplemental evidence and review

**Accepted baseline:** [`90b14bb`](https://github.com/zuotu295/eco-verdict/commit/90b14bbc7fe593a7d6b2c160ceab901b144c51a0), with the [original Stable Studionet contract](https://explorer-studio.genlayer.com/address/0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003).

In the baseline, `VERDICTED` ended the case. A filer who found new evidence had to file a separate claim, and a reader had to infer the relationship between the resulting records. EcoVerdict v2 lets the filer add supplemental evidence once under the original claim ID. GenLayer validators independently reassess the original wording against the original and supplemental URLs. The docket preserves both rounds, including each round's sources, verdict, category and summary.

## Review lifecycle

| State | Action | Caller | Chain result |
| --- | --- | --- | --- |
| `FILED` | `assess_claim` | Any wallet | `VERDICTED` with the first round |
| `VERDICTED`, one round | `request_review` with 1–3 distinct new URLs | Original filer | `REVIEW_PENDING`, with the first round retained |
| `REVIEW_PENDING` | `assess_claim` | Any wallet | `VERDICTED` with both rounds after consensus |
| `VERDICTED`, two rounds | Read record | Any reader | Both rounds and the current verdict remain available |

A review cannot change the claim wording, filer, or original URL list. Validator disagreement leaves the pending record available for retry. Review fetches the URLs live again. Historical round records preserve the URLs and decisions, while the contents at an external URL may change.

## Deployment and verification

- Candidate v2 contract on Stable Studionet (chain 61999) — [`0x6e391FcC542B31564C7c423eBD31918f3a372479`](https://explorer-studio.genlayer.com/address/0x6e391FcC542B31564C7c423eBD31918f3a372479).
- Deployment receipt — [`0x19822d45…ddb896`](https://explorer-studio.genlayer.com/tx/0x19822d458956837ebb760c6c42270f5fca86e27d150f5c194fc59578e6ddb896), `FINALIZED` with execution succeeded.
- Deployed source SHA-256 — `45c195789ed805730646d8656286e65cfcb6ad9853adc443e84dd8506a22e23e`.
- [Live acceptance test](tests_integration/test_review.py) checks the same Patagonia case through first assessment, evidence submission, and supplemental review. The intended demonstration is `UNVERIFIED → REVIEW_PENDING → GREEN`. Evidence and acceptance status are tracked in [evidence/v2/VERIFICATION.md](evidence/v2/VERIFICATION.md).

## Reproduce

```bash
python -m venv .venv-repro
.venv-repro/bin/pip install -r requirements.lock.txt
.venv-repro/bin/python -m pytest tests -q
.venv-repro/bin/python scripts/check_contract.py
.venv-repro/bin/gltest --network studionet tests_integration/test_review.py -v -s
cd frontend
npm ci
npm test
npm run build
npm run preview
```

The live test creates a fresh deployment by default. To use an existing empty v2 instance, supply its address in `ECO_REVIEW_EMPTY_CONTRACT`. Check the explorer and the contract state after any ambiguous transaction failure before rerunning.

The frontend is a single responsive docket with search, verdict filtering, expandable case records, side-by-side review cards, and wallet-signed filing, assessment and review. It reads finalized state and persists a sent hash so users can recover after a reload. The original contract remains accessible through the website's archive link.
