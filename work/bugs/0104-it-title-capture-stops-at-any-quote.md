# Bug 0104: `it('…')` title capture stops at any quote character, not the opening delimiter — colliding prefixes resolve a citation to the wrong test

## Status

- **State:** Draft — claim confirmed against the source and reproduced against
  this repo's own test suite; no red test written yet.
- **Severity:** High — **false green.** A citation whose test no longer exists
  resolves successfully against a _different_ test that shares a truncated
  prefix, so `adrCitationsResolve` passes over exactly the drift it exists to
  catch.
- **Origin:** **inbound** — filed by an agent in an external project during its
  first downstream consumption of `@nielspeter/eess-crossvalidate@0.1.2`, and
  adopted here on 2026-08-12 after verification. Its illustrative examples were
  re-sourced to this repo's own suite (they carried the reporting project's
  language and identifiers); the diagnosis and fix are as submitted.
- **Reported:** 2026-08-12

## Symptom

Both title-capture regexes end the capture at **any** of `'`, `"`, or `` ` ``,
regardless of which one opened the string:

```ts
// packages/crossvalidate/src/md-ts.ts:25
const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g
// packages/crossvalidate/src/md-ts.ts:27
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

`gherkin-ts` shares the defect through the same construction at
`packages/crossvalidate/src/gherkin-ts.ts:46`, so `scenarioTestsResolve` and
`scenariosCovered` truncate identically. The fix must land in both, or in one
helper they share.

## Why it matters

This repo's severity scale calls a check that passes while the drift is present
the cardinal sin ([BUGS.md](./BUGS.md)), and this is that case with no
qualifier: a mechanism ADR tables cite as `gated` reports green over a citation
pointing at a deleted test.

**We are exposed.** 17 test titles in this repo contain a backtick and collapse
onto 4 truncated keys — 7 tests → `catches `, 6 → `matches `, 2 →
`does NOT match `, 2 → `catches angle-bracket `. No ADR currently cites a
backticked title, so `check:crossval` is green today. But the ADR authoring
convention in `CLAUDE.md` specifies test citations as `it('exact title')`,
and backticking a symbol inside a title is the established style in
`packages/md/tests/rules/ledger.test.ts` and
`packages/ts/tests/helpers/matchers-typescript.test.ts`. The first ADR row that
cites one of those titles inherits the defect.

## Fix

Capture the delimiter and require it to close the string, allowing escapes:

```ts
const IT_NAME_RE = /^it(?:\.\w+)?\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/
//                                    ^ captured        ^ anything but that delimiter
```

The title moves from group 1 to group 2 at both call sites. `IT_CITE_RE` takes
the same treatment, as does `gherkin-ts.ts:46`.

Verified against the shipped strings: the replacement captures the backticked
title whole instead of truncating at `catches `, and round-trips the
single-quoted, double-quoted, template-literal and `it.skip(…)` forms
unchanged.

Worth deciding while here: whether a citation that still matches several tests
after the fix should report the **source text** rather than the truncated key.
The current message names `it('catches ')`, a string that appears nowhere, which
is what made the failure hard to read.

A `patch` changeset on `@nielspeter/eess-crossvalidate` — a resolution fix, no
surface change.

## Verification

- [ ] Red test written first: a title containing a backtick inside single quotes
      resolves to its full text, and a citation to test A does **not** resolve
      against test B when A is renamed. Both fail today — the first with an
      ambiguity error, the second by passing.
- [ ] Same pair of tests added for `gherkin-ts`'s `scenarioTestsResolve`.
- [ ] Titles using `"` and `` ` `` as the outer delimiter round-trip unchanged.
- [ ] An escaped delimiter inside a title (`it('it\'s fine')`) captures whole.
- [ ] `npm run validate` green.

Deferred: none.
