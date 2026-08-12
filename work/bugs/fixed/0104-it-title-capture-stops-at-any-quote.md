# Bug 0104: `it('…')` title capture stops at any quote character, not the opening delimiter — colliding prefixes resolve a citation to the wrong test

## Status

- **State:** Fixed — one title grammar, shared by both presets, ends the capture
  at the delimiter that opened the string. 12 tests red before the change, 60
  green after.
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
the cardinal sin ([BUGS.md](./BUGS.md)), and this is that case with no
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
keeps the callee alternation at the call site. That matters: [0105](./0105-md-ts-drops-modifier-forms.md)
records that widening md↔ts to accept `test(…)` is a contract question for the
ADR table, not a parser change, and a single shared regex would have smuggled it
in the moment 0105's callee guard is fixed.

Titles are compared as **raw source text**, so `it('it\'s fine')` keys on
`it\'s fine`, backslash included. Both sides read the same grammar, so an ADR
cites what the test file says rather than what the string evaluates to; this is
stated in the module header.

The open question — whether a citation matching several tests should report the
source text rather than the truncated key — **resolved itself**. The key now
_is_ the source text, so the violation reads
`it('catches `GONE` in a deleted test')`, which appears in the ADR verbatim.

A `patch` changeset on `@nielspeter/eess-crossvalidate` — a resolution fix, no
surface change.

## Verification

Red first: with the old grammar restored under the new tests, **12 fail**; with
the fix, all **60** crossvalidate tests pass.

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
- [x] `npm run validate` green.

Deferred: none.
