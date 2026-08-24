# @nielspeter/eess

The dialect-independent **kernel** of the [eess](https://github.com/nielspeter/eess/blob/main/README.md) family.

This package is the engine every eess dialect runs on. It knows nothing about TypeScript, Mermaid, or any specific artifact format; it is generic over the element type being validated.

## What's in here

- `RuleBuilder<T, P>` — the fluent `.that().should().check()` chain, generic over element type `T` and project handle `P`
- `Predicate<T>`, `Condition<T>`, `Matcher<V>` — the interfaces dialects implement
- `ArchViolation` — the violation model; each dialect supplies its own element→violation adapter
- Baseline mode, diff-aware filtering, exclusions, and the terminal/GitHub/JSON formatters
- `definePredicate` / `defineCondition` — extension points for advanced users

## Two entry points

`@nielspeter/eess` publishes two:

| Specifier                   | What it is                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nielspeter/eess`          | The public API. Everything below is documented here, and a change to it is a versioned change.                                                      |
| `@nielspeter/eess/internal` | Family plumbing the sibling dialects share — cache registries, stderr guards, suppression counters, identity hashing, glob-tree internals. Not API. |

You want the root. `/internal` exists so the dialects can share one engine without
each name they touch becoming a public commitment; it is published because npm has
no way to ship a package-private module, not because it is for you. Nothing there
is documented, its contents change without a migration note, and no dialect
re-exports it. See
[ADR-011](https://github.com/nielspeter/eess/blob/main/adr/011-the-kernels-public-api-is-explicit.md).

If a symbol you used disappeared from the root, it moved here — the import path is
the only change.

## Kernel API reference

The fluent surface (`RuleBuilder`, `Predicate`, `Condition`, the combinators, the
formatters) is covered in the [docs site](https://nielspeter.github.io/eess/). This
section covers the supporting types you will meet in signatures.

### Reporting and severity

A preset never emits on its own — the caller owns emission (ADR-008).

- **`ReportMode`** — `'throw' | 'return' | 'warn'`. What a finisher does with findings: raise an `ArchRuleError`, hand them back, or print them as advisory and continue.
- **`ReportOptions`** — the emission controls: `format` (terminal/json/github) and `reason`, the rationale threaded into the output.
- **`RuleSeverity`** — `'error' | 'warn' | 'off'`, the value of a per-rule override.
- **`PresetBaseOptions`** — what every preset accepts: an `overrides` map of rule id → `RuleSeverity`, plus the reporting controls. Extend it when you write a preset so `{ report: 'return' }` works without your own plumbing.
- **`RuleBuilderLike`** — the one-method shape (`violations()`) a preset needs from anything it dispatches, so a preset is not coupled to a dialect's builder class.
- **`ArchFix`** — a machine-applicable edit on a violation: `file`, a `[start, end)` character span, and the `replacement` text. This is what `--fix` applies.

### The JSON report

`--format json` emits an **`ArchJsonReport`**: a `summary` (`total`, `errors`, `warnings`, `reason`), then **`ArchJsonViolation`** entries, plus **`ArchJsonSuppression`** for findings silenced by an `eess-exclude` comment and **`ArchJsonUntestedAllowlist`** for allowlists nothing exercised. Import these to type a tool that consumes eess output rather than re-declaring the shape.

### Filtering a run

- **`BaselineFilter`** — decides whether an already-accepted finding is suppressed by the baseline file.
- **`DiffFilterLike`** — decides whether a finding falls inside the changed region, for `--changed` runs.

Both are interfaces so a host can supply its own; the kernel ships implementations.

### Correspondence

`correspondence()` binds two `Selection`s and checks they agree in both directions.

- **`CorrespondenceOptions`** — its argument: the `left` and `right` selections, a join strategy, and optional per-side `suggest` callbacks for the two-sided message.
- **`KeyBy`** — the fast join: a key extracted per element, giving an O(n+m) match. Prefer it. The fallback `matchBy` predicate is O(n×m).
- **`RelationSpec`** — what `preserveRelations()` takes: how to read edges from each side, so the check covers relationships and not just membership.
- **`ElementInfo`** — the `name` / `file` / `line` a dialect reports for one element, which is what the message and the violation's location are built from.

### Declaring globs (for custom predicates)

A predicate written with `definePredicate` should declare the globs it matches on.
Without that it is opaque, so a vacuity diagnosis cannot tell "matched nothing
because the glob is dead" from "matched nothing because nothing was there" — and
any `or()` containing it becomes undiagnosable too.

- **`globNode(leaf)`** — wrap a single declared glob into a tree. The common case.
- **`globAnyOf(globs, kind, base?)`** — declare several alternatives at once.
- **`DeclaredGlob`** — one glob with its `kind` and `base`. **`GlobKind`** is what the glob matches against (`'file-path' | 'parent-dir' | 'import-target' | 'specifier' | 'literal'`) and **`GlobBase`** is what it is resolved against (`'absolute' | 'tsconfig-relative' | 'normalized'`).
- **`GlobTree<L>`** — the `and`/`any` tree the declarations form; **`DeclaredGlobs`** is that tree over `DeclaredGlob`, and **`GlobLeaf<L>`** is one position in it.
- **`OpaqueGlob`** — the explicit "this branch cannot be described" marker. Honest, and it is what keeps an undeclared predicate from silently reading as a dead one.
- **`GlobSite`** — a declared glob plus where it was written; **`GlobPosition`** is that where (`'selector' | 'discovery' | 'condition' | 'exclusion'`), which is what lets a diagnosis point at the glob you actually got wrong.
- **`GlobNode`** — the tree over `GlobSite`, i.e. a fully-stamped declaration ready to diagnose.

### Coverage evidence

- **`EdgeCoverage`** — one rule's evidence: how many `subjects` it saw, how many `edges` it actually tested, and a `reason` when that number is zero.
- **`UntestedReason`** — why zero: `'no-edges'` (nothing to test, usually correct), `'all-filtered'` (edges existed and every one was filtered out), `'none-matched'` (edges existed and none matched the allowlist). The distinction is the point — a rule that tested nothing should say which of the three it was, per ADR-010.

## Who uses it

You normally don't install this directly — you install a dialect:

- [`@nielspeter/eess-ts`](https://www.npmjs.com/package/@nielspeter/eess-ts) — TypeScript
- [`@nielspeter/eess-mermaid`](https://www.npmjs.com/package/@nielspeter/eess-mermaid) — Mermaid class diagrams

Install `@nielspeter/eess` directly only when authoring a new dialect or a cross-dialect tool on top of the kernel.

## License

MIT
