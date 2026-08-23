# Bug 0219: the corpus listing surface is public API documented nowhere

## Status

- **State:** Fixed — documented 2026-08-23, in the same PR that filed it.
  `Deferred: bug 0220`.
- **Priority:** Low — not a correctness gap. It is the whole remedy
  [proposal 004](../../proposals/promoted/004-corpus-content-explain.md) was ruled to need,
  and the ruling landed on 2026-08-13 with nothing owning the work since.
- **Implements:** proposal 004
- **Origin:** self-found — auditing the proposals lane after
  [plan 0216](../../plans/completed/0216-dogfood-the-proposals-lane.md) gave it terminal states. 004
  read `Draft` with a header saying its primitive was **declined** and the ruling was
  **docs-only**, which reads as finished; the docs were never written.

## Symptom

`corpus()` is public in `@nielspeter/eess-md` and its **listing surface is not
documented anywhere**. Measured 2026-08-23:

| symbol        | occurrences in `docs/` | in any `packages/*/README.md` |
| ------------- | ---------------------- | ----------------------------- |
| `documents()` | 0                      | 0                             |
| `.root`       | 0                      | 0                             |
| `fileIndex`   | 0                      | 0                             |

`corpus(...)` itself appears in `docs/markdown.md`, `docs/crossvalidate.md` and
`packages/md/README.md` — but only as the thing you pass to a rule builder. Nothing
shows that the returned `Corpus` will tell you **what it loaded**.

## Repro

```bash
grep -rl 'documents()' docs/ packages/*/README.md   # → no matches
```

Then read `packages/md/src/corpus.ts:35-40`: `documents()`, `root` and `fileIndex` are all
public on the exported `Corpus` interface, and `Corpus`/`CorpusOptions` are exported from
`packages/md/src/index.ts:9-10`.

## Root cause

Not a code defect — a documentation gap that outlived the record that found it. Proposal
004 asked for a corpus-content `explain` equivalent; the survey found the capability
already ships in both dialects it named, so the ruling was `Docs-only`. **`Docs-only` names
a remedy and creates no owner**, so the remedy evaporated: no plan, no bug, no board row
tracked it for ten days, and the proposal's own header read as though the matter was
settled.

That second half is the interesting one, and it is not this bug's to fix — see
[plan 0218](../../plans/0218-gate-proposal-acceptance-criteria.md), which now carries a rule
for it.

## Fix

Document the listing surface where a reader already is:

- `packages/md/README.md` — a short section under the existing corpus material: what
  `documents()` returns, that `root` and `fileIndex` exist and what they are for.
- `docs/markdown.md` — the same, as a worked example, since that is the page a reader
  reaches from the site.
- The gherkin equivalent (`features()` / `scenarios()`, `packages/gherkin/src/index.ts:12-14`)
  gets the same treatment — 004 named **both** dialects and both are undocumented.

Note the honest limit: `check:docs-code` compiles import-bearing TS fences, so a fence
added here is type-checked, but nothing requires these symbols to _have_ a fence. This bug
closes the gap;
[bug 0220](../0220-nothing-requires-a-public-symbol-to-be-documented.md) is what would stop
it reopening.

## Verification

- [x] The standing check inverts: the `grep` in _Repro_ returned nothing before and returns
      matches now — `documents()` in 3 files, `fileIndex` in 3, `set.scenarios()` in 1.
- [x] The added fences compile under `check:docs-code`, which went **48 → 51** import-bearing
      TS fences. This is the real verification and it is stronger than it looks: the gherkin
      example dereferences `sc.relPath`, `sc.line`, `sc.title` and `sc.tags`, so `tsc` would
      have failed the fence if any of those had been wrong about the shipped type. A prose
      description of an API cannot be checked; a compiled one can.
- [x] `npm run validate` green.
- [ ] **Nothing requires these symbols to keep having a fence** —
      `deferred→`[bug 0220](../0220-nothing-requires-a-public-symbol-to-be-documented.md),
      filed in this PR rather than named as a gap. `check:docs-code` compiles the fences
      that exist and demands none, so deleting this section is silent; 0220 measured the
      scale (290 of 696 exported symbols, 42%, appear in no doc or README) and carries the
      denominator decision the fix turns on.
