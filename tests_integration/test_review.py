"""Live acceptance for the supplemental review milestone on Stable Studionet."""
import json
import os

from gltest import get_contract_factory
from gltest.assertions import tx_execution_succeeded
from gltest.types import TransactionStatus
from gltest.utils import extract_contract_address

CLAIM_ID = "patagonia-supplemental-review"
FIRST = "https://example.org/"
SUPPLEMENT = "https://en.wikipedia.org/wiki/Patagonia,_Inc."
FINAL = TransactionStatus.FINALIZED


def record_receipt(step, receipt):
    assert tx_execution_succeeded(receipt), receipt
    print("REVIEW_EVIDENCE " + json.dumps({
        "step": step,
        "hash": str(receipt.get("hash") or receipt.get("transaction_hash")),
        "status": str(receipt.get("status")),
        "execution_succeeded": True,
    }), flush=True)


def test_supplemental_review():
    factory = get_contract_factory(contract_file_path="eco_verdict.py")
    address = os.environ.get("ECO_REVIEW_EMPTY_CONTRACT")
    if not address:
        deployment = factory.deploy_contract_tx(wait_transaction_status=FINAL)
        record_receipt("deploy", deployment)
        address = extract_contract_address(deployment)
    print("REVIEW_ADDRESS " + str(address), flush=True)
    contract = factory.build_contract(contract_address=address)
    assert contract.get_protocol().call() == "eco-verdict-2"
    assert int(contract.get_claim_count().call()) == 0

    record_receipt("file", contract.file_claim(args=[
        CLAIM_ID, "Patagonia environmental giving",
        "Patagonia commits 1% of its total sales to environmental groups.",
        FIRST, "", "",
    ]).transact(wait_transaction_status=FINAL))
    record_receipt("assess", contract.assess_claim(args=[CLAIM_ID])
                   .transact(wait_transaction_status=FINAL))
    initial = json.loads(contract.get_claim(args=[CLAIM_ID]).call())
    print("REVIEW_INITIAL " + json.dumps(initial), flush=True)
    assert initial["verdict"] == "UNVERIFIED"

    record_receipt("queue_review", contract.request_review(args=[CLAIM_ID, SUPPLEMENT, "", ""])
                   .transact(wait_transaction_status=FINAL))
    queued = json.loads(contract.get_claim(args=[CLAIM_ID]).call())
    assert queued["status"] == "REVIEW_PENDING"
    assert queued["rounds"] == initial["rounds"]
    print("REVIEW_QUEUED " + json.dumps(queued), flush=True)

    record_receipt("reassess", contract.assess_claim(args=[CLAIM_ID])
                   .transact(wait_transaction_status=FINAL))
    final = json.loads(contract.get_claim(args=[CLAIM_ID]).call())
    print("REVIEW_FINAL " + json.dumps(final), flush=True)
    assert final["status"] == "VERDICTED"
    assert final["verdict"] == "GREEN"
    assert final["assessment_count"] == 2
    assert final["rounds"][0] == initial["rounds"][0]
    assert final["rounds"][1]["sources"] == [FIRST, SUPPLEMENT]
    assert final["claim_text"] == initial["claim_text"]
    assert final["filer"] == initial["filer"]
    assert int(contract.get_claim_count().call()) == 1
