# Bug 0555: the locale comments say no runtime row can catch `localeCompare`, and a mixed-case pair can

## Status

- **State:** Draft — found 2026-10-28 by the testing re-check of PR #274; measured.
- **Severity:** Low — the source scan still guards the defect; the comments overclaim why it is
  the only guard, and a cheap runtime row is left unwritten.
- **Origin:** self-found, 2026-10-28. Recorded rather than fixed in PR #274, which changed the
  locale probe's pair and not the argument the comments make.
- **Reported:** 2026-10-28

## Symptom

Three comments state that a runtime row cannot catch an identity-bearing sort that uses
`localeCompare`:

- `packages/ts/tests/tools/scan-locale-ordering.test.ts:3`: "a runtime row provably cannot
  catch it";
- `packages/core/src/violation.ts:209`: "a runtime row cannot catch it, because on an `en-US`
  machine both comparators agree";
- `packages/ts/tests/conditions/identity-does-not-move.test.ts:291`: "no runtime row can see a
  defect whose symptom depends on the machine running it".

The comparators agree on an `en-US` machine for a **lowercase** ASCII pair. They disagree on a
mixed-case pair in every locale, because codepoint order puts every capital before every
lowercase letter. Measured, Node 24.22.0:

```text
['Foo','bar'] by localeCompare, en-US / cs-CZ / de-DE / sv-SE / host:  bar,Foo
['Foo','bar'] by codepoint:                                            Foo,bar
```

So a row importing `Foo` and `bar` and asserting the discriminator `Foo,bar` goes red on CI with
`localeCompare` reinstated. It would not catch a defect that only a locale shows (the Czech
`ch`), which is what the scan is for; it would catch the mutant the comments say nothing can.

## Fix

Not chosen. Either a runtime row with a mixed-case pair beside the scan, and the comments
reworded to say what each guard sees; or the comments narrowed to the locale-only case. The
row is to be measured red with `localeCompare` reinstated before it is cited.

## Verification

- [ ] The comments say what each guard catches, with the mixed-case case stated.
- [ ] If a runtime row is added, it is measured red with `localeCompare` reinstated.
