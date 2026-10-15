# Bug 0421: a waiver in a file the kernel cannot lex is ignored in silence

## Status

- **State:** Draft — found 2026-10-15 by the review of PR #211, which fixed bug 0419. No red test yet,
  and the fix is not designed.
- **Severity:** Medium — an honesty gap between a stated claim and its mechanism (`BUGS.md`'s Medium
  row). `docs/violation-reporting.md` says "A directive that cannot apply says so". For a file the
  kernel cannot lex, it now says nothing. Nothing passes that should fail: the finding stays red.
- **Origin:** self-found · review of PR #211 (architect and enforcement), 2026-10-15.
- **Reported:** 2026-10-15

## Symptom

Since bug 0419's fix, a file that is neither code nor Markdown yields no exclusion directive. An
adopter who writes `// eess-exclude some/rule: …` or `<!-- eess-exclude … -->` in a `.feature`,
`.yml`, `.mmd` or `.html` file sees the finding still reported, with no message saying the directive
was not read. Before the fix, some of those directives did apply. The adopter is left to guess why
the waiver stopped working.

## Root cause

`parseExclusionComments` returns no exclusions for such a file, so the inert-directive report in the
kernel's rule execution (bug 0255) has nothing to report. The parser does not tell an unreadable file
apart from a file with no directives.

## Fix

Not designed. A candidate: the parser reports, for such a file, the lines that hold `eess-exclude`
text, and the rule execution prints one line per file naming them and saying waivers are read only in
code and Markdown files. The docs already state where directives are read.

## Verification

- [ ] Red test first: a `.feature` file holding `// eess-exclude` text gets a message naming the file.
- [ ] `npm run validate` green.

Deferred: none
