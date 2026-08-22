# Migrating From ts-archunit

`@nielspeter/eess-ts` is the successor to `@nielspeter/ts-archunit`. Same engine,
same rule vocabulary, same baseline format — it was renamed when it became one
dialect of a family rather than a standalone tool.

**Most projects change one line.** This page is longer than that because four things
do change, and one of them is silent if you do not know about it.

> **This page is written against `@nielspeter/eess-ts` 0.4.0 and later.** Earlier
> published versions predate the rename in §3 and the fixes §1 relies on — on
> `0.2.1` the `crossProject` import below does not resolve at all. Check what you
> installed with `npm view @nielspeter/eess-ts version` before working through it.

## The short version

```diff
-npm uninstall @nielspeter/ts-archunit
+npm install -D @nielspeter/eess-ts
```

```diff
-import { project, classes } from '@nielspeter/ts-archunit'
-import { recommended } from '@nielspeter/ts-archunit/presets'
+import { project, classes } from '@nielspeter/eess-ts'
+import { recommended } from '@nielspeter/eess-ts/presets'
```

Then work through the four changes below. Run `npx eess-ts check` after each.

## 1. Preset calls in a rule file need `report: 'builders'`

**This is the one that bites, and on a clean codebase it bites silently.**

ts-archunit's presets returned builders and never ran them. eess-ts's presets
_enforce_ by default — they run the rules and throw. In a rule file, where you
spread the result into an array, that changes what the spread contains:

```diff
-export default [...recommended(p)]
+export default [...recommended(p, { report: 'builders' })]
```

Without the option, `...recommended(p)` spreads the preset's **result**, not its
builders. What happens next depends on your codebase and neither outcome is what
you want:

| your codebase  | what you get                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| has violations | the loader rejects it — `default export entry [0] is not a rule builder`, exit 1     |
| **is clean**   | the result is an **empty array**, so the file exports `[]` and every rule disappears |

`tsc --noEmit` catches neither: a spread of the wrong array type is not a type
error. Since `0.4.0`, `eess-ts check` refuses a rule file that contributed no rules
rather than printing a green tick over it — so the clean case now fails loudly too.
On older versions it exits 0.

Applies to every preset: `recommended`, `agentGuardrails`, `layeredArchitecture`,
`strictBoundaries`, `dataLayerIsolation`. `eess-ts init` scaffolds the correct form.

**Presets are otherwise unchanged** — same five names, same `overrides` keys,
measured against `0.61.0`.

## 2. Inline exclusion comments changed token

```diff
-// ts-archunit-exclude no-console: legacy logger, tracked in TICKET-123
+// eess-exclude no-console: legacy logger, tracked in TICKET-123
```

**Nothing tells you if you miss one.** The old token is not recognised, so the
exemption simply stops applying and the violation comes back — on a line carrying a
comment that says it is waived. It fails loud rather than green, so nothing is
hidden, but the attribution is confusing until you know.

This is the widest surface in the migration: the comments are spread across your
whole codebase, not confined to a rules file. Find them first:

```bash
grep -rn 'ts-archunit-exclude' src/
```

## 3. `correspondence()` is now `crossProject()`

```diff
-import { correspondence } from '@nielspeter/ts-archunit'
-correspondence(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
+import { crossProject } from '@nielspeter/eess-ts'
+crossProject(p).side(routes, byName()).side(handlers, byName()).beComplete().check()
```

Same builder, same chain, same behaviour. It was renamed because `@nielspeter/eess`
exports a _different_ `correspondence({ left, right })` — a kernel primitive that
binds two selections from any loaders — and one word naming two incompatible APIs in
one family is a trap.

`setCorrespondence` and `CorrespondenceResult` keep their names. These are the
**only two exports** that moved: every other ts-archunit export is present in
eess-ts under the same name.

**One consequence worth knowing:** the violation `rule` string changes with it, from
`correspondence [a <-> b]` to `crossProject [a <-> b]`. Baselines key on that string
(see below), so baselined findings from this builder — and only this builder — need
regenerating.

## 4. The CLI and config are renamed

| ts-archunit                     | eess-ts                              |
| ------------------------------- | ------------------------------------ |
| `npx ts-archunit check`         | `npx eess-ts check`                  |
| `ts-archunit.config.ts` / `.js` | `eess-ts.config.ts` / `.js`          |
| `arch-baseline.json`            | `arch-baseline.json` — **unchanged** |

Rename the config file; the contents are unchanged. Update any `package.json`
scripts that call the old binary.

## Your baseline transfers unchanged

**Measured, not assumed.** An existing `arch-baseline.json` works as-is:

- Same filename, same `hashVersion: 5`, byte-identical hashing.
- Verified end-to-end on a real project: a baseline generated by
  `ts-archunit baseline` was consumed by `eess-ts check --baseline` with **all
  entries suppressed**, and the same run without it reported the same violations —
  so the green is suppression, not an empty run.

Two exceptions, both from renames rather than from the format:

- **`crossProject` findings** — the `rule` string changed (§3), so those entries
  orphan. Regenerate.
- **`crossLayer` → `crossProject` rules**, if you migrate any (see below) — the
  rule name, element and message all change, so every entry for them orphans.

Everything else carries over. Do not regenerate in bulk "to be safe" — a
regeneration accepts whatever drift the old baseline was holding back.

## Optional: `crossLayer` is deprecated

Not required to migrate. `crossLayer()` still works; it now carries an
`@deprecated` tag pointing at [`crossProject`](/cross-project), which supersedes it
**for pairings that are key equality**.

If your `.mapping(fn)` is not key equality — prefix matching, directory nesting,
"imports its schema" — or if you use `satisfyPairCondition`, keep `crossLayer`. See
[Migrating From `crossLayer`](/cross-project#migrating-from-crosslayer) for which
applies to you.

## Checking you are done

```bash
npx eess-ts check
```

Read the summary line. `0 rules across N files` means your rules did not load —
almost always §1.

```
✓ eess-ts — 25 rules across 2 files · 0 failing (8.71s)
```

If a run reports findings you had already accepted, check whether the output says
your baseline was not applied — a rule file that enforces at module scope prints
before the CLI can filter it, and that is §1 again.

## See Also

- [Getting Started](./getting-started.md)
- [CLI Reference](./cli.md)
- [Architecture Presets](./presets.md) — including what `report` does
- [Cross-Project Validation](./cross-project.md)
