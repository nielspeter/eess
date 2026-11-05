# Bug 0621: the collapse merges two causes reported on one line

## Status

- **State:** Draft — measured 2026-11-05 on `fix/0461-the-collapse-note` (the kernel's collapse
  after [bug 0461](./fixed/0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)'s
  fix); no red test yet.
- **Severity:** Medium — the build stays red, but a cause and its remedy are dropped from the report:
  an author fixes the one shown, runs again, and only then meets the other.
- **Origin:** self-found · the enforcement review of
  [bug 0461](./fixed/0461-the-dedupe-note-says-one-option-for-any-repeated-config-finding.md)'s fix.
- **Reported:** 2026-11-05

## Symptom

One rule, `sections(c).that().areNamed('A').should().haveLink()`, over a document whose line 5 holds
two HTML links eess-md cannot read for two different reasons:

```markdown
## A

see <a href=./a.md title=a/b>x</a> and <a href=./b.md data-x=c/d>y</a>
```

reports two `md/unread-link` findings at `docs/p.md:5`, as
`it('two sites on one line with different causes are two findings')`
(`packages/md/tests/links-html-evidence.test.ts`) pins: one says to quote `href`'s and `title`'s
values, the other `href`'s and `data-x`'s. `dedupeConfigFindings`, which `eess-ts check` and
`checkAll` run over every run, keeps one of them, with the `title` remedy only, and appends
"Reported 2 times in this run under this rule id and subject; listed once." The `data-x` cause is
gone from the report.

## Root cause

`keyFor` (`packages/core/src/dedupe-config-findings.ts:126`) keys a configuration finding on
`(file, id, element)`, assuming the element names the cause. For `md/unread-link` the element is the
site's location, `<relPath>:<line>` (`packages/md/src/model/unread-link.ts:72`), so two causes on one
line share a key. Read from the source and not measured, other eess-md producers key the same way:
`packages/md/src/predicates/section.ts:85`, `packages/md/src/builders/field-findings.ts:45` and
`packages/md/src/builders/vocabulary.ts:194`. [Bug 0420](./0420-a-failed-code-block-parse-is-misdescribed-by-the-kernel.md)'s
second symptom is the same merge for two code-block parse failures, keyed on the parser's
`name@version`.

## Fix

Not designed. Either the key includes what distinguishes the cause (the message, or a cause field a
producer sets), or each producer's `element` names its cause and not only its place. The fix
measures every producer `keyFor` admits, since keying on the message would split a preset's fan-out
whenever its wording carries a count.

## Verification

- [ ] Red first: the document above, one rule, through `dedupeConfigFindings`: both causes and both
      remedies survive.
- [ ] Each producer named above measured, and either fixed or shown to name its cause.
- [ ] [Bug 0420](./0420-a-failed-code-block-parse-is-misdescribed-by-the-kernel.md)'s second symptom
      re-measured against the fix.
- [ ] A changeset naming `@nielspeter/eess` and each dialect whose producer changes.
- [ ] `npm run validate` green.

Deferred: none
