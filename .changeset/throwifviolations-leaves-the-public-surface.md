---
'@nielspeter/eess': minor
'@nielspeter/eess-ts': minor
'@nielspeter/eess-md': minor
'@nielspeter/eess-mermaid': minor
'@nielspeter/eess-gherkin': minor
'@nielspeter/eess-crossvalidate': minor
---

**Breaking (@nielspeter/eess, @nielspeter/eess-ts): `throwIfViolations` is removed from the public surface.**

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
import { finishPreset } from '@nielspeter/eess-ts/presets'

finishPreset(violations, { report: 'throw' })
```

The import line is in the fence on purpose. This changeset's earlier draft said
in prose that `finishPreset` "is exported from the same three places the alias
was", and that was false for the `/presets` subpath — three reviewers caught it
and no gate could, because a claim about where a symbol lives is not checkable
until it is written as an import. `check:docs-code` now compiles the import lines
of every changeset fence ([bug 0273](https://github.com/nielspeter/eess/blob/main/work/bugs/fixed/0273-nothing-compiles-a-changesets-migration-snippet.md)),
so the sentence above is now a thing that fails the build rather than a thing you
have to trust. Swap the specifier for `@nielspeter/eess` or `@nielspeter/eess-ts`
if that is where you import from; all three carry it.

Behaviour is identical — emit to stderr, then throw one aggregated
`ArchRuleError`. Taking the option explicitly is the point: you can choose
`report: 'return'` or `'warn'` at the same seam, which the alias hid.

`finishPreset` is exported from all three places the alias was, so the import
line does not move. On `@nielspeter/eess-ts/presets` that became true in this
release: the alias was published on that subpath and its replacement never was,
so the migration above would have failed for anyone importing from there — which
is what `docs/api-reference.md` documented. Adding `finishPreset` to that barrel
is the additive half of this release.

**Why an alias was worth removing.** Not because it was unsafe — plan 0235
already changed it to take the ADR-014 receipt, so your current call is
type-correct and carries its evidence. It goes because it is a second name for
one door. ADR-008 says the caller owns reporting and the mode is the caller's to
choose; an alias that hard-codes one mode hides the choice behind a name that
reads as the only option, and ADR-008 recorded its removal when it was written.

The four dialects take a **minor**, not a patch. They do not use the symbol, but
they depend on the kernel, so this break reaches an adopter through whichever
dialect they installed. A patch would not be enough: changesets propagates an
inherited bump as a patch whatever the config says, and a patch is the release
an adopter's caret range takes without asking, under a changelog reading
"Updated dependencies". Naming them at minor is the only lever (bug 0185).
