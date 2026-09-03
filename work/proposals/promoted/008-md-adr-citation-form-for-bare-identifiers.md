# Proposal 008 — md: `adrEnforcement`'s citation matcher has no form for a bare, non-file identifier (e.g. an architecture rule id)

**State:** Promoted — → [bug 0236](../../bugs/fixed/0236-the-compose-path-for-a-custom-citation-form-is-undocumented.md), which declares `**Implements:** proposal 008` and owns the documentation this ruling called for. Promoted 2026-09-03, the day of the ruling. Reviewed 2026-09-03 (architect · product · enforcement, plus survey): Problem **accepted**; `citationForms` **declined** — both halves already ship as public API of `eess-md` and no page showed them together. Ruling is **Docs-only**; see _Review_ below, which is the operative section. Two findings the review surfaced outrank the ask and are not its owners: [bug 0111](../../bugs/0111-md-adr-citations-resolve-by-prefix.md) and [bug 0234](../../bugs/0234-adr-citations-resolve-has-no-nonvacuity-fixture.md). As submitted: surveyed against the shipped 0.5.0 source (`packages/md/src/rules/adr.ts`); not measured against a spike, no red test written yet.
**Priority:** Low — the consuming project already has a small, working, separately-tested substitute; this is about discoverability/reach, not a broken gate.
**Origin:** inbound — a consuming project (`@nielspeter/eess-md` pinned at `^0.3.0`), found during the same eess-alignment audit as proposal 007. The project is not named here: this repo does not carry consumer identities.
**Affects:** `packages/md/src/rules/adr.ts` (`adrEnforcement`, specifically `validateCitations`/`PATH_RE`/`IT_CITE_RE`).

## Problem

`adrEnforcement`'s citation resolution (the `adr/citations-resolve` rule) recognizes exactly two citation forms inside an ADR's `## Enforcement` table `Mechanism` cell: a backtick-quoted file path with a dot-extension, and an `it('…')`/`it.skip('…')` call. A consuming project whose enforcement mechanism is a _named rule id_ in its own architecture-rule tool (not a file, not a test) — e.g. `` `acme/router-procedures-not-public` `` naming a rule defined in that project's `arch.rules.ts` — has no citation form the preset can resolve, because a bare id has neither a file extension nor an `it(` shape.

## Evidence

Verified directly against `packages/md/src/rules/adr.ts` (current, 0.5.0):

```ts
const PATH_RE = /`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g
const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"]([^'"]+)['"]/g
```

`PATH_RE` requires a literal `.` followed by an extension-shaped suffix inside the backticks; `IT_CITE_RE` requires an `it(`/`it.skip(` call. A backtick-quoted string like `` `acme/router-procedures-not-public` `` matches neither — `validateCitations` (same file, `:63-92`) never inspects it, so an ADR citing a rule id this way is not verified at all: the citation can go stale (the rule renamed or deleted in the consumer's own rule file) with `adrEnforcement` reporting nothing wrong.

The consuming project confirmed this independently and wrote its own ~50-line binding in its corpus-check tool (the consumer's `tools/eess-check.ts`) that:

1. Reads its own frozen rule-id snapshot (`arch.rules.snapshot.json`) as the set of live ids.
2. Regexes each ADR's text for `` `(acme/[a-z0-9-]+)` `` citations.
3. Cross-checks both directions — a cited id that isn't live, and a live id cited by no ADR.

Its own comment states the same conclusion reached independently above: "eess-md cannot do this itself: its citation matchers need a dot-extension path or an `it(\`, and a backticked rule id is neither." (the consumer's `tools/eess-check.ts`)

## Proposed API

Not a new hardcoded third regex (a project-specific id shape like `acme/…` is not eess's to guess), but an extension point on `AdrEnforcementOptions` letting a consumer supply its own citation matcher(s) alongside the two built-in ones:

```ts
export interface AdrEnforcementOptions extends PresetBaseOptions {
  // ...existing options...
  /**
   * Additional citation forms to resolve inside a Mechanism cell, beyond the
   * built-in file-path and it('…') forms. Each entry's `pattern` finds
   * candidate citations (capture group 1 = the cited identifier); `resolve`
   * decides whether a given identifier is live. Both directions of
   * `adr/citations-resolve` (cited-but-not-live, live-but-not-cited) apply to
   * matched citations the same way they do for the built-in forms.
   */
  readonly citationForms?: readonly {
    readonly pattern: RegExp
    readonly resolve: (id: string, corpus: Corpus) => boolean
  }[]
}
```

This mirrors the shape the consuming project already hand-built (a pattern to find candidates, a resolve function to verify them), generalized so the resolution logic — not just the regex — moves into the corpus's own domain (e.g. reading a frozen rule snapshot) without eess-md needing to know what a "rule id" is.

## Alternatives considered

- **A dedicated third built-in form for "bare identifier."** Rejected as the default: eess-md has no way to know what counts as a _live_ bare identifier for an arbitrary consumer (a rule id, a feature flag name, anything else) — that's inherently project-specific, which is exactly why the consumer's own workaround needed a project-specific snapshot file to resolve against.
- **Leave it as a documented gap, consumer keeps its own binding.** Works today, is small, and is separately tested (per the consumer's own tooling). Rejected as the default answer only because the _shape_ of what's missing (a pluggable citation form) is general enough to be worth exposing once, rather than every consumer with a non-file, non-test enforcement mechanism re-deriving the same two-direction resolve logic from scratch.

## Acceptance criteria

- A `citationForms` entry whose `resolve` returns `false` for a matched candidate produces exactly one `adr/citations-resolve` violation naming that candidate and the clause — same shape as an unresolved file-path citation today. Break class: a custom form that matches but whose `resolve` result is ignored (e.g. only used for the reverse "cited but not live" direction, never the "live but not cited" direction) would silently pass the direction the built-in forms already can't skip.
- The **both-directions** guarantee `adr/citations-resolve` already gives file/test citations must hold for a custom form too: a rule id that exists in the consumer's live set but is cited by no ADR must also be flagged, not just a stale citation. This is the reverse-direction check the consuming project had to hand-build itself (the consumer's `tools/eess-check.ts`) precisely because it wasn't available as part of the preset.
- Supplying a `citationForms` pattern that overlaps a built-in form's match (e.g. a path-shaped string) must not double-report the same clause — one violation per clause per unresolved citation, regardless of how many patterns matched it.

## Open questions

- Whether resolution against "the corpus" is sufficient context, or whether some consumers need something outside the md corpus entirely (as this consumer does — its live rule set comes from a frozen JSON snapshot of a _different_ dialect's output, not from any markdown file). The `Corpus` type may need nothing extra since the consumer's own `resolve` closure can read whatever file it wants — but this is worth the maintainer's own judgment, not assumed here.
- Whether this is better shaped as a `citationForms` option on `adrEnforcement` itself (as proposed) or as a lower-level primitive (`validateCitations`-equivalent exported standalone) that a consumer composes with its own rule from `haveTableRowsSatisfying`, bypassing the preset's opinion entirely. The consuming project's current workaround does the latter today (its own hand-rolled binding, not a preset composition), which may mean the real gap is discoverability of `haveTableRowsSatisfying`/`docs()` as building blocks rather than a change to the preset's contract.

## Scope

`packages/md` only (`rules/adr.ts`). No change to `packages/core`, `packages/ts`, `packages/gherkin`, or `packages/crossvalidate`.

## Review — 2026-09-03

**Ruling: Docs-only**

Three lenses reviewed this independently and reached the same place: both halves of the ask already ship as public API, the gap is discoverability, and one acceptance criterion is written against a guarantee that does not exist.

**AC 2's premise is factually false, and it makes the proposal unimplementable as written.** The criterion says the "both-directions guarantee `adr/citations-resolve` already gives file/test citations must hold for a custom form too". `adrEnforcement` gives no such guarantee. `validateCitations` (`packages/md/src/rules/adr.ts:63-92`) is one-directional in both branches — cited path → `corpus.fileIndex.has(p)` at `:73`, cited `it()` → `testDefinesIt` at `:82`. Nothing enumerates a live set. It structurally cannot: it runs as a per-row callback returning `string[]` (`:142-144`), blind to other rows and to any universe. The repo's strongest citation check is one-directional too — `packages/crossvalidate/src/md-ts.ts:173` uses `.beComplete({ direction: 'left-to-right' })`.

So an implementer following AC 2 either builds nothing (matching the built-ins, silently not delivering the criterion) or builds a reverse engine for _custom_ forms that built-in forms lack — making `adr/citations-resolve` mean two things depending on which regex matched, and giving a custom form a **stronger** contract than the built-ins. Rewriting the criterion honestly ("the reverse direction is new work, for all forms or none") turns it into a second, larger ask than the citation form itself.

**The proposed signature cannot satisfy its own criterion either.** `resolve: (id, corpus) => boolean` is a membership predicate, and a predicate cannot enumerate a set. "Live but cited by no ADR" needs the universe. The API and its AC 2 are mutually exclusive.

**Both halves already ship.** The reverse direction is `correspondence().beComplete({ direction: 'both' })` (`packages/core/src/correspondence.ts:108`), re-exported by `eess-md` together with its option types (`packages/md/src/index.ts:41,47`), whose own comment calls `rows()` + `correspondence()` the flagship table-binding path. The forward half is `haveTableRowsSatisfying` (`packages/md/src/conditions/table-rows.ts:31`) — public, taking an arbitrary `row: (ctx) => string[]` over the Mechanism cell, and what `adrEnforcement` is itself built from three times over. `adr.ts:22-27` already states the intended path in as many words: _"Teams whose ADRs differ compose their own gate from the generic primitives."_ The consumer's own ~50-line binding is `md-ts.ts:36-179` in shape; the deltas are the right-hand selection and one option token.

Adding `citationForms` would instead make an explicitly _opinionated_ preset into a plugin host, and permanently own overlap, ordering and `Corpus`-contract semantics for twenty lines a user can already write. The proposal's Open Question 2 reaches this conclusion and does not act on it.

**Placement, stated so it is not re-litigated:** neither the kernel nor `eess-md` should take it. The kernel must not learn "ADR enforcement table" — that poisons five dialects. `eess-md` would need a second completeness engine beside `correspondence()`, and the resolution input (another dialect's frozen snapshot) is not a `Corpus` fact.

**Two findings that outrank the ask.**

1. **[Bug 0111](../../bugs/0111-md-adr-citations-resolve-by-prefix.md) is open, High severity, and filed as a false green** — against `adr.ts:51` (the resolution regex has no closing delimiter, so `it('r')` resolves against any test whose title starts with `r`) and `:44` (`IT_CITE_RE` truncates at any quote, blind to backticks). This proposal quotes both lines as Evidence without mentioning it. A citation mechanism that resolves by prefix should be fixed before it is extended.
2. **`adr/citations-resolve` has no non-vacuity fixture.** `scripts/check-nonvacuity.mjs:1290` is `['corpus/adr', () => gateNode('bad-adr.mjs', 'adr/valid-tiers')]` — tiers only — and the fixture says so itself (`scripts/nonvacuity/bad-adr/adr/999-bad.md:10`: "`adr/citations-resolve` check stays green — isolating the tier failure"). `gateCoverage()` enumerates `check:*` scripts, not rule ids, so nothing notices. AC 1 names the right break class and supplies no mechanism to detect it.

**Recommended next step.** In order: fix 0111; add the missing non-vacuity row for `adr/citations-resolve`; then close the real gap here — discoverability — with a worked recipe in `docs/markdown.md` teaching `rows()` + `correspondence({ direction: 'both' })` over a caller-supplied selection, plus a docstring pointer from `adrEnforcement`. `docs/markdown.md` documents `verifyCitations` (`:323`) and the rule ids (`:326`) and never the compose path, which is exactly proposal 004's shape: a capability already public in the package it names. This does not become a plan; it becomes documentation, and two bugs.
