# Bug 0523: a heading in NFD form misses a name written in NFC, with no near-miss note

## Status

- **State:** Draft — recorded 2026-10-19 from PR #252's testing review (minor 7a). A record only;
  no red test written yet.
- **Severity:** Low — a silent pass that needs a corpus mixing Unicode normal forms. An absence rule
  over such a heading is green.
- **Origin:** self-found · PR #252's testing review, 2026-10-19.
- **Reported:** 2026-10-19

## Symptom

eess-md matches a section name exactly (`matchName`, `packages/md/src/model/name-match.ts`), and its
near-miss test (`isNearMiss`, `packages/md/src/model/label.ts`) folds only ASCII case and whitespace.
A heading typed as `Résumé` in decomposed form (NFD: `e` + U+0301) is a different string from the name
`Résumé` written composed (NFC: U+00E9). So:

- `docs(c).should().haveSection('Résumé')` reports the document as missing the section, with no note
  saying a heading of that name is there;
- `sections(c).that().areNamed('Résumé').should().notExist()` is green over the NFD heading, and the
  section-name scan reports nothing.

This predates PR #252 (the exact match is older), but sections and `inSections` make the absence
form reachable.

## Also noted from the same review, behaviour correct, no fix asked

- **(7b) A setext heading written over two lines** (`Foo` / `bar` / `===`) is named with a literal
  newline, `"Foo\nbar"`, so `areNamed('Foo bar')` misses it. The near-miss scan reports it (whitespace
  is folded there), so it fails closed.
- **(7c) `haveContent()` counts a section holding only a link-reference definition**
  (`[x]: http://…`) as non-empty. That is [plan 0522](../plans/completed/0522-the-rest-of-blocks-3-and-14-on-sections.md)'s choice, stated in the docs' list of what the
  scan and the conditions do not see; nothing pins it.

## Fix

Not designed: normalise both sides to NFC in `matchName` and `isNearMiss`, or report a heading equal
to the name under normalisation as a near miss. Either changes what a released `haveSection` reads.

## Verification

- [ ] Red first: an NFD `## Résumé` under `areNamed('Résumé').should().notExist()` gives a finding
- [ ] `npm run validate` green

Deferred: none
