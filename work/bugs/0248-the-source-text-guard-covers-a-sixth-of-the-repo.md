# Bug 0248: the source-text guard covers 264 files and the survey discipline it protects greps 1,503

## Status

- **State:** Draft — measured, scoped, and deliberately not fixed inside bug
  0247's change; the widening is a decision with consequences.
- **Severity:** Medium — **not a false green about what it checks; an
  over-broad reading of what a green means.** The gate's summary names a file
  count, so it does not lie. But the property it protects — "grep sees every
  file" — is relied on across the whole corpus, and the guard watches a sixth of
  it.
- **Origin:** self-found · enforcement review of
  [0247](./fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md), which
  measured the uncovered population and disproved the rationale for excluding it.
- **Reported:** 2026-09-04

## Symptom

`check:integrity`'s source-text scan walks `packages/*/src/**` — **264 files**.
Measured 2026-09-04 across the repo (excluding `node_modules`, `.git`, `dist`),
**1,239 further text files are unscanned**:

| population         | files | why it matters                                |
| ------------------ | ----- | --------------------------------------------- |
| `packages/*/tests` | 758   | the corpus every reviewer greps for prior art |
| `work/`            | 204   | the record corpus — bugs, plans, proposals    |
| `scripts/`         | 78    | the gates themselves                          |
| `docs/`            | 40    | the manifesto and the guide                   |
| `examples/`        | 32    | the code adopters copy                        |
| root `*.rules.ts`  | 4     | the dogfood rule files                        |

A stray latin-1 byte in any of them makes `grep` skip the file with no output and
no warning, exactly as it does in `packages/*/src` — and nothing checks.

## Why the existing exclusion does not justify it

The scan's own comment gave a reason, and enforcement review measured it false:

> It is deliberately NOT the whole repo: the non-vacuity fixtures under
> `scripts/nonvacuity/` carry deliberately corrupt payloads, and a guard that
> reds on its own test data teaches people to disable it.

Scanned every file in the repo with `TextDecoder(fatal)` plus a NUL sweep:
**zero files carry either defect, `scripts/nonvacuity/` included.** The fixtures
plant their payloads through `Buffer.from(...)` **into `packages/core/src`**, and
their own comments say why — writing a raw byte into the fixture would make the
fixture unsearchable and red the guard it tests. So the exclusion protects
nothing that needs protecting.

That comment is corrected in place as part of 0247 rather than left standing; a
rationale that measurement contradicts is the shape this repo keeps paying for.

## Why this is not simply "widen the walk"

Widening costs **zero findings today** — that is measured, and it is the argument
for doing it. Three things make it a decision rather than a one-line change:

1. **A future fixture may legitimately need a bad byte.** Today none does, because
   the plant-through-Buffer convention exists. Widening makes that convention
   load-bearing rather than merely wise, and nothing enforces it.
2. **`work/` and `docs/` are prose, not source.** The remedy line the finding
   prints ("write the character as an escape its own syntax provides") is
   TypeScript advice. Markdown has no such escape, so the finding needs a
   different suggestion for that population or it sends a reader nowhere.
3. **It changes what `check:integrity` is.** The gate leads the validate chain
   because it recognises corrupted INPUT before other gates misattribute it
   (bug 0231). Extending it to the record corpus is defensible on exactly that
   reasoning — a NUL in `work/` would red `check:corpus` and blame the corpus —
   but it is a scope decision, and this repo's habit is to make those explicitly.

## A second population question, from the same review

There is **no exclusion path for a file that is legitimately not text**.
`walkAny` walks everything under `packages/*/src`, so a vendored `.wasm`, a
fixture image or a binary test asset committed there would hard-fail the gate
with no way to declare it intentional.

Pre-existing — the NUL check had the same shape — but the surface widened with
[0247](./fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md): invalid
UTF-8 is far more common in binary blobs than a NUL-free encoding is, so a binary
file that slipped past the NUL check will not slip past this one.

Nothing in the repo hits it today (measured: zero files carry either defect), so
this is a latent trap rather than a live defect. It belongs with the widening
decision because both answer the same question — **what population is this gate
for, and how does something legitimately leave it?** A widening that has no
opt-out mechanism is a widening that will eventually be disabled wholesale, which
is the outcome the original scope comment was (wrongly) trying to avoid.

## Fix (not built)

1. Decide the population. The honest default is "every tracked text file", with
   the fixture convention (`Buffer.from` into a probe path) written down as the
   thing that keeps it green.
2. A per-population remedy line, so a finding in `work/` does not advise a
   TypeScript escape.
3. A `check:nonvacuity` scenario per newly-covered population, or the widening is
   a claim rather than a check — the same trap 0247 hit when its scenario shipped
   unregistered and the fixture count did not move.

## Verification

- [ ] Red first: a probe in each newly-covered population is named by the gate.
- [ ] The remedy line differs for source and for prose, and each is right.
- [ ] The non-vacuity harness's fixture count moves, and the new rows are claimed.
- [ ] `scripts/nonvacuity/` still passes with the guard widened over it.
- [ ] A declared exclusion mechanism exists and is itself gated, so a binary file
      under a covered path can be admitted deliberately rather than by turning the
      check off.

## Related

- [0247](./fixed/0247-the-source-text-guard-checks-nul-but-not-utf8.md) — added the
  UTF-8 half of this guard and corrected the false rationale this record measures.
- [0231](./fixed/0231-a-killed-nonvacuity-run-leaves-an-invisible-probe-that-reds-other-gates.md)
  — why `check:integrity` leads the chain, which is the argument for widening it
  to the record corpus rather than against.
