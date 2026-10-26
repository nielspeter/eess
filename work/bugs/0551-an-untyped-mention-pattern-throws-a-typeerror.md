# Bug 0551: an untyped mention pattern throws a `TypeError`

## Status

- **State:** Draft — found 2026-10-25 by the architect's re-check of
  [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md); reproduced, no
  red test yet.
- **Severity:** Low — the run still fails, so nothing passes that should not. The message names a
  property of `undefined`, not the option the caller got wrong.
- **Origin:** self-found, 2026-10-25. Recorded rather than fixed in
  [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md), whose `foreign`
  option gets the check this one lacks.
- **Reported:** 2026-10-25

## Symptom

`mentions(corpus, { pattern })` checks only that `pattern` cannot match the empty string
(`packages/md/src/model/mentions.ts:57-64`). Node imports a rule file without checking its types
([ADR-015](../../adr/015-the-kernel-extends-resolution-never-execution.md)), so a missing or
non-`RegExp` pattern reaches `re.source` or `re.flags` and throws a `TypeError`, not the
`ArchConfigError` a configuration mistake gets everywhere else.

## Repro

Against the built eess-md, 2026-10-25:

```js
mentions(corpusFromText({ 'a.md': '# A\n\nbug 0001\n' }), {})
// TypeError: Cannot read properties of undefined (reading 'source')
mentions(corpusFromText({ 'a.md': '# A\n\nbug 0001\n' }), { pattern: 'bug \\d{4}' })
// TypeError: Cannot read properties of undefined (reading 'replace')
```

## Fix

`validateMentionPattern` refuses a `pattern` that is not a `RegExp` (`instanceof RegExp`, the guard
`packages/md/src/builders/vocabulary.ts:170` uses) with an `ArchConfigError` naming the option.

## Verification

- [ ] A red test: a missing and a string `pattern` each throw `ArchConfigError` naming `pattern`.
- [ ] Fix to green; the eess-md patch changeset.
