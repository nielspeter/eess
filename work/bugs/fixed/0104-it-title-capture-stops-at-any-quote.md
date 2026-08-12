# Bug 0104: `it('…')` title capture stops at any quote character, not the opening delimiter — colliding prefixes resolve a citation to the wrong test

## Status

- **State:** Fixed — the title grammar ends the capture at the delimiter that
  opened the string, in one module both presets read. 12 tests red before the
  change, 65 green after; the ADR↔test gate now has a non-vacuity fixture.
  A three-persona review of the fix found a regression in it before merge (see
  _Fix_) and three further defects, filed as 0111–0114.
- **Severity:** High — **false green.** A citation whose test no longer exists
  resolved successfully against a _different_ test that shared a truncated
  prefix, so `adrCitationsResolve` passed over exactly the drift it exists to
  catch.
- **Origin:** **inbound** — filed by an agent in an external project during its
  first downstream consumption of `@nielspeter/eess-crossvalidate@0.1.2`, and
  adopted here on 2026-08-12 after verification. Its illustrative examples were
  re-sourced to this repo's own suite (they carried the reporting project's
  language and identifiers); the diagnosis and fix are as submitted.
- **Reported:** 2026-08-12 · **Fixed:** 2026-08-12 (PR #42)

## Symptom

Both title-capture regexes ended the capture at **any** of `'`, `"`, or `` ` ``,
regardless of which one opened the string. As shipped in
`@nielspeter/eess-crossvalidate@0.1.2`, at `md-ts.ts:25` and `:27` (the lines are
historical — the grammar now lives in `it-title.ts`):

```ts
const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g
const IT_NAME_RE = /^it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/
```

A test title delimited by `'` that _contains_ a backtick — the ordinary way to
name a symbol inside prose, and this repo's own house style — is captured only
up to that backtick. Run against the real regex:

| source title                                   | captured key |
| ---------------------------------------------- | ------------ |
| ``it('catches `HACK` comment inside a body')`` | `catches `   |
| ``it('catches `any` in a return position')``   | `catches `   |

Two distinct tests collapse onto one key. Because the markdown side truncates
identically, two ADR citations collapse onto the same key too.

This fails in **both** directions.

**False red** — with both tests present, `correspondence` sees one left key
matching two right elements, and reports an element string that appears nowhere
in the corpus:

```
adr/00NN-…:109 cited it() "it('catches ')" matches multiple tests
  — the correspondence is ambiguous
```

**False green — the serious one.** Rename **one** of the two tests so it no
longer shares the prefix, and the surviving test still answers for the renamed
one, because the ADR's citation truncates to a key that still exists. The
citation then names a title that exists nowhere in the project, and the gate is
green on it. A renamed test silently orphans its citation — precisely the drift
`adrCitationsResolve` is advertised to catch.

## Reproduction

The truncation itself, against the shipped regex:

```js
const IT_NAME_RE = /^it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/
IT_NAME_RE.exec("it('catches `HACK` comment inside a body')")[1]
// → 'catches '        ← not the title
```

End-to-end, in any project where two tests share everything up to their first
backtick:

```ts
// tests/a.test.ts
it('rejects `admin.*` for an anonymous request', () => {})
it('rejects `admin.*` for a citizen', () => {})
```

An ADR Enforcement row citing the first of them (shown as raw source, since the
citation itself contains backticks):

```text
| … | 2 | Vitest · `it('rejects `admin.*` for an anonymous request')` | gated |
```

1. `adrCitationsResolve(corpus, project)` → **ambiguous**, though both tests
   exist and the citation names exactly one. _(false red)_
2. Rename the second test so it no longer starts `rejects `. Re-run → green.
3. Now rename the **first** test — the one actually cited — instead. Re-run →
   still green, because the truncated key `rejects ` is still satisfied by the
   other test. _(false green)_

## Root cause

A character class cannot express "up to the matching delimiter"; it only
expresses "up to any delimiter". The opening quote is matched by `['"`]` but
never captured, so the closing side has no way to require the _same_ character.

`gherkin-ts` shared the defect through the same construction (its own
`IT_NAME_RE`, at `gherkin-ts.ts:46` as shipped), so `scenarioTestsResolve` and
`scenariosCovered` truncated identically. The fix had to land in both, or in one
helper they share — it landed in the helper.

## Why it matters

This repo's severity scale calls a check that passes while the drift is present
the cardinal sin ([BUGS.md](../BUGS.md)), and this is that case with no
qualifier: a mechanism ADR tables cite as `gated` reports green over a citation
pointing at a deleted test.

**We were exposed.** Measured on `origin/main` at the time of the fix: 31 test
titles in this repo contain a backtick, and 17 of them sat in a collision — 7
keyed on `catches `, 6 on `matches `, 2 on `does NOT match `, 2 on `catches
angle-bracket `. 18 distinct keys stood for 31 distinct titles. No ADR cited a
backticked title, so `check:crossval` was green. But the ADR authoring
convention in `CLAUDE.md` specifies test citations as `it('exact title')`, and
backticking a symbol inside a title is the established style in
`packages/md/tests/rules/ledger.test.ts` and
`packages/ts/tests/helpers/matchers-typescript.test.ts`. The first ADR row that
cited one of those titles would have inherited the defect.

## Fix

Capture the delimiter and require it to close the string, allowing escapes. The
grammar moved to `packages/crossvalidate/src/it-title.ts` — one definition,
because two presets read it and both had the same defect independently:

```ts
const QUOTED = `(?<q>['"\`])(?<title>(?:\\\\.|(?!\\k<q>)[^\\\\])+)\\k<q>`
```

Named groups rather than the submitted `\1`/group-2 form, so the pattern can be
embedded after other groups without renumbering. Three consumers are built from
it — `itTitleOf` (`it`, for md↔ts), `itOrTestTitleOf` (`it|test`, for gherkin↔ts)
and `citedItTitles` (unanchored + global, for an ADR's Mechanism cell) — which
keeps the callee alternation at the call site. That matters: [0105](../0105-md-ts-drops-modifier-forms.md)
records that widening md↔ts to accept `test(…)` is a contract question for the
ADR table, not a parser change, and a single shared regex would have smuggled it
in the moment 0105's callee guard is fixed.

Titles are compared as **raw source text**, so `it('it\'s fine')` keys on
`it\'s fine`, backslash included. Both sides read the same grammar, so an ADR
cites what the test file says rather than what the string evaluates to. That has
a cost the first draft did not state and the review made explicit: a title's raw
text is prettier's to change — `it("say 'hi' to \"them\"")` reformats to
`it('say \'hi\' to "them"')`, moving the key while the citation's code span stays
put, so a correct citation can go red after a routine `npm run format`. Loud, not
silent, but it belongs in the contract. It is now in the module header, in
`CLAUDE.md`'s enforcement-table convention, and in the `eess-adr-author` skill.

**The review caught a regression in this fix, before merge.** Sharing one
permissive grammar between two input classes was wrong: the anchored readers get
guaranteed-valid TypeScript from `getText()`, where `\` is always an escape and
delimiters balance; `citedItTitles` reads arbitrary prose, where neither holds.
Given a cell with a malformed citation followed by a good one —

```text
`it('first` and `it('second')`
```

— the permissive body ran past the second citation's opening quote and closed
there, yielding one bogus key and **dropping a real citation from the check
entirely**. The old grammar, which could not cross a quote, recovered both. A
citation nobody checks is the same false green this record is about, so the fix
briefly made one direction worse. The prose variant is now tempered: it cannot
cross a line, and cannot consume the start of another citation. Tempering on the
full opening — callee, paren and quote — leaves a title that merely mentions
`it(x)` intact.

The same review found the unanchored scanner had no left word boundary, so
`submit('save')`, `emit('drift')` and `audit('x')` all read as citations. Fixed
here; it predates this change.

The open question — whether a citation matching several tests should report the
source text rather than the truncated key — **resolved itself**. The key now
_is_ the source text, so the violation reads
`it('catches `GONE` in a deleted test')`, which appears in the ADR verbatim.

A `minor` changeset on `@nielspeter/eess-crossvalidate`: the resolution fix is a
`patch`, but closing the non-vacuity gap below needed a denominator the package
did not expose, so `adrCitationStats` is added — the md↔ts counterpart of
`scenarioTestStats`.

## Verification

Red first: with the old grammar restored under the new tests, **12 fail**; with
the fix, all **65** crossvalidate tests pass.

- [x] Red test written first: a title containing a backtick inside single quotes
      resolves to its full text (`0003-backticked.md` — two tests identical up to
      their first backtick; the citation named one and was reported ambiguous),
      and a citation to test A does **not** resolve against test B when A is
      renamed (`0005-renamed.md` against the single-test `orphan/` project — the
      false green, which passed before the fix).
- [x] Same pair added for `gherkin-ts`: a citation to a scenario titled
      ``Reject a `SAVE10` code that was already used`` resolves, and
      `scenariosCovered` counts it. Its own feature root (`quoted-features/**`),
      so the scenario counts the other tests assert do not move.
- [x] Titles using `"` and `` ` `` as the outer delimiter round-trip unchanged —
      asserted on the exact captured text in
      `packages/crossvalidate/tests/it-title.test.ts`, and end-to-end through an
      ADR in `0004-delimiters.md`.
- [x] An escaped delimiter inside a title (`it('it\'s fine')`) captures whole.
- [x] The closing back-reference is load-bearing: review mutated it away and all
      60 tests stayed green, so `it("mismatch')` → `undefined` is now asserted.
- [x] The prose scanner survives a malformed neighbour, refuses a line break, and
      ignores `submit(`/`emit(`/`audit(` — the three cases the tempering exists
      for, each a test.
- [x] **The gate is non-vacuous.** `scripts/nonvacuity/bad-md-ts.mjs` asserts
      `crossval/adr-citations-resolve` on the `0005-renamed.md` + `orphan/`
      collision, guards its own denominator, and proves the clean direction so a
      permanently-red gate cannot pass for a working one. Measured: exit 1 clean ·
      exit 0 with the extractor emptied · exit 2 with 0104's truncation restored.
      Before this, stubbing `citedItTitles` to `[]` left `check:crossval` **and**
      `check:nonvacuity` green.
- [x] `GATE_FOR` maps a `check:*` to a **list** of gates, and every gate row must
      be claimed by some `check:*`. The reverse direction found an unclaimed row
      on its first run (`internal arch`, which `check:arch` does run).
- [x] `npm run validate` green.

Deferred — each re-homed, none left with this record:

- **`eess-md` carries the same defect, in a stronger form** — its citation check
  resolves by _prefix_. It cannot import this module (crossvalidate → md, and
  `eess/md-isolated` forbids the reverse), so the fix is a design decision, not a
  patch. **→ [0111](../0111-md-adr-citations-resolve-by-prefix.md)** (High).
- **Three of `check:crossval`'s five presets still have no fixture** — code→diagram,
  `haveUniqueTitles`, `scenariosCovered`. **→ [0112](../0112-three-crossval-presets-have-no-fixture.md)**.
- **`correspondence()` drops `.rule({ suggestion })`**, so this rule's remedy had
  to go through `suggest.left` instead. **→ [0113](../0113-correspondence-drops-rule-suggestion.md)**.
- **String-literal lexis belongs behind the eess-ts boundary** — `ArchCall` has no
  accessor for a literal argument, which is why this grammar exists in a bridge
  package at all. **→ [0114](../0114-string-literal-lexis-lives-outside-the-engine.md)**,
  which is the prerequisite for retiring 0111's duplicate.
