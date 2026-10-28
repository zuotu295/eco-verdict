import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import "./style.css";
import { connectWallet, assertExecution } from "./wallet.js";

const DEFAULT_CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS || "0xd7600e8782aAC7b5a87c0Dc256840b7AA6dB8003";
const EXPLORER = "https://explorer-studio.genlayer.com";

const $ = (id) => document.getElementById(id);
const short = (addr) =>
  addr && addr.length > 13
    ? addr.slice(0, 6) + "…" + addr.slice(-4)
    : addr || "";

let account = null;
let client = null;
let walletPending = null;
let walletProvider = null;
let contractAddress = localStorage.getItem("ev_contract") || DEFAULT_CONTRACT;
let allClaims = [];
let currentFilter = "ALL";

const CATEGORY_TEXT = {
  certified: "Backed by an independent certification registry.",
  supported: "The filed sources directly support the claim.",
  contradicted: "The filed sources contradict the claim.",
  exaggerated: "The claim goes beyond what its sources show.",
  vague: "The claim is too vague to check against the sources.",
  insufficient_evidence: "The sources do not cover this claim.",
  source_unreachable: "None of the filed sources could be loaded.",
};

/* ---------- Drifting leaves ---------- */

function startLeaves() {
  const canvas = $("leaves");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = canvas.getContext("2d");
  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);
  const leaves = Array.from({ length: 14 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    s: 5 + Math.random() * 9,
    vy: 0.25 + Math.random() * 0.5,
    sway: Math.random() * Math.PI * 2,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.01,
    hue: 100 + Math.random() * 40,
  }));
  window.addEventListener("resize", () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });
  (function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const l of leaves) {
      l.y += l.vy;
      l.sway += 0.008;
      l.rot += l.vr;
      l.x += Math.sin(l.sway) * 0.3;
      if (l.y > h + 20) {
        l.y = -20;
        l.x = Math.random() * w;
      }
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = `hsla(${l.hue}, 35%, 32%, 0.16)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.s, l.s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(draw);
  })();
}

/* ---------- Proceedings timeline ---------- */

function setStage(stage) {
  const order = ["sign", "sent", "consensus", "final"];
  document.querySelectorAll(".steps li").forEach((li) => {
    const step = li.dataset.step;
    li.classList.remove("active", "done");
    if (stage === "error") return;
    if (order.indexOf(step) < order.indexOf(stage)) li.classList.add("done");
    if (step === stage) li.classList.add("active");
    if (stage === "final" && step === "final") li.classList.add("done");
  });
}

function setTx(text, kind = "", hash = "") {
  const el = $("tx-status");
  el.className = "tx " + kind;
  el.textContent = text;
  if (hash) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Copy hash";
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(hash);
        btn.textContent = "Copied";
      } catch {
        btn.textContent = hash;
      }
    });
    el.appendChild(btn);
  }
}

function showError(message) {
  const el = $("error");
  el.textContent = message;
  el.hidden = !message;
}

function readClient() {
  return createClient({ chain: studionet });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

function verdictStamp(c) {
  if (c.verdict === "GREEN") return `<span class="stamp green">GREEN ✓</span>`;
  if (c.verdict === "GREENWASH")
    return `<span class="stamp red">GREENWASH ✗</span>`;
  if (c.verdict === "UNVERIFIED")
    return `<span class="stamp amber">UNVERIFIED ?</span>`;
  return "";
}

function verdictBadge(c) {
  if (c.verdict === "GREEN") return `<span class="badge ok">GREEN</span>`;
  if (c.verdict === "GREENWASH")
    return `<span class="badge bad">GREENWASH</span>`;
  if (c.verdict === "UNVERIFIED")
    return `<span class="badge warn">UNVERIFIED</span>`;
  return "";
}

function renderCard(c) {
  const canAssess = c.status === "FILED";
  const sources = (c.sources || [])
    .map(
      (u) =>
        `<li><a href="${escapeHtml(u)}" target="_blank" rel="noreferrer">${escapeHtml(
          u
        )}</a></li>`
    )
    .join("");
  return `<article class="claim-card">
    ${verdictStamp(c)}
    <header><h3>${escapeHtml(c.subject)}</h3>
    <span><span class="badge neutral">${escapeHtml(c.status)}</span>${verdictBadge(c)}</span></header>
    <p class="claim-text">“${escapeHtml(c.claim_text)}”</p>
    <p class="meta">ID <code>${escapeHtml(c.claim_id)}</code> · filed by ${short(
      c.filer
    )} · assessments ×${c.assessment_count}</p>
    <ul class="sources">${sources}</ul>
    ${
      c.summary
        ? `<p class="summary"><strong>Court's reasoning:</strong> ${escapeHtml(
            c.summary
          )}<br><span class="muted">${escapeHtml(
            CATEGORY_TEXT[c.category] || c.category
          )}</span></p>`
        : ""
    }
    ${
      canAssess
        ? `<button class="btn gold" data-assess="${escapeHtml(
            c.claim_id
          )}">Run validator assessment</button>`
        : ""
    }
  </article>`;
}

function renderFiltered() {
  const list = $("claim-list");
  const shown =
    currentFilter === "ALL"
      ? allClaims
      : currentFilter === "FILED"
        ? allClaims.filter((c) => c.status === "FILED")
        : allClaims.filter((c) => c.verdict === currentFilter);
  if (shown.length === 0) {
    list.innerHTML = "<p class='muted'>No claims match this filter.</p>";
    return;
  }
  list.innerHTML = shown.map(renderCard).join("");
  list.querySelectorAll("[data-assess]").forEach((btn) => {
    btn.addEventListener("click", () => onAssess(btn.dataset.assess));
  });
}

function renderLedger() {
  $("count").textContent = String(allClaims.length);
  $("count-green").textContent = String(
    allClaims.filter((c) => c.verdict === "GREEN").length
  );
  $("count-greenwash").textContent = String(
    allClaims.filter((c) => c.verdict === "GREENWASH").length
  );
  $("count-unverified").textContent = String(
    allClaims.filter((c) => c.verdict === "UNVERIFIED").length
  );
}

async function refreshList() {
  const list = $("claim-list");
  if (!contractAddress) {
    list.innerHTML =
      "<p class='muted'>Enter a contract address above to load the docket.</p>";
    return;
  }
  list.innerHTML = "<p class='muted'>Opening the docket…</p>";
  try {
    const c = readClient();
    const countRaw = await c.readContract({
      address: contractAddress,
      functionName: "get_claim_count",
      args: [],
    });
    const count = Number(countRaw);
    if (count === 0) {
      allClaims = [];
      list.innerHTML =
        "<p class='muted'>The docket is empty. File the first claim below.</p>";
      renderLedger();
      return;
    }
    allClaims = [];
    for (let i = count - 1; i >= 0; i--) {
      const id = await c.readContract({
        address: contractAddress,
        functionName: "get_claim_id",
        args: [i],
      });
      const raw = await c.readContract({
        address: contractAddress,
        functionName: "get_claim",
        args: [String(id)],
      });
      allClaims.push(typeof raw === "string" ? JSON.parse(raw) : raw);
    }
    renderLedger();
    renderFiltered();
  } catch (err) {
    list.innerHTML = "<p class='muted'>Could not load the docket.</p>";
    showError("Load failed: " + (err?.message || err));
  }
}

function resetWallet() {
  account = null;
  client = null;
  $("wallet-btn").textContent = "Connect wallet";
}

async function ensureWallet() {
  if (walletPending) return walletPending;
  const provider = window.ethereum;
  if (provider !== walletProvider) {
    walletProvider?.removeListener?.("accountsChanged", resetWallet);
    walletProvider?.removeListener?.("chainChanged", resetWallet);
    walletProvider?.removeListener?.("disconnect", resetWallet);
    walletProvider = provider;
    provider?.on?.("accountsChanged", resetWallet);
    provider?.on?.("chainChanged", resetWallet);
    provider?.on?.("disconnect", resetWallet);
  }
  $("wallet-btn").disabled = true;
  walletPending = connectWallet(provider).then((session) => {
    account = session.account;
    client = session.client;
    $("wallet-btn").textContent = "Connected: " + short(account);
    showError("");
    return client;
  }).catch((err) => {
    resetWallet();
    throw err;
  }).finally(() => {
    walletPending = null;
    $("wallet-btn").disabled = false;
  });
  return walletPending;
}

async function send(method, args) {
  showError("");
  const c = await ensureWallet();
  setStage("sign");
  setTx("Waiting for signature…");
  const hash = await c.writeContract({
    address: contractAddress,
    functionName: method,
    args,
    value: BigInt(0),
  });
  setStage("sent");
  setTx(`Sent: ${hash}. Waiting for validator consensus…`, "", hash);
  setStage("consensus");
  const receipt = await readClient().waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    interval: 3000,
    retries: 200,
  });
  assertExecution(receipt);
  setStage("final");
  setTx(`Sealed on-chain: ${hash}`, "ok", hash);
}

async function onCreate(ev) {
  ev.preventDefault();
  if (!contractAddress) return showError("Set a contract address first.");
  const id = $("f-id").value.trim();
  const subject = $("f-subject").value.trim();
  const claim = $("f-claim").value.trim();
  const s1 = $("f-s1").value.trim();
  const s2 = $("f-s2").value.trim();
  const s3 = $("f-s3").value.trim();
  try {
    await send("file_claim", [id, subject, claim, s1, s2, s3]);
    await refreshList();
  } catch (err) {
    setStage("error");
    setTx("");
    showError("Filing failed: " + (err?.message || err));
  }
}

async function onAssess(cid) {
  if (!contractAddress) return showError("Set a contract address first.");
  try {
    await send("assess_claim", [cid]);
    await refreshList();
  } catch (err) {
    setStage("error");
    setTx("");
    showError("Assessment failed: " + (err?.message || err));
  }
}

$("wallet-btn").addEventListener("click", async () => {
  try {
    await ensureWallet();
  } catch (err) {
    showError(err?.message || err);
  }
});
$("contract-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  contractAddress = $("contract-address").value.trim();
  localStorage.setItem("ev_contract", contractAddress);
  $("explorer-link").href =
    EXPLORER + "/address/" + contractAddress;
  refreshList();
});
$("create-form").addEventListener("submit", onCreate);
$("refresh-btn").addEventListener("click", refreshList);
document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => {
      b.setAttribute("aria-pressed", b === btn ? "true" : "false");
    });
    renderFiltered();
  });
});
$("demo-btn").addEventListener("click", () => {
  if (DEFAULT_CONTRACT) {
    contractAddress = DEFAULT_CONTRACT;
    localStorage.setItem("ev_contract", contractAddress);
    $("contract-address").value = contractAddress;
    $("explorer-link").href = EXPLORER + "/address/" + contractAddress;
  }
  refreshList();
});

$("contract-address").value = contractAddress;
$("explorer-link").href = contractAddress
  ? EXPLORER + "/address/" + contractAddress
  : EXPLORER;
$("chain-note").textContent =
  "Stable Studionet · Chain ID 61999 · test network only, no real funds";
startLeaves();
refreshList();
