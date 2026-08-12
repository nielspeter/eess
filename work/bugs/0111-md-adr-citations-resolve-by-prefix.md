# Bug 0111: `eess-md`'s `adr/citations-resolve` matches a cited title by **prefix** — `it('r')` resolves against any test starting with `r`

## Status

- **State:** Draft — reproduced against the shipped `adrEnforcement` and against
  the raw regex; no red test written yet.
- **Severity:** High — **false green.** A `gated` mechanism reports OK over a
  citation whose test does not exist. This is [0104](./fixed/0104-it-title-capture-stops-at-any-quote.md)'s
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
fixed. The exposure is latent, not active.

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

## Verification

- [ ] Red test written first: a citation that is a strict prefix of a real title
      does **not** resolve. Passes today.
- [ ] A citation to a template-literal-delimited title behaves the same way in
      `eess-md` and `eess-crossvalidate`, or `eess-md` no longer claims to answer.
- [ ] `npm run validate` green.

Deferred: none.
