"""Direct-mode smoke tests for EcoVerdict, using the real GenVM.

These tests are separate from tests/test_eco_verdict.py: they
require the genlayer-test direct fixtures, which are only available
in the reproducible environment. They make no network call and no
chain transaction: direct mode runs the contract in-process.

Run only with the reproducible environment, from the project root:
    .venv-repro/bin/python -m pytest tests_direct -v
"""

import json


def test_direct_deploy_and_empty_view(direct_deploy):
    contract = direct_deploy("contracts/eco_verdict.py")
    assert contract.get_claim_count() == "0"
    assert contract.get_status("missing") == "NOT_FOUND"
    assert contract.get_claim("missing") == ""


def test_direct_file_claim(direct_deploy):
    contract = direct_deploy("contracts/eco_verdict.py")
    result = contract.file_claim(
        "direct-smoke",
        "Packaging claim by a beverage company",
        "All of the company's bottles sold worldwide are already made from 100% recycled plastic.",
        "https://example.org/sustainability-report",
        "",
        "",
    )
    record = json.loads(result)
    assert record["status"] == "FILED"
    assert record["sources"] == ["https://example.org/sustainability-report"]
    assert contract.get_claim_count() == "1"
    assert contract.get_claim_id(0) == "direct-smoke"
    assert contract.get_claim_id(1) == ""
