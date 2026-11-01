# Bug 0591: the empty-corpus message names a tsconfig to a Markdown user

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/md/dist`, built from the current tree; no
  red test yet.
- **Severity:** Low — fails closed: the rule is red, as it should be, but one of the three causes
  its message offers does not exist in an eess-md project.
- **Origin:** self-found ·
  [proposal 023](../proposals/023-md-a-footnote-reference-has-its-definition.md)'s enforcement
  review; reproduced before filing.
  [Plan 0427](../plans/completed/0427-this-repository-checks-its-mermaid-blocks-parse.md) noted
  the same wording as a residual for eess-mermaid and filed no record.
- **Reported:** 2026-11-01

## Symptom

When an eess-md corpus loads no document, every rule over it gives one configuration finding
([ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) §3: an empty source outranks any
declaration). Its text reads "an empty project, an unreadable tsconfig, or a glob resolving to
nothing … fix the project/source configuration". An eess-md corpus has no tsconfig and no
project. Its source is `corpus({ cwd, roots })`, and the cause that is real here, a root glob
that matches nothing, is named last and in words that are not eess-md's.

## Reproduction

An empty `docs/` folder, with `corpus({ cwd, roots: ['docs/**'] })`. Two rules over it,
`mentions(c, { pattern: /\[\^[^\]\s]+\]/g }).that().satisfy(not(areLinked())).should().notExist()`
and `docs(c).should().haveTitle()`. Measured with a throwaway script against `packages/md/dist`,
0.13 s:

```text
-- mentions().notExist()
: this rule's source loaded zero units before any selection ran — an empty project, an unreadable tsconfig, or a glob resolving to nothing. This outranks any .expectEmpty() declaration and any condition satisfied by emptiness: fix the project/source configuration, not the rule.
-- docs().haveTitle()
: this rule's source loaded zero units before any selection ran — an empty project, an unreadable tsconfig, or a glob resolving to nothing. This outranks any .expectEmpty() declaration and any condition satisfied by emptiness: fix the project/source configuration, not the rule.
```

## Root cause

The text is the kernel's, written once for every dialect: `zeroLoadedSourceViolation`
(`packages/core/src/vacuity-findings.ts:100`). The terminal calls it whenever a dialect reports an
empty source (`packages/core/src/terminal-builder.ts:335`). eess-md reports one through
`CorpusRuleBuilder.sourceEmpty`, and nothing lets it supply its own words.

Its emitter-seam sibling, `sourceEmptyViolation` (`packages/core/src/emitter-findings.ts:156`),
says "the project, the tsconfig, or the glob" the same way. Only a hand-assembled receipt reaches
it (`packages/core/src/report.ts:174`), so a builder user does not see it, but its comment says it
"says the same thing in the same words", so a fix to one should keep the two in step.

[ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) already draws this line for
the zero-subject advice: the kernel takes the fact, and the tsconfig wording stays in eess-ts. The
zero-loaded message was left on the kernel's side of that line.

## Fix

Not designed. The direction: the kernel's text names only what is true of every source (it loaded
nothing; a glob that matches nothing is one cause), and a dialect may add its own cause and
remedy, eess-ts its tsconfig, eess-md its corpus roots. Tests in `packages/core/tests/` and
`packages/md/tests/` match on "loaded zero units", so the change must keep that phrase or update
them.

## Verification

- [ ] Red test written first, through an eess-md builder over an empty corpus: the finding does not
      say "tsconfig", and it names the corpus's roots.
- [ ] An eess-ts project that loads nothing is still told about its tsconfig.
- [ ] The emitter-seam sibling and the terminal's finding say the same thing.
- [ ] A changeset naming `@nielspeter/eess`, and `@nielspeter/eess-md` if it supplies its own
      words.
- [ ] `npm run validate` green.

Deferred: none
