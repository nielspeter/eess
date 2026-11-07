# Migrating to 0.22

> Written for the release tagged `v0.22.0`. All six packages move; the kernel goes to 0.12.0. The tag
> is not `v0.12.0` because `v0.12.0` and [Migrating to 0.12](./migrating-to-0.12.md) are an earlier,
> unrelated release, and tags only go up (RELEASING.md). Check what you have with
> `npm ls @nielspeter/eess @nielspeter/eess-ts @nielspeter/eess-md @nielspeter/eess-mermaid @nielspeter/eess-gherkin @nielspeter/eess-crossvalidate`.

| package                          | from   | to     |
| -------------------------------- | ------ | ------ |
| `@nielspeter/eess`               | 0.11.0 | 0.12.0 |
| `@nielspeter/eess-ts`            | 0.15.3 | 0.16.0 |
| `@nielspeter/eess-md`            | 0.18.0 | 0.19.0 |
| `@nielspeter/eess-mermaid`       | 0.9.3  | 0.10.0 |
| `@nielspeter/eess-gherkin`       | 0.8.3  | 0.9.0  |
| `@nielspeter/eess-crossvalidate` | 0.13.0 | 0.14.0 |

Every dialect at this release depends on the kernel at `^0.12.0`, which on `0.x` does not admit
0.11.x. A dialect left at its old version installs a second kernel beside it. **Upgrade the packages
you use together.** `eess-crossvalidate` 0.14.0 raises its peer floors to this release's dialects:
`eess-ts` 0.16.0, `eess-md` 0.19.0, `eess-mermaid` 0.10.0 and `eess-gherkin` 0.9.0 or later. An older
dialect installed beside it is a peer-dependency conflict at install (`ERESOLVE`).

**This release adds no feature. It closes seven false greens**, in two kinds: a check that ran over
an input that never loaded, and a configuration finding that a path which does not throw let pass.
Each made a run green when it should have been red. Expect runs that passed to fail; each such
failure was a broken input or setup that nothing reported.

## Code edits

Only code that calls the kernel's baseline helpers or builds its own selections needs an edit.

### `collectViolations` and `generateBaseline` can throw

```ts
import { collectViolations, generateBaseline } from '@nielspeter/eess'
```

`collectViolations` rethrows anything a rule's `check()` throws that is not an `ArchRuleError`: an
`ArchConfigError` (such as an unknown report mode), or a bug in the rule. It used to return no
violations for a rule that refused to run, and the baseline written over it was empty. It also keeps
the violations of a second kernel copy's `ArchRuleError`, which it used to drop.

`generateBaseline` still writes the baseline for every finding it can accept, then prints each
configuration finding (`bypassFilters`) it left out and throws an `ArchRuleError` carrying them, as
`eess-ts baseline` prints them and exits 1. It used to leave them out without a word. Over findings
that are all configuration findings it overwrites the file with `count: 0`.

To migrate: let the throw fail the script that writes the baseline, and fix what it names. eess-ts's
own `collectViolations` and `generateBaseline` are unchanged.

### A selection you build yourself can say its source loaded nothing

```ts
import { correspondence, type Selection } from '@nielspeter/eess'
```

A `Selection` has an optional `sourceEmpty: true`. eess's own `select()`s set it; a selection you
build from a loader of your own does not, and stays as before. Set it when your loader read nothing,
and a `correspondence()` over it reports the empty source instead of passing. Leave it off a loaded
source that selects nothing: an empty selection can be the right answer. When you merge two
selections into one, carry it across, as [the cross-validation guide](./crossvalidate.md) shows.

## Builds that go red without a code edit

### A preset under `report: 'warn'` fails on a configuration finding

A preset under `{ report: 'warn' }` throws every configuration finding (`bypassFilters`), such as an
unmet `expectNonEmpty`, as a builder's `.warn()` already did. It used to print it and exit 0.
Ordinary violations under `warn` are still printed and returned.

### A check over an input that loaded nothing reports it

These used to pass over an input that never loaded. Each now reports the empty input as an
unsuppressable finding, **even under `expectEmpty: true`**: the declaration is about a loaded input
that selects nothing, not about one that never loaded.

- `correspondence()` over a side whose source loaded nothing: an eess-ts project with no source
  file, an eess-md corpus with no document, an eess-gherkin feature set with no feature file, or a
  `files()` tree with no file at all (an empty or missing `cwd`).
- eess-crossvalidate: `diagramMatchesCode`, `adrCitationsResolve`, `embeddedDiagramsMatchCode`,
  `tableErAgree`, `scenarioCitationsResolve`, `scenarioTestsResolve`, `scenariosCovered` and
  `scenarioExemptionsCurrent`, over any input they read that loaded nothing.
- eess-gherkin: a rule over a feature set with no feature file, even with `.expectEmpty()`.

Two loaded sides that select nothing still pass, and a feature file with no scenario yet is still a
loaded source.

To migrate: the finding does not yet name which input loaded nothing ([bug 0641](../work/bugs/0641-the-empty-source-finding-names-no-source.md)). Check each input
the rule or preset takes (the tsconfig's `include`, the corpus roots, the feature roots, the diagram,
the `cwd`) and fix the one that loaded nothing, not the declaration.

## Not changed

- A glob in `files()` that matches nothing in a tree that holds files still passes; whether it
  should is an open decision ([bug 0644](../work/bugs/0644-whether-a-files-glob-is-a-loader-or-a-selector.md)). So does an eess-mermaid diagram with no class ([bug 0643](../work/bugs/0643-whether-a-class-diagram-with-no-class-is-an-empty-source.md)).
- Everything else in [Migrating to 0.17](./migrating-to-0.17.md) and the pages before it still applies
  to an upgrade from an older version.
