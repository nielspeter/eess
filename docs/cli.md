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

Records all existing violations so that `check --baseline` only fails on new ones. See [Gradual Adoption](/core-concepts#baseline-mode) for details.

### `explain` — Dump Rule Metadata

```bash
# JSON output (default)
npx eess-ts explain arch.rules.ts

# Markdown table
npx eess-ts explain arch.rules.ts --markdown
```

Outputs a structured description of every rule — id, description, because, suggestion — without executing them. See [Explain Command](/explain) for use cases.

## Options

| Flag                | Short | Description                                                           |
| ------------------- | ----- | --------------------------------------------------------------------- |
| `--baseline <path>` |       | Baseline file for filtering known violations                          |
| `--output <path>`   |       | Output path for baseline file (default: `arch-baseline.json`)         |
| `--changed`         |       | Only report violations in files changed since base branch             |
| `--base <branch>`   |       | Base branch for `--changed` (default: `main`)                         |
| `--format <format>` |       | Output format: `terminal`, `json`, `github`, `auto` (default: `auto`) |
| `--watch`           | `-w`  | Watch for file changes and re-run (check command only)                |
| `--config <path>`   |       | Path to config file                                                   |
| `--version`         | `-v`  | Show version number                                                   |
| `--help`            | `-h`  | Show help message                                                     |

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
  modules(p)
    .that()
    .resideInFolder('src/domain/**')
    .should()
    .notImportFromCondition('src/repositories/**'),
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

For projects under 500 files, each re-run takes under 3 seconds. For larger projects, consider using `vitest --watch` with rules in test files instead.

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
