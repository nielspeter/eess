---
'@nielspeter/eess-ts': minor
---

**Breaking:** `.expectNonEmpty()` on a `.notExist()` rule is now reported. It used to set a flag that nothing read, so the rule passed over zero subjects exactly as without it (bugs 0467 and 0466). The new finding says the rule can never pass: a selected subject fails `.notExist()`, and an empty selection fails the declaration. It is reported whether or not the selection is empty. An empty project or a dead glob is still reported first.

To migrate, remove `.expectNonEmpty()` from `.notExist()` rules. To catch a glob typo that empties the rule, add a positive rule over the same population beside it, for example:

```ts
modules(p).that().resideInFolder('src/legacy/**').should().notImportFrom('src/app/**') // reds when it selects nothing
```

On positive rules nothing changes: an empty selection was already a finding.
