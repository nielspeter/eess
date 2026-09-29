---
'@nielspeter/eess-ts': patch
---

Correcting what 0.10.0's changeset promised

0.10.0 said, of the new cardinality check: _"Are you affected? You have a rule of the form
'this package is gone' … **You will now be told.**"_ That is true for a path-glob selector
over a path holding TypeScript on disk. It is **false for three shapes**, and that entry has
shipped, so the correction lands here instead of where it was written.

If you are planting violations against your `.notExist()` rules to verify them — and you
should — these are the ones that stay green for reasons that are not "the rule works":

**1. A ratchet whose selector is not a path glob.** The check keys on the selector's globs,
so a rule selecting by name, decorator, or `satisfy()` predicate is exactly as vacuous as
before:

```ts
import { classes } from '@nielspeter/eess-ts'
```

`classes(p).that().haveDecorator('Deprecated').should().notExist()` gets nothing. This shape
is taught in our own docs, so the promise reads as covering it and the mechanism does not.

**2. A selector that is well-formed but names nothing** — a typo, or a directory renamed
without updating the rule. It matches nothing, which is indistinguishable from the ratchet
holding, so it stays green. Before 0.10.0 `doctor` reported it — along with every _healthy_
ratchet, which is why that signal was narrowed. The trade was noise for silence, and it is a
trade rather than a pure win.

**3. A repository above the disk walk's 50,000-entry budget.** The whole classification
degrades to "could not determine" — which means green — for every path at once, and nothing
says so.

`docs/migrating-to-0.10.md` now carries all three. Nothing here changes behaviour; it changes
what we claimed.
