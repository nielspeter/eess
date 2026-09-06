# CLI

Run architecture rules without a test runner. The CLI wraps the same API you use in vitest/jest behind `npx eess-ts` commands.

> The binary is installed as `eess-ts`, so `npx eess-ts check …` runs the CLI. The config file is read from `eess-ts.config.ts` (or `.js`) in your project root.

Most teams should put rules in test files and run them with vitest. The CLI is for teams that need standalone rule execution — pre-commit hooks, CI pipelines without a JS test runner, or one-off audits against unfamiliar codebases.

## Commands

### `check` — Run Rules

```bash
# Run rules from a file
npx eess-ts check arch.rules.ts

# Multiple rule files
npx eess-ts check layers.rules.ts naming.rules.ts body.rules.ts

# With baseline (only new violations fail)
npx eess-ts check arch.rules.ts --baseline arch-baseline.json

# Diff-aware (only report violations in changed files)
npx eess-ts check arch.rules.ts --changed --base main

# Watch mode — re-run on file changes
npx eess-ts check arch.rules.ts --watch

# Output format
npx eess-ts check arch.rules.ts --format github

# Autofix deterministic violations (dry-run preview)
npx eess-ts check spec.rules.ts --fix

# Autofix and write the changes
npx eess-ts check spec.rules.ts --fix --apply
```

#### `--fix` — deterministic autofix

`--fix` applies the repairs eess can prove are unique — a broken markdown link whose target moved to exactly one file, or a shortened `path:line` pointer that resolves to one file. It is **dry-run by default** (previews the edits, writes nothing); add `--apply` to write. Ambiguous cases, or anything requiring judgment (a missing section, a drifted spec), are never auto-applied — they are reported for a human or agent to resolve. This is the fix-side of the enforcement tiers: the deterministic layer repairs what it can prove, and routes the rest.

### `baseline` — Generate Baseline

```bash
# Generate baseline from current violations
npx eess-ts baseline arch.rules.ts --output arch-baseline.json
```

Records all existing violations so that `check --baseline` only fails on new ones.

> **The baseline applies to findings the CLI collects.** A rule file that calls a
> terminal at module scope — `.check()` outside `export default [...]`, or a preset
> without `report: 'builders'` — prints its own findings before the CLI sees them,
> so `--baseline` does not filter those. `check` reports this rather than failing
> silently; the fix is the array-export form above, or `report: 'builders'` on the
> preset. See [Presets → `report`](./presets.md). See [Gradual Adoption](/core-concepts#baseline-mode) for details.

### `explain` — Dump Rule Metadata

```bash
# JSON output (default)
npx eess-ts explain arch.rules.ts

# Markdown table
npx eess-ts explain arch.rules.ts --markdown

# Agent prompt block — sentinel-wrapped, for pasting into an agent's context
npx eess-ts explain arch.rules.ts --format agent
```

Outputs a structured description of every rule — id, description, because, suggestion — without executing them. `--format agent` emits an imperative, sentinel-wrapped block an agent can consume directly. See [Explain Command](/explain) for use cases.

## Options

| Flag                | Short | Description                                                                                           |
| ------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| `--baseline <path>` |       | Baseline file for filtering known violations                                                          |
| `--output <path>`   |       | Output path for baseline file (default: `arch-baseline.json`)                                         |
| `--changed`         |       | Only report violations in files changed since base branch                                             |
| `--base <branch>`   |       | Base branch for `--changed` (default: `main`)                                                         |
| `--format <format>` |       | Output format: `terminal`, `json`, `github`, `auto` (default: `auto`); `explain` also accepts `agent` |
| `--fix`             |       | Show deterministic autofixes for unique repairs (dry run)                                             |
| `--apply`           |       | Write the fixes surfaced by `--fix`                                                                   |
| `--watch`           | `-w`  | Watch for file changes and re-run (check command only)                                                |
| `--config <path>`   |       | Path to config file                                                                                   |
| `--version`         | `-v`  | Show version number                                                                                   |
| `--help`            | `-h`  | Show help message                                                                                     |

## Config File

Optional `eess-ts.config.ts` in your project root:

```typescript
import { defineConfig } from '@nielspeter/eess-ts'

export default defineConfig({
  project: 'tsconfig.json',
  rules: ['arch.rules.ts'],
  baseline: 'arch-baseline.json',
  format: 'auto',
  watchDirs: ['src'], // directories to watch in --watch mode
})
```

CLI flags override config file values. Config file overrides defaults.

## Rule Files

A rule file exports an array of rule builders:

```typescript
// arch.rules.ts
import { project, classes, modules, call } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

export default [
  classes(p).that().extend('BaseRepository').should().notContain(call('parseInt')),
  modules(p).that().resideInFolder('src/domain/**').should().notImportFrom('src/repositories/**'),
]
```

The CLI calls `.check()` on each builder. Rule files use the same API as test files.

## Watch Mode

`--watch` re-runs all rules when source files change:

```bash
npx eess-ts check arch.rules.ts --watch
```

- Watches `src/` by default (configurable via `watchDirs` in config)
- Also watches the rule files themselves
- Debounces rapid saves (250ms window)
- Clears screen between runs, preserving scrollback
- Only triggers on `.ts` / `.tsx` / `.mts` / `.cts` file changes
- Queues re-runs if a change arrives during an active check

### Large projects

Every run, watch or not, reloads the project: ts-morph parses every file the tsconfig includes at construction, and the first rule that resolves an import builds the type checker on top of that. Those two stages are the cost, and they scale with the files you hand the rules, not with the rules you write. A suite of purely syntactic rules never pays the second stage; one dependency rule pays it once per process.

`--changed` does not reduce either stage. It filters the report to files touched since the base branch; evaluation stays whole-project, because cross-file rules need the graph.

The lever that does reduce the cost is the project itself: a narrower `tsconfig.json`, or one `project()` per rule file so each file loads only what its rules need. Its cost is stated in the same breath: cross-file conditions — `beImported()`, `haveNoUnusedExports()`, `beFreeOfCycles()`, layer rules — only see what was loaded, so a module imported only from outside the narrowed project reads as dead. Keep the whole graph for the rules that need it, and narrow for the rest. Splitting rules into test files under `vitest --watch` is the same trade with the runner's file watching in place of `--watch`.

**Linux users:** `fs.watch` with recursive watching may need a higher inotify limit:

```bash
sudo sysctl fs.inotify.max_user_watches=524288
```

## CI Integration

Architecture rules are tests. If your CI already runs `npm test`, it already runs architecture rules.

For standalone CI steps:

```yaml
# .github/workflows/ci.yml
- run: npx eess-ts check arch.rules.ts --format github
```

The `--format github` flag emits violations as GitHub Actions annotations — they appear inline on PR diffs.

Use `--format auto` (the default) to auto-detect the environment.
