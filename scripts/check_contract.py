"""Offline static check for EcoVerdict (no network, no keys).

Checks the GenVM dependency header, minimal imports, storage types,
public-method decorators and return types, containment of
non-determinism, and the pinned Studionet configuration. It does
not claim a linter result: run the official linter separately.
"""

import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
CONTRACT = ROOT / "contracts" / "eco_verdict.py"
NETWORK = ROOT / "network.json"

EXPECTED_HEADER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'
FORBIDDEN_IMPORTS = {
    "os", "sys", "subprocess", "random", "time", "socket", "urllib",
    "requests", "hashlib", "pathlib", "typing",
}
EXPECTED_METHODS = {
    "file_claim": ("write", "str"),
    "assess_claim": ("write", "str"),
    "get_claim": ("view", "str"),
    "get_status": ("view", "str"),
    "get_claim_count": ("view", "str"),
    "get_claim_id": ("view", "str"),
}

failures = []


def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL") + "  " + name + (("  " + detail) if detail else ""))
    if not ok:
        failures.append(name)


def main():
    source = CONTRACT.read_text()
    first_line = source.splitlines()[0] if source else ""
    check("genvm-dependency-header", first_line.strip() == EXPECTED_HEADER, first_line.strip())
    tree = ast.parse(source)

    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            imports.add((node.module or "").split(".")[0])
    check("minimal-imports", imports <= {"genlayer", "json"}, ",".join(sorted(imports)))

    methods = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "EcoVerdict":
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    kinds = []
                    for dec in item.decorator_list:
                        if isinstance(dec, ast.Attribute):
                            kinds.append(dec.attr)
                    ret = ""
                    if item.returns is not None:
                        ret = ast.unparse(item.returns)
                    methods[item.name] = (kinds, ret)
    for name, (kind, ret) in EXPECTED_METHODS.items():
        got_kinds, got_ret = methods.get(name, ([], ""))
        check("method-" + name, kind in got_kinds and got_ret == ret,
              str(got_kinds) + " -> " + got_ret)

    check("storage-treemap", "TreeMap[str, str]" in source)
    check("storage-u32-count", "u32(0)" in source)
    check("nondet-exec-prompt", "gl.nondet.exec_prompt" in source)
    check("nondet-web-render", "gl.nondet.web.render" in source)
    check("nondet-validator", "gl.vm.run_nondet_unsafe" in source)
    check("no-evm-nondet", "gl.evm" not in source)

    network = json.loads(NETWORK.read_text())
    check("network-studionet", network.get("chainId") == 61999
          and network.get("rpcUrl") == "https://studio.genlayer.com/api")

    print()
    if failures:
        print("FAILURES: " + ", ".join(failures))
        sys.exit(1)
    print("All checks passed.")


if __name__ == "__main__":
    main()
