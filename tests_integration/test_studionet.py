"""Studionet integration test for EcoVerdict (real chain, real validators).

Run ONLY with the reproducible environment, from the project root:
    .venv-repro/bin/gltest --network studionet tests_integration -v -s

Deploys one contract instance on Stable Studionet (61999), files two
demo claims against the same stable public source (the Wikipedia
article on Patagonia, Inc.), and runs live-validator assessments
that fetch that source on-chain. No mocked LLM and no mocked web
fetch is used. The test asserts only what the design guarantees:
each assessment completes, the status becomes VERDICTED, and the
verdict and category are members of their closed sets. The actual
verdicts are printed as JSON evidence lines and archived in
evidence/, not forced to particular values here, because live
validators judge the fetched sources independently.

Demo claims (both cite the same source on purpose, so the docket
shows one supported claim and one contradicted claim side by side):
- demo-patagonia-1pct: "Patagonia commits 1% of its total sales
  to environmental groups." The source states exactly this.
- demo-patagonia-100pct: "Patagonia donates 100% of its sales to
  environmental groups." The source states 1%, so the claim goes
  far beyond what its own source shows.

Do NOT run this file against another network without reviewing it
first, and do NOT use it for Appeal.
"""

import json

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus

SOURCE = "https://en.wikipedia.org/wiki/Patagonia,_Inc."
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
    info["raw_keys"] = sorted(list(receipt.keys())) if hasattr(receipt, "keys") else []
    return info


def test_studionet_full_flow():
    factory = get_contract_factory(contract_file_path="eco_verdict.py")
    deploy_receipt = factory.deploy_contract_tx(
        wait_transaction_status=TransactionStatus.FINALIZED,
    )
    assert tx_execution_succeeded(deploy_receipt), deploy_receipt
    from gltest.utils import extract_contract_address
    address = extract_contract_address(deploy_receipt)
    contract = factory.build_contract(contract_address=address)
    print("\nEVIDENCE_ECO_DEPLOY " + json.dumps({
        "contract_address": str(address),
        "deploy_receipt": _receipt_info(deploy_receipt),
    }, sort_keys=True))

    claims = [
        (
            "demo-patagonia-1pct",
            "Patagonia 1% for the Planet",
            "Patagonia commits 1% of its total sales to environmental groups.",
        ),
        (
            "demo-patagonia-100pct",
            "Patagonia sales donation claim",
            "Patagonia donates 100% of its sales to environmental groups.",
        ),
    ]
    for claim_id, subject, claim_text in claims:
        receipt = contract.file_claim(
            args=[claim_id, subject, claim_text, SOURCE, "", ""]
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        assert tx_execution_succeeded(receipt), receipt
        print("EVIDENCE_ECO_FILE " + json.dumps({
            "contract_address": str(address),
            "claim_id": claim_id,
            "file_receipt": _receipt_info(receipt),
        }, sort_keys=True))

    for claim_id, _, _ in claims:
        receipt = contract.assess_claim(
            args=[claim_id]
        ).transact(wait_transaction_status=TransactionStatus.FINALIZED)
        assert tx_execution_succeeded(receipt), receipt
        print("EVIDENCE_ECO_ASSESS " + json.dumps({
            "contract_address": str(address),
            "claim_id": claim_id,
            "assess_receipt": _receipt_info(receipt),
        }, sort_keys=True))

    records = {}
    for claim_id, _, _ in claims:
        status = contract.get_status(args=[claim_id]).call()
        record = json.loads(contract.get_claim(args=[claim_id]).call())
        records[claim_id] = record
        print("EVIDENCE_ECO_RECORD " + json.dumps({
            "contract_address": str(address),
            "claim_id": claim_id,
            "status": str(status),
            "record": record,
        }, sort_keys=True))
        assert str(status) == "VERDICTED"
        assert record["status"] == "VERDICTED"
        assert record["verdict"] in VERDICTS
        assert record["category"] in CATEGORIES
        assert record["assessment_count"] == 1

    count = contract.get_claim_count().call()
    assert int(count) == 2
    assert contract.get_claim_id(args=[0]).call() == "demo-patagonia-1pct"
    assert contract.get_claim_id(args=[1]).call() == "demo-patagonia-100pct"
