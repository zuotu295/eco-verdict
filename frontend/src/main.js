import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { assertExecution, connectWallet } from "./wallet.js";
import { deployment } from "./deployment.js";
import "./style.css";

const address = import.meta.env.VITE_CONTRACT_ADDRESS || deployment.address;
const baseline = deployment.baseline.toLowerCase();
const explorer = "https://explorer-studio.genlayer.com";
const read = createClient({ chain: studionet });
const $ = (id) => document.getElementById(id);
const labels = {
  FILED: "Awaiting assessment",
  REVIEW_PENDING: "Review pending",
  GREEN: "Supported",
  GREENWASH: "Greenwash",
  UNVERIFIED: "Unverified",
};
const category = {
  certified: "Independent certification",
  supported: "Direct support",
  contradicted: "Contradictory evidence",
  exaggerated: "Claim exceeds evidence",
  vague: "Vague claim",
  insufficient_evidence: "Insufficient evidence",
  source_unreachable: "Sources unavailable",
};
const dialog = $("form-dialog");
const form = $("write-form");
let claims = [];
let selected = null;
let wallet = null;
let busy = false;
let loading = false;
let reviewEnabled = false;
let contractReady = false;
let requestedCase = new URL(window.location.href).searchParams.get("case");
const pendingKey = "ecoverdict-pending-" + address.toLowerCase();

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function badge(status) {
  const color = ["GREEN", "GREENWASH", "UNVERIFIED"].includes(status)
    ? status.toLowerCase()
    : "";
  return `<span class="tag ${color}">${esc(labels[status] || status)}</span>`;
}

function sources(urls) {
  return `<ol class="sources">${urls
    .map((url) => {
      try {
        if (new URL(url).protocol === "https:") {
          return `<li><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)} ↗</a></li>`;
        }
      } catch {
        // Render legacy malformed evidence as text.
      }
      return `<li>${esc(url)}</li>`;
    })
    .join("")}</ol>`;
}

function roundCard(round) {
  return `<section class="round"><h4>${round.round === 1 ? "Initial assessment" : "Supplemental review"}</h4>
    ${badge(round.verdict)}<p class="meta">${esc(category[round.category] || round.category)}</p>
    <p>${esc(round.summary)}</p>${sources(round.sources)}</section>`;
}

function recordCard(c, open) {
  const rounds = c.rounds ?? (c.assessment_count ? [{ ...c, round: 1 }] : []);
  const awaiting = ["FILED", "REVIEW_PENDING"].includes(c.status);
  const reviewable =
    reviewEnabled && c.status === "VERDICTED" && c.assessment_count === 1;
  const filer = wallet?.account.toLowerCase() === c.filer.toLowerCase();
  return `<details class="record" data-id="${esc(c.claim_id)}" ${open ? "open" : ""}>
    <summary><h3>${esc(c.subject)}</h3> ${badge(awaiting ? c.status : c.verdict)}</summary>
    <p class="meta">Case ${esc(c.claim_id)} · Filed by ${esc(c.filer)}</p>
    <p class="quote">“${esc(c.claim_text)}”</p>
    ${rounds.length ? `<div class="rounds">${rounds.map(roundCard).join("")}</div>` : sources(c.sources)}
    ${c.status === "REVIEW_PENDING" ? `<h4>New evidence queued</h4>${sources(c.supplemental_sources)}` : ""}
    ${awaiting ? `<button class="button primary" data-action="assess">${c.status === "FILED" ? "Run assessment" : "Run supplemental review"}</button>` : ""}
    ${reviewable && (!wallet || filer) ? '<button class="button primary" data-action="review">Add evidence for review</button>' : ""}
    ${reviewable && wallet && !filer ? '<p class="meta">The original filer can add evidence for review.</p>' : ""}
  </details>`;
}

function render() {
  const query = $("search").value.trim().toLowerCase();
  const filter = $("filter").value;
  const visible = claims.filter(
    (c) =>
      (!filter || c.status === filter || c.verdict === filter) &&
      [c.claim_id, c.subject, c.claim_text].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );
  const list = $("list");
  const open = new Set(
    [...list.querySelectorAll("details[open]")].map((el) => el.dataset.id),
  );
  if (
    requestedCase &&
    visible.some((claim) => claim.claim_id === requestedCase)
  ) {
    open.add(requestedCase);
    requestedCase = null;
  }
  list.innerHTML =
    visible.map((c) => recordCard(c, open.has(c.claim_id))).join("") ||
    '<p class="empty">No matching claims.</p>';
}

function notice(message, hash) {
  const display = $("notice");
  display.textContent = message;
  if (hash) {
    const link = document.createElement("a");
    link.href = explorer + "/tx/" + hash;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = " View transaction ↗";
    display.append(link);
  }
}

function readMethod(functionName, args = []) {
  return read.readContract({
    address,
    functionName,
    args,
    transactionHashVariant: "latest-final",
  });
}

async function refresh(announce = true) {
  if (loading) return;
  loading = true;
  $("refresh").disabled = true;
  if (announce) notice("Reading the finalized docket…");
  try {
    if (address.toLowerCase() !== baseline) {
      reviewEnabled =
        (await readMethod("get_protocol")) === deployment.protocol;
      if (!reviewEnabled) throw new Error("Unexpected contract protocol.");
    }
    const count = Number(await readMethod("get_claim_count"));
    if (!Number.isSafeInteger(count) || count < 0)
      throw new Error("Invalid docket count.");
    const loaded = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const id = await readMethod("get_claim_id", [i]);
      const raw = await readMethod("get_claim", [id]);
      loaded.push(JSON.parse(raw));
    }
    contractReady = true;
    $("open-file").disabled = false;
    claims = loaded;
    $("total").textContent = count;
    for (const verdict of ["GREEN", "GREENWASH", "UNVERIFIED"]) {
      $(verdict.toLowerCase()).textContent = claims.filter(
        (c) => c.verdict === verdict,
      ).length;
    }
    render();
    if (announce)
      notice(
        reviewEnabled
          ? ""
          : "Viewing the original deployment. Supplemental review requires the v2 contract.",
      );
  } catch (error) {
    notice("Docket could not be refreshed. " + error.message);
    if (!claims.length)
      $("list").innerHTML =
        '<p class="empty">No chain data loaded. Try Refresh.</p>';
  } finally {
    loading = false;
    $("refresh").disabled = false;
  }
}

async function connect() {
  wallet = await connectWallet(window.ethereum);
  $("wallet").textContent =
    wallet.account.slice(0, 6) + "…" + wallet.account.slice(-4);
  return wallet;
}

async function settle(hash) {
  notice("Waiting for chain finalization.", hash);
  let receipt;
  try {
    receipt = await read.waitForTransactionReceipt({
      hash,
      status: "FINALIZED",
      interval: 3000,
      retries: 120,
    });
  } catch {
    notice(
      "Final outcome is unknown. Open the transaction or use Refresh to check again.",
      hash,
    );
    return;
  }
  localStorage.removeItem(pendingKey);
  try {
    assertExecution(receipt);
    notice("Transaction finalized successfully.", hash);
  } catch {
    notice(
      "Transaction finalized without confirmed successful execution.",
      hash,
    );
  }
  await refresh(false);
}

async function runWrite(method, args, expectedFiler) {
  if (!contractReady)
    throw new Error("Refresh to verify the configured contract first.");
  if (localStorage.getItem(pendingKey))
    throw new Error("Use Refresh to check the previous transaction first.");
  const session = await connect();
  if (
    expectedFiler &&
    session.account.toLowerCase() !== expectedFiler.toLowerCase()
  ) {
    throw new Error("Connect the wallet that originally filed this case.");
  }
  if (method === "request_review" && !reviewEnabled)
    throw new Error("Review is unavailable on this contract.");
  notice("Approve the transaction in your wallet.");
  const hash = await session.client.writeContract({
    address,
    functionName: method,
    args,
    value: 0n,
  });
  localStorage.setItem(pendingKey, hash);
  if (dialog.open) {
    dialog.close();
    $("docket").scrollIntoView({ block: "start" });
  }
  await settle(hash);
}

async function exclusive(action, onError) {
  if (busy) return;
  busy = true;
  $("submit-write").disabled = true;
  try {
    await action();
  } catch (error) {
    onError(error.message);
  } finally {
    busy = false;
    $("submit-write").disabled = false;
  }
}

function openForm(claim) {
  selected = claim;
  form.reset();
  $("form-error").hidden = true;
  $("form-title").textContent = claim ? "Add review evidence" : "File a claim";
  $("claim-fields").hidden = Boolean(claim);
  for (const field of $("claim-fields").querySelectorAll("input,textarea"))
    field.disabled = Boolean(claim);
  dialog.showModal();
}

$("open-file").onclick = () => {
  if (!busy) openForm(null);
};
$("close").onclick = () => {
  if (!busy) dialog.close();
};
dialog.addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
$("wallet").onclick = () =>
  exclusive(async () => {
    await connect();
    render();
  }, notice);
for (const event of ["accountsChanged", "chainChanged", "disconnect"]) {
  window.ethereum?.on?.(event, () => {
    wallet = null;
    $("wallet").textContent = "Connect wallet";
    if (!busy) render();
  });
}
$("refresh").onclick = () =>
  exclusive(async () => {
    const hash = localStorage.getItem(pendingKey);
    if (hash) await settle(hash);
    else await refresh();
  }, notice);
$("search").oninput = render;
$("filter").onchange = render;
$("list").onclick = (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const claim = claims.find(
    (c) => c.claim_id === button.closest("details").dataset.id,
  );
  if (button.dataset.action === "review") openForm(claim);
  else exclusive(() => runWrite("assess_claim", [claim.claim_id]), notice);
};
form.onsubmit = (event) => {
  event.preventDefault();
  $("form-error").hidden = true;
  const fields = new FormData(form);
  const urls = ["source1", "source2", "source3"].map((name) =>
    fields.get(name).trim(),
  );
  const claim = selected;
  const args = claim
    ? [claim.claim_id, ...urls]
    : ["id", "subject", "claim"]
        .map((name) => fields.get(name).trim())
        .concat(urls);
  exclusive(
    () => runWrite(claim ? "request_review" : "file_claim", args, claim?.filer),
    (message) => {
      $("form-error").textContent = message;
      $("form-error").hidden = false;
      notice(message);
    },
  );
};
$("explorer").href = explorer + "/address/" + address;
$("archive").href = explorer + "/address/" + deployment.baseline;
const pending = localStorage.getItem(pendingKey);
refresh(!pending);
if (pending)
  notice(
    "A transaction is awaiting verification. Use Refresh to check its outcome.",
    pending,
  );
