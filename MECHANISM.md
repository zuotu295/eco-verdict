# MECHANISM.md — How EcoVerdict decides

## The problem

A green claim is a sentence a company publishes about its own
environmental record, and a source is a page that should prove it.
Two questions decide whether the claim deserves trust: does the
source actually say this, and is the source independent of the
company? Both are reading-comprehension judgements over live web
pages. Ordinary contracts cannot open a URL; a single LLM call can,
but its answer is one opinion and is not shared state. EcoVerdict
is the missing piece: fetch inside the contract, judge by
consensus, store the decision.

## State

One record per claim, stored as a JSON string under the claim id:

```json
{
  "claim_id": "demo-patagonia-1pct",
  "subject": "Patagonia 1% for the Planet",
  "claim_text": "Patagonia commits 1% of its total sales to environmental groups.",
  "sources": ["https://en.wikipedia.org/wiki/Patagonia,_Inc."],
  "filer": "0x…",
  "status": "FILED",
  "verdict": "",
  "category": "",
  "summary": "",
  "assessment_count": 0
}
```

Storage follows the pattern proven on Studionet in earlier work:
class-level annotations (`claims: TreeMap[str, str]`,
`id_index: TreeMap[str, str]`, `claim_count: u32`) plus
`TreeMap()` / `u32(0)` construction in `__init__`, `u32(int(x) + 1)`
increments, and claim ids kept in creation order as one
newline-joined string under `id_index["ids"]`. Assignments inside
`__init__` alone leave a deployed instance without storage
attributes on the Studionet validator runtime; `DynArray` storage
must not be assumed to work there without live verification.

## Methods

| Method | Kind | Purpose |
| --- | --- | --- |
| `file_claim` | write | Create a `FILED` record. Rejects duplicate ids, bad ids, out-of-range text, non-https or missing sources. |
| `assess_claim` | write | Run the consensus assessment; on agreement stores `VERDICTED` with verdict, category, summary. |
| `get_claim` | view | Full record JSON, or `""` when missing. |
| `get_status` | view | `FILED`, `VERDICTED`, or `NOT_FOUND`. |
| `get_claim_count` | view | Number of filed claims, as a string. |
| `get_claim_id` | view | Claim id by creation index, or `""` out of range. |

## The assessment step, in order

1. **Load and gate (deterministic).** The record must exist and be
   `FILED`; anything else fails with `INVALID_STATUS` and writes
   nothing.
2. **Sanitise the prompt copy (deterministic).** Subject and claim
   text are copied for the prompt with forged structure removed:
   any tag named `claim`, `source` or `subject` (after stripping
   whitespace, slashes and case) and any `===...===` segment
   mentioning one of them becomes `[removed]`. The stored record
   keeps the original text; only the prompt copy is cleaned, so a
   filed claim can never smuggle instructions into the judge.
3. **Fetch (non-deterministic).** For each source URL, the leader
   calls `gl.nondet.web.render(url, mode="text")` and truncates the
   result to 6000 characters. A failed fetch contributes the marker
   `FETCH_FAILED` for that source instead of text. If no source
   loads at all, the step returns `UNVERIFIED` /
   `source_unreachable` with a fixed summary, without calling the
   LLM.
4. **Judge (non-deterministic).** One prompt carries the subject,
   the claim, and the fetched sections, and asks for JSON only:
   `verdict`, `category`, `summary`. The prompt's weighing rule:
   independent certification registries and primary documents
   (FSC, B Corp, EPA, EU Ecolabel, audited annual reports) outweigh
   company self-statements. `GREEN` requires the sources to support
   the claim as stated. `GREENWASH` covers contradiction and
   exaggeration alike: a "100%" claim backed only by a future goal
   is greenwash, not a close call. `UNVERIFIED` is reserved for
   sources that do not cover the claim at all.
5. **Agree (equivalence).** A validator re-runs the whole step —
   fetch and judge — and must agree exactly on `verdict` and
   `category`. Summary wording is deliberately not compared. A
   malformed leader output is rejected, never agreed on. If the
   validators disagree, the transaction finalises with no record
   written: disagreement is a visible outcome, not a stored
   verdict.
6. **Store (deterministic).** Only after consensus does
   deterministic code write `VERDICTED`, the verdict, the category,
   the (truncated-to-500-characters) summary, and increment
   `assessment_count`.

## Bounds

- Claim id: 1–64 characters, `[A-Za-z0-9_-]`.
- Subject: 1–128 characters.
- Claim text: 10–500 characters.
- Sources: 1–3 URLs, each 1–500 characters, `https://` only.
- Fetched text: 6000 characters per source before the prompt.
- Summary: 10–500 characters; longer model output is truncated,
  never rejected, because only verdict and category drive
  consensus and a long summary must not void an agreed decision.

## Failure modes, and what each one means

- `NOT_FOUND` — unknown claim id; read as `""` / `NOT_FOUND`,
  never an exception on views.
- `INVALID_STATUS` — assessing a claim that is not `FILED`
  (already `VERDICTED`); the docket is append-only by design.
- `INVALID_INPUT` — bounds or URL rules violated at filing.
- `CLAIM_EXISTS` — the id is already on the docket.
- `LLM_ERROR` — the model output could not be parsed as a
  verdict; nothing is written.
- `CONSENSUS_RESULT_INVALID` — the agreed result is not a
  verdict; nothing is written.
- Validator disagreement — the transaction finalises with no
  state change. The claim stays `FILED` and can be assessed again
  later, when sources or model behaviour may differ.
- `source_unreachable` — every filed source failed to load. This
  is a stored verdict, not an error: it records that the claim
  could not be checked from its own sources.

## What this does not do

- It does not verify that a source document is genuine. A forged
  registry page would fool any reader, including validators.
- It does not read past the first 6000 characters of a source.
- It does not move money, hold escrow, or penalise anyone. The
  output is a public record, and its power is reputational.
