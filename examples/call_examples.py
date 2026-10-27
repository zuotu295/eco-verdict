"""Call examples for EcoVerdict.

This script sends nothing, connects to nothing, and holds no key.
It only prints the exact arguments that can be pasted into GenLayer
Studio (or passed to the CLI / genlayer-js) after deploying the
contract. See DEPLOY.md for the deployment guide and
evidence/EVIDENCE.md for recorded deployments.

Example outcome (live validators, fetched sources): each demo claim
is assessed with a verdict from the closed set (GREEN, GREENWASH,
UNVERIFIED) and a reason category; the exact verdict is whatever
the validators agree on after reading the filed sources, not a
value fixed here.
"""

import json

SOURCE = "https://en.wikipedia.org/wiki/Patagonia,_Inc."


def main():
    print("file_claim:")
    print(json.dumps([
        "demo-patagonia-1pct",
        "Patagonia 1% for the Planet",
        "Patagonia commits 1% of its total sales to environmental groups.",
        SOURCE,
        "",
        "",
    ], indent=2))
    print("file_claim:")
    print(json.dumps([
        "demo-patagonia-100pct",
        "Patagonia sales donation claim",
        "Patagonia donates 100% of its sales to environmental groups.",
        SOURCE,
        "",
        "",
    ], indent=2))
    print("assess_claim:")
    print(json.dumps(["demo-patagonia-1pct"], indent=2))
    print("assess_claim:")
    print(json.dumps(["demo-patagonia-100pct"], indent=2))


if __name__ == "__main__":
    main()
