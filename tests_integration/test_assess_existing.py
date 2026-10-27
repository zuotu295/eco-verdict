"""Assess the two demo claims on the already-deployed EcoVerdict instance.

Recovery run, as a pytest test so the gltest configuration (contracts
directory, Studionet network) loads the same way it does for the
full-flow test. The full-flow run deployed contract
0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003 and filed both demo
claims (both FINALIZED), then the first assess transaction failed
before sending, at eth_estimateGas, because the Studio RPC returned
HTTP 502 Bad Gateway. No assess transaction was sent, so assessing
here is not a resend of anything already submitted.

Run ONLY with the reproducible environment, from the project root:
    .venv-repro/bin/gltest --network studionet tests_integration/test_assess_existing.py -v -s

Writes evidence/studionet_assess.json. Do NOT use for Appeal.
"""

import json
from pathlib import Path

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus

ADDRESS = "0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003"
VERDICTS = ("GREEN", "GREENWASH", "UNVERIFIED")
CATEGORIES = (
    "certified",
    "supported",
    "contradicted",
    "exaggerated",
    "vague",
    "insufficient_evidence",
    "source_unreachable",
)


def _receipt_info(receipt):
    info = {}
    for key in ("hash", "transaction_hash", "tx_hash", "status",
                "consensus_status", "execution_result", "result",
                "contract_address", "address"):
        try:
            value = receipt.get(key)
        except Exception:
            value = None
        if value is not None:
            info[key] = str(value)
    return info


def test_assess_existing_demo_claims():
    factory = get_contract_factory(contract_file_path="eco_verdict.py")
    contract = factory.build_contract(contract_address=ADDRESS)
    out = {"contract_address": ADDRESS, "claims": {}}

    for claim_id in ("demo-patagonia-1pct", "demo-patagonia-100pct"):
        status = str(contract.get_status(args=[claim_id]).call())
        record = json.loads(contract.get_claim(args=[claim_id]).call())
        print(f"\nBEFORE {claim_id}: status={status} verdict={record['verdict']}")
        assert status == "FILED", f"{claim_id} is {status}, not FILED"
        receipt = contract.assess_claim(
            args=[claim_id]
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        assert tx_execution_succeeded(receipt), receipt
        print("EVIDENCE_ECO_ASSESS " + json.dumps({
            "contract_address": ADDRESS,
            "claim_id": claim_id,
            "assess_receipt": _receipt_info(receipt),
        }, sort_keys=True))
        status = str(contract.get_status(args=[claim_id]).call())
        record = json.loads(contract.get_claim(args=[claim_id]).call())
        print("EVIDENCE_ECO_RECORD " + json.dumps({
            "contract_address": ADDRESS,
            "claim_id": claim_id,
            "status": status,
            "record": record,
        }, sort_keys=True))
        assert status == "VERDICTED"
        assert record["status"] == "VERDICTED"
        assert record["verdict"] in VERDICTS
        assert record["category"] in CATEGORIES
        assert record["assessment_count"] == 1
        out["claims"][claim_id] = {
            "assess_receipt": _receipt_info(receipt),
            "record": record,
        }

    count = contract.get_claim_count().call()
    assert int(count) == 2
    out["claim_count"] = int(count)
    path = Path("evidence/studionet_assess.json")
    path.write_text(json.dumps(out, indent=2, sort_keys=True))
    print(f"Wrote {path}")
