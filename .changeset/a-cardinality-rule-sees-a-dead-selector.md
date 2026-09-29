---
'@nielspeter/eess-ts': minor
---

A cardinality rule sees a dead selector

**Breaking (@nielspeter/eess-ts):** a rule asserting cardinality — `.notExist()` and
friends — now reports when it examined zero subjects **and** the path its selector names
holds TypeScript on disk.

Fixes [bug 0355](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0355-a-cardinality-rule-cannot-tell-none-exist-from-my-selector-broke.md).
`.notExist()` was exempt from the dead-selector diagnosis _and_ from ADR-010's evidence
floor — each exemption right on its own, and together they left this one rule shape with
nothing beneath it. A `.notExist()` whose selector silently stopped matching reported
**nothing** and exited 0, where the same selector under `notImportFrom` reported. It is the
worst shape to lose: a ratchet is designed never to fire, so a green is unremarkable and
nobody looks.

**Are you affected?** You have a rule of the form "this package is gone", "nothing imports
this any more", "this layer has no direct database access" — and its selector no longer
reaches the code it is about. You will now be told.

**What will NOT change.** A ratchet that is holding stays green. That is the whole
difficulty of this fix and why it reads the filesystem rather than the glob: after you
delete `legacy/`, `.notExist()` over `'**/legacy/**'` matches nothing **because the rule is
working**, and a holding ratchet is indistinguishable from a broken selector by the glob
alone. Only `holds-typescript` reports — the code you are asserting does not exist is right
there and your rule did not see it. `absent` (the ratchet working), `no-typescript` and
`not-determined` all stay green.

**If a rule does start reporting**, the selector is not reaching files that exist. The
usual causes are a tsconfig `include`/`exclude` that keeps them out of the project, or a
glob that names a path above the tsconfig root. Fix the selector rather than deleting the
rule — it has not been enforcing anything.
