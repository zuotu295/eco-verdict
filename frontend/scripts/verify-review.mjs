import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { assertExecution } from "../src/wallet.js";
import { deployment } from "../src/deployment.js";

const evidence = JSON.parse(
  await readFile(
    new URL("../../evidence/v2/chain.json", import.meta.url),
    "utf8",
  ),
);
const contractSource = await readFile(
  new URL("../../contracts/eco_verdict.py", import.meta.url),
);
assert.equal(
  createHash("sha256").update(contractSource).digest("hex"),
  evidence.source_sha256,
);
assert.equal(evidence.address, deployment.address);
const client = createClient({ chain: studionet });
assert.equal(await client.getChainId(), deployment.chainId);
const read = (functionName, args = []) =>
  client.readContract({
    address: deployment.address,
    functionName,
    args,
    transactionHashVariant: "latest-final",
  });
assert.equal(await read("get_protocol"), deployment.protocol);
const deployedCode = await client.request({
  method: "gen_getContractCode",
  params: [deployment.address],
});
assert.equal(
  createHash("sha256")
    .update(Buffer.from(deployedCode, "base64"))
    .digest("hex"),
  evidence.source_sha256,
);
for (const step of evidence.transactions) {
  const tx = await client.getTransaction({ hash: step.hash });
  assert.ok(
    tx.status === "FINALIZED" || tx.status === 7,
    step.step + " did not finalize",
  );
  assertExecution(tx);
  assert.equal(tx.to_address.toLowerCase(), deployment.address.toLowerCase());
  console.log(step.step, "FINALIZED", step.hash);
}
const current = JSON.parse(await read("get_claim", [evidence.final.claim_id]));
assert.deepEqual(current, evidence.final);
assert.equal(current.assessment_count, 2);
assert.deepEqual(current.rounds[0], evidence.initial.rounds[0]);
assert.deepEqual(current.rounds[1].sources, [
  ...current.sources,
  ...current.supplemental_sources,
]);
assert.equal(current.rounds[0].verdict, "UNVERIFIED");
assert.equal(current.rounds[1].verdict, "GREEN");
console.log("Latest finalized claim preserves both rounds:", current.claim_id);
