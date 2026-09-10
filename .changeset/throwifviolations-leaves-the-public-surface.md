---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess, @nielspeter/eess-ts): `throwIfViolations` is removed from the public surface.**

It is gone from three barrels: the kernel root (`@nielspeter/eess`), the
`eess-ts` root, and the `@nielspeter/eess-ts/presets` subpath.

**What to do instead.** The call was a one-line alias for `finishPreset` in its
default mode, and always had been. Replace

```ts
throwIfViolations(violations)
```

with

```ts
import { finishPreset } from '@nielspeter/eess-ts/presets'

finishPreset(violations, { report: 'throw' })
```

It is on all three barrels, so the import line does not move wherever you took
the old one from:

```ts
import { finishPreset } from '@nielspeter/eess'
import { finishPreset as fromTsRoot } from '@nielspeter/eess-ts'
import { finishPreset as fromPresets } from '@nielspeter/eess-ts/presets'
```

Behaviour is identical — emit to stderr, then throw one aggregated
`ArchRuleError`. Taking the option explicitly is the point: you can choose
`report: 'return'` or `'warn'` at the same seam, which the alias hid.

On `@nielspeter/eess-ts/presets` that became true in this release: the alias was
published on that subpath and its replacement never was, so `finishPreset` is
added there now. If you import from `/presets`, you need this version or later
for the migration to resolve.

**Why an alias was worth removing.** Not because it was unsafe — your current
call is type-correct and always has been. It goes because it was a second name
for one door, and the name hard-coded a choice that belongs to you: whether a
preset throws, returns its violations, or warns. `finishPreset` makes that an
argument you pass rather than a decision baked into which function you call.

The four dialects take a **minor**, not a patch. They do not use the symbol, but
they depend on the kernel, so this break reaches an adopter through whichever
dialect they installed. A patch would not be enough: changesets propagates an
inherited bump as a patch whatever the config says, and a patch is the release
your caret range takes without asking, under a changelog reading "Updated
dependencies". Naming them at minor is the only way you get told.
