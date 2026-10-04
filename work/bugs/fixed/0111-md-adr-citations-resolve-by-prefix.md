# Bug 0111: `eess-md`'s `adr/citations-resolve` matches a cited title by **prefix** — `it('r')` resolves against any test starting with `r`

## Status

- **State:** Fixed — option 1, ruled by the user 2026-10-04: `eess-md` no longer resolves
  `it('…')` titles; `eess-crossvalidate`'s AST-grounded `adrCitationsResolve` is the only
  title check. Breaking, marked `minor` for `eess-md`.
- **Severity:** High — **false green.** A `gated` mechanism reports OK over a
  citation whose test does not exist. This is [0104](./0104-it-title-capture-stops-at-any-quote.md)'s
  defect in a second package, in a stronger form.
- **Origin:** self-found · architect + enforcement review of 0104's fix, which
  found it independently of each other
- **Reported:** 2026-08-12

## Symptom

`packages/md/src/rules/adr.ts:51` builds the resolution regex with **no closing
delimiter**:

```ts
return new RegExp(`it(?:\\.\\w+)?\\(\\s*['"\`]${esc}`).test(content)
```

So the cited title only has to be a _prefix_ of a real title. Against a suite
containing exactly `it('rejects admin for anonymous requests', () => {})`:

| citation              | resolves? | correct? |
| --------------------- | --------- | -------- |
| `it('rejects admin')` | ✅ green  | no       |
| `it('rejects')`       | ✅ green  | no       |
| `it('r')`             | ✅ green  | no       |

A cited test can be renamed to anything sharing its first character and the
citation still passes.

The same file's extractor at `:44` carries 0104's defect too:

```ts
const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"]([^'"]+)['"]/g
```

It ends the capture at any of `'`/`"`, and does not know a backtick is a
delimiter at all — so ``it(`a template title`)`` is invisible on the markdown
side while `eess-crossvalidate` now reads it. **Two grammars, one artifact,
different answers.**

## Reproduction

Demonstrated end to end through the shipped `adrEnforcement` during the review of
0104: an ADR citing `` `it('rejects "admin" for an anonymous request')` `` with
`tests/a.test.ts` containing only `it('rejects everything, including this
unrelated case')` yields **0 violations**. The control — the same corpus with the
citation changed to a plainly absent title — yields 1.

## Root cause

Two independent shortcuts in the same file, both predating the family split:

1. `:44` — a character class cannot express "up to the matching delimiter" (the
   0104 root cause, unchanged here).
2. `:51` — a `.test()` with no anchor and no closing delimiter. The comment one
   line above (`adr.ts:46`) already calls the whole approach provisional:
   _"Text-level; 0059 upgrades to AST."_

## Why it matters

`verifyCitations` defaults to `true` (`packages/md/src/rules/adr.ts:117`), and
`scripts/check-corpus.mjs:71` runs `adrEnforcement` over `adr/**` on every
`validate`. `CLAUDE.md` documents this as the gated text-level ADR check. So the
repo ships, dogfoods, and documents a citation checker that accepts a one-letter
citation.

Our own three citations (`adr/003-fluent-builder-dsl.md:283`, `:284`,
`adr/006-framework-rules-architecture.md:102`) resolve **exactly** today, so
nothing is currently green on a lie — the same posture 0104 had before it was
fixed. The exposure is latent, not active. _(2026-10-04: that count was long stale — at the fix there were 43 cited
titles across 17 ADRs; `check:crossval` prints the live number.)_

## Fix

**Not** "share `it-title.ts`." `eess-md` cannot import it: the dependency runs
crossvalidate → md, and `eess/md-isolated` in `arch.rules.ts` forbids dialect
cross-imports. And the grammar must **not** move to `packages/core` — TypeScript
string-literal lexis in the dialect-independent kernel is exactly the poisoning
the family line exists to prevent.

Two honest options, to be decided:

1. **Delete md's citation verification.** Let `verifyCitations` narrow to "the
   cited path exists" and leave title resolution to
   `eess-crossvalidate`'s `adrCitationsResolve`, which is AST-grounded and now
   correct. `adr.ts:46` already frames md's copy as provisional pending exactly
   this. A markdown dialect should not carry a TypeScript lexer. **Recommended.**
2. **Keep two grammars deliberately** and pin them against one shared case table
   so they cannot drift apart again.

Either way this is a behaviour change for `eess-md` consumers who rely on
`verifyCitations`, so it needs a decision before a patch.

## Ruling and fix

**Option 1, ruled by the user on 2026-10-04.** A first attempt took option 2 instead (keep
md's resolver, make it exact) without asking, against this record's recommendation. Review
measured it: on 16 cases the two packages disagreed on 8, six of them md false greens — a
title present only in a commented-out test, in a string, inside `submit('…')` or
`suite.it(…)` — and closing those needs a TypeScript lexer in a markdown dialect, which is
option 1's reason. That attempt was never pushed. Put to the user with both options and their
costs, the ruling was option 1.

`packages/md/src/rules/adr.ts` now checks only the file paths a Mechanism cell cites. The
title extractor and the text resolver are deleted. `verifyCitations`' JSDoc, the preset's
JSDoc, `docs/markdown.md`, the package README and `CLAUDE.md` say a title is
`eess-crossvalidate`'s to resolve — and that with `eess-md` alone, nothing verifies one.

**The cost, stated.** An adopter who runs only `eess-md` and cites test titles had a check
that was wrong; now they have none, and the docs say so. That is the ruling's accepted risk.
In this repo, `check:crossval` resolves every cited title it can parse against the AST — all
43 today. Two things are lost that this repo had, both found by review and filed: a title cited
beside the wrong file used to be reported and now is not
([0382](../0382-a-cited-title-is-not-bound-to-the-file-cited-beside-it.md)), and a citation
with mismatched quotes used to be reported and is now parsed by neither package
([0381](../0381-a-citation-with-mismatched-quotes-is-checked-by-nothing.md)).

## Verification

- [x] done-otherwise: a citation that is a strict prefix of a real title does **not**
      resolve — pinned, not red-first, in the one package that still answers:
      `packages/crossvalidate/tests/md-ts.test.ts` ·
      `it('does not resolve a citation that is a strict prefix of a real title')`, over
      `it('exist')` and `it('e')` against the fixture's `it('exists')`. It passed on first
      run: `adrCitationsResolve` was already right, so this pins it rather than fixing it.
- [x] done-otherwise: `eess-md` no longer claims to answer —
      `packages/md/tests/adr-citations-check-paths-not-titles.test.ts` ·
      `it('reports no finding about a cited it() title, present or absent')` and
      `it('still reports a cited file path that does not exist')`. Both measured red before
      the deletion: the old code reported the absent title, and reported it again beside the
      missing path.
- [x] `npm run validate` green on `996afd0` (exit 0, 492 s). The review commit after it
      changes docs, records and comments only.

The `test(…)` question [0105](./0105-md-ts-drops-modifier-forms.md) deferred here — whether
the contract accepts `test(…)` beside `it(…)` — is no longer `eess-md`'s: it now concerns
only `adrCitationsResolve`. deferred→[0380](../0380-adr-citations-resolve-does-not-say-whether-test-counts.md).

Deferred: [0380](../0380-adr-citations-resolve-does-not-say-whether-test-counts.md),
[0381](../0381-a-citation-with-mismatched-quotes-is-checked-by-nothing.md),
[0382](../0382-a-cited-title-is-not-bound-to-the-file-cited-beside-it.md).
