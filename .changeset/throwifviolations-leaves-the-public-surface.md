---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking: `throwIfViolations` is removed from the public surface.**

ADR-008 recorded its removal and ADR-014 restated it; the symbol stayed
exported anyway, which is the half-true row plan 0263 exists to close. It is
gone from three barrels: the kernel root (`@nielspeter/eess`), the `eess-ts`
root, and the `@nielspeter/eess-ts/presets` subpath.

**What to do instead.** The call was a one-line alias for `finishPreset` in its
default mode, and it always had been since plan 0070. Replace

```ts
throwIfViolations(violations)
```

with

```ts
finishPreset(violations, { report: 'throw' })
```

Behaviour is identical — emit to stderr, then throw one aggregated
`ArchRuleError`. `finishPreset` is exported from the same three places the alias
was, so the import line does not move. Taking the option explicitly is the point:
a caller can now choose `report: 'return'` or `'warn'` at the same seam, which
the alias hid.

**Why an alias was worth removing.** It took a bare `ArchViolation[]`. ADR-014
requires a verdict to carry its evidence — `examined` and its declarations — so
a door that accepts a bare array is a door where a pass can be assembled without
evidence, under a name that reads as a convenience.

The four dialects take a **minor**, not a patch. They do not use the symbol, but
they depend on the kernel, so this break reaches an adopter through whichever
dialect they installed. A patch would not be enough: changesets propagates an
inherited bump as a patch whatever the config says, and a patch is the release
an adopter's caret range takes without asking, under a changelog reading
"Updated dependencies". Naming them at minor is the only lever (bug 0185).
