# Plan 0082: doc code-fence check gate

## Status

- **State:** Ready — frozen 2026-07-24. A branch review found that a `tsc` type-check
  catches import / API-existence / signature drift but **not** deprecation
  (`@deprecated` is a suggestion, not a compile error — verified: `tsc --noEmit` exits
  0 on it). Rather than punt deprecation, the gate pairs the type-check with an ESLint
  `@typescript-eslint/no-deprecated` pass over the same fences — so it catches **all
  three** stale-example classes the sweep found. Confirmed available: typescript-eslint
  8.57.2 ships `no-deprecated`. All open questions resolved; the floor is
  self-contained.
- **Priority:** P2 — buildable now; the highest-value gap from the 2026-07-24
  dogfooding audit.
- **Effort:** ~2 sessions. Two checks over one shared extraction; the variable part is
  triaging first-run reds (real drift → fix; illustrative → sanction).
- **Created:** 2026-07-24

## Problem

eess validates its own specs against its own code — but the TypeScript examples
inside `docs/*.md` are **not checked anywhere**. A fence that imports a moved path,
calls a removed/renamed method, changes a signature, or uses a deprecated API rots
silently until a human reads it. This is **Tier 1** (statically decidable). A
2026-07-24 freshness sweep hand-fixed exactly this drift while the build stayed green —
"drift fails the build" did not hold for the code the docs teach.

The precedent shipped this session: `check:examples` (`examples/tsconfig.json` + a
`tsc -p` gate in `validate` **and** `ci.yml`) — a type-check, not a run — protects the
copy-me `examples/*.test.ts`. This plan applies that mechanic to the guide's fences,
plus the lint half deprecation needs.

## Two mechanisms, because `tsc` alone misses deprecation (review 2026-07-24)

The three stale examples the sweep fixed fall in two classes, and **no single tool
catches both**:

| Drift class                                                  | Example (sweep)                                                 | Mechanism                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unresolved import · removed/renamed export · wrong signature | the `.../helpers` import; `jsxElements` missing from its import | **`tsc --noEmit`** — a compile error                                           |
| Use of a `@deprecated`-but-still-valid method                | `.notImportFromCondition()`                                     | **ESLint `@typescript-eslint/no-deprecated`** — `tsc` exits 0 on it (verified) |

So the gate runs **both** over each extracted fence: a `tsc` type-check _and_ a
type-aware `no-deprecated` lint. Together they red-build all three sweep classes —
which is the honest bar for "close the dogfooding gap," not two-of-three.

## Design decisions (frozen)

- **Check, don't run.** `tsc --noEmit` + ESLint `@typescript-eslint/no-deprecated`
  against the built `@nielspeter/eess-ts` `.d.ts` — no fixtures, no execution. Both
  are type-aware, so both need the docs tsconfig (the lint rule as its
  `parserOptions.project`). Must run **after `build`**.
- **Which fences: self-contained fences — an `import` AND an own `project(…)` /
  `workspace(…)` setup.** _Corrected during build (2026-07-24)._ "Import-bearing" alone
  selected 114 fences and produced **166 false positives** — eess's docs write partial
  snippets that assume an ambient `p` and DSL functions (`Cannot find name 'p' /
classes`). Requiring the fence to set up its own project narrows to the genuinely
  copy-pasteable examples (114→31 fences, 175→7 _real_ failures). Non-TS fences and
  non-self-contained fragments are skipped.
- **A greppable opt-out, mirroring `eess-exclude`.** A fence immediately preceded by
  `<!-- eess-docs-code-skip: <reason> -->` is checked by neither pass — the same
  explicit, greppable sanction eess uses for rule exclusions (an intentionally
  "don't do this" fence, or one leaning on prior context). First-run false-positives
  are dispositioned by adding this directive **with a reason**, never by weakening the
  gate.
- **MVP home: `scripts/check-docs-code.mjs`.** Extraction by walking `docs/**/*.md`.
  Graduating the extractor into an `eess-md` `codeBlocks()` primitive (alongside
  `links()` / `pointers()`) is a follow-on, not required here.

## Approach

### Phase 1 — extract + select

`scripts/check-docs-code.mjs` walks `docs/**/*.md`, pulls ` ```ts ` / ` ```typescript `
fences, keeps the import-bearing ones, and drops any immediately preceded by an
`<!-- eess-docs-code-skip: … -->` directive. Report counts checked / skipped —
non-vacuity: zero checked means a broken extractor, not a pass.

**Files:** `scripts/check-docs-code.mjs` (new).

### Phase 2 — check each fence (type-check + deprecation-lint)

Write each selected fence to a temp `.ts` file, then run **both**:

- `tsc --noEmit` against a docs tsconfig mirroring `examples/tsconfig.json` (NodeNext,
  strict, `@nielspeter/eess-ts` + vitest types);
- ESLint with `@typescript-eslint/no-deprecated` enabled, type-aware, using that same
  tsconfig as its parser project.

A failure from either reports `docs/<file>.md` → fence N with the tool's message.

**Files:** a docs tsconfig (e.g. `docs/tsconfig.docs.json`) + a focused eslint config
for the fences; the harness in `check-docs-code.mjs`.

### Phase 3 — gate + dogfood + non-vacuity

Wire `check:docs-code` into `validate` (after `typecheck`) **and** into
`.github/workflows/ci.yml` as its own step — CI runs the gates explicitly, not via
`validate` (the `check:examples` lesson). Prove each pass bites (a deliberately-broken
fence and a deliberately-deprecated call → red, then revert). Disposition every fence
the gate reddens on first run: real drift → fix the example; intentional illustration →
add an `eess-docs-code-skip` directive with a reason.

**Files:** `package.json` (`check:docs-code` script + `validate` wiring),
`.github/workflows/ci.yml` (new step), and doc examples / directives as triaged.

## Out of scope

- **Fragment fences** (no import) — skipped. A directive-based opt-**in** for fragments
  (inject a standard import preamble, or a ` ```ts eess-check ` fence tag) is a
  possible follow-on.
- **Non-TS fences** (bash/yaml/mermaid/json).
- **Executing** the examples — checks only, like `check:examples`. No fixtures, no run.
- **README / package READMEs / `skills/` / `kit/`** — their links/pointers aren't in
  `check:corpus` either; that broader corpus-roots coverage gap is its own item.

## Success definition

Every import-bearing TypeScript fence in `docs/` either passes **both** the type-check
and the `no-deprecated` lint against the current `@nielspeter/eess-ts` types, or carries
a reasoned `eess-docs-code-skip` directive. Concretely: **all three** examples the
2026-07-24 sweep fixed by hand would have been red builds — the `.../helpers` import and
`jsxElements` via `tsc`, and `.notImportFromCondition()` via `no-deprecated`. The gate
reports the count it checked (provably non-vacuous).

## Resolved at freeze (2026-07-24)

- [x] **Deprecation** — _not_ punted. `tsc` misses it, but ESLint
      `@typescript-eslint/no-deprecated` (available: typescript-eslint 8.57.2) catches
      it; folded in as the gate's second pass. Success corrected back to three-of-three
      (review findings 1 + 3).
- [x] **Self-containment / false positives** — a greppable
      `<!-- eess-docs-code-skip: reason -->` directive (mirrors `eess-exclude`), triaged
      on first run (review finding 2).
- [x] **Fragment coverage** — out of MVP (skipped); a directive-based opt-in is a
      follow-on.
- [x] **Home** — standalone `scripts/check-docs-code.mjs` for MVP; the `eess-md`
      `codeBlocks()` primitive is a follow-on.
- [x] **Docs scope** — `docs/**` only; README / package READMEs / skills is the
      separate corpus-roots item.

## Build log (2026-07-24)

Built on branch `plan/0082-doc-code-fence-check`; stops before merge.

- [x] **Phase 1–2 — `scripts/check-docs-code.mjs`.** Extracts self-contained TS fences
      from `docs/**` (mdast; import + own `project`/`workspace`; skip-directive honoured),
      writes temp modules + a tsconfig, and runs both passes: `tsc --noEmit` and ESLint
      `@typescript-eslint/no-deprecated` (type-aware). Both proven to bite — a bad method →
      `TS2551`; a deprecated call (`crossLayer`) → `no-deprecated`; reverted → green.
- [x] **Phase 3 — wired** into `validate` (after `check:examples`) and `ci.yml`.
      32 self-contained fences checked · 288 fragments + 1 skip-directive'd skipped
      (non-vacuous).
- [x] **Selector corrected mid-build** (raised, not swapped silently): import-bearing →
      import + own project. See _Which fences_.
- [x] **The gate paid for itself — 4 real doc bugs it caught** (my 2026-07-24 manual sweep
      _and_ the PR review both missed them, because nothing compiled the docs):
      `modules(…).should().notDependOn(...)` is invalid (`notDependOn` is a _slice_ method;
      modules use `notImportFrom`) in the walkthrough **and the flagship `what-is-eess.md`
      one-pager** (fixed both; gave the one-pager its missing import so it's now
      self-contained + gate-protected); partial imports in `recipes.md` / `graphql.md`;
      a `.check?.()` on a `void`-returning `diagramMatchesCode` in `crossvalidate.md`.
      `cross-layer.md` documents the deprecated `crossLayer` on purpose → an
      `eess-docs-code-skip` directive + a deprecation callout steering to `correspondence()`.
