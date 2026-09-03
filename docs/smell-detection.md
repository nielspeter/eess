# Smell Detection

The `smells` entry point detects code smells -- patterns that are not necessarily wrong but indicate potential design problems. Unlike hard architectural rules, smells are advisory by default and typically use `.warn()` instead of `.check()`.

## What Smells Are

Smells are not bugs. They flag structural patterns that tend to cause problems over time:

- **Duplicate bodies** -- copy-pasted functions that diverge and become maintenance traps
- **Inconsistent siblings** -- files in the same folder that should follow the same pattern but don't

Smell detectors do not use the `.that().should()` chain grammar. Instead, they have their own configuration API and terminate with `.warn()` (advisory) or `.check()` (hard failure).

## `smells.duplicateBodies()`

Detects functions with structurally similar bodies using AST fingerprinting. Identifiers are ignored by design — that is what makes this a type-2 clone score, and what lets it see a body that was copied and renamed.

**What it reports is a group, not a pair.** Bodies that are all similar to each other are one observation, so a family of six is one finding rather than the fifteen pairs it contains. A two-body duplicate reports as it always did. Each finding names the other files it concerns, so a `--changed` run still shows it to whoever edited _any_ member, not only the one it happens to be reported at.

**Findings are ordered, not filtered.** The same function copied into another file ranks above two unrelated functions that merely converge on a shared idiom — the score cannot tell those apart, and the names can. Nothing is dropped by ranking; it decides only what you read first.

**Each finding says what varies** between the bodies: one differing call target is a parameter extraction, nine differing property names is a shared idiom, and those score identically without it.

**Two rejections keep the output honest.** A body is never compared with a body nested inside it — "extract the shared logic" is impossible when one contains the other. And a pair that shares no identifier or literal at all is rejected, because a perfect shape match with nothing in common names a refactor that does not exist.

```typescript
import { project, smells } from '@nielspeter/eess-ts'

const p = project('tsconfig.json')

smells
  .duplicateBodies(p)
  .inFolder('**/services/**')
  .minLines(10)
  .ignoreTests()
  .because('copy-pasted service methods diverge over time')
  .warn()
```

### Configuration

Each detection run can be scoped, tuned, and filtered using these chainable methods. Start broad and tighten thresholds as you reduce duplicates.

| Method                     | Default   | Description                                                                                                                                                                               |
| -------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inFolder(glob)`           | all files | Scope detection to files matching the glob. Can be called multiple times.                                                                                                                 |
| `minLines(n)`              | `5`       | Ignore functions shorter than N lines.                                                                                                                                                    |
| `ignoreTests()`            | `false`   | Exclude test files (`*.test.ts`, `*.spec.ts`, `__tests__/**`).                                                                                                                            |
| `ignorePaths(...globs)`    | `[]`      | Exclude files matching the given glob patterns.                                                                                                                                           |
| `withMinSimilarity(n)`     | `0.85`    | AST similarity threshold (0--1). Lower values catch more pairs.                                                                                                                           |
| `minDistinctVocabulary(n)` | `8`       | Ignore a pair when either body has fewer than N distinct identifier/literal texts -- a shared AST shape alone (a wither, a getter, a boilerplate skeleton) is not evidence of copy-paste. |
| `groupByFolder()`          | `false`   | Group violation output by directory.                                                                                                                                                      |
| `because(reason)`          | --        | Explain why this smell check exists.                                                                                                                                                      |

### Terminal Methods

Terminal methods end the builder chain and execute the smell detection. Choose `.warn()` for advisory feedback during adoption or `.check()` when you want CI to block on smell violations.

| Method     | Description                                         |
| ---------- | --------------------------------------------------- |
| `.warn()`  | Log violations to stderr without throwing. Default. |
| `.check()` | Throw `ArchRuleError` if any violations are found.  |

Both accept an optional `{ format: 'terminal' | 'json' | 'github' }` parameter.

## AST Fingerprinting

Understanding how fingerprinting works helps you tune similarity thresholds and predict what will (and won't) be caught. This section explains the internals so you can set expectations correctly.

Duplicate detection works by comparing structural fingerprints, not raw text. Two functions with different variable names, string literals, and formatting can still be flagged as duplicates if their AST shapes are similar.

A fingerprint captures:

- **Node kinds** -- the ordered sequence of `SyntaxKind` values in the body (e.g., `IfStatement`, `CallExpression`, `ReturnStatement`)
- **Call targets** -- normalized call expression targets (e.g., `parseInt`, `this.extractCount`)
- **Node count** -- total AST nodes, used for filtering
- **Distinct vocabulary** -- the count of distinct identifier/literal texts, used by `minDistinctVocabulary()` to reject a pair whose shared shape carries no real information (a wither, a getter, a boilerplate skeleton all look "100% similar" by shape alone)

Similarity is computed using the longest common subsequence (LCS) of the kinds arrays, normalized to `[0, 1]`:

```
similarity = LCS(a.kinds, b.kinds) / max(a.kinds.length, b.kinds.length)
```

This means:

- Renaming variables does not affect similarity
- Changing string literals does not affect similarity
- Adding or removing statements reduces similarity
- Reordering statements reduces similarity

## `smells.inconsistentSiblings()`

Use this detector when your codebase has folder-level conventions (e.g., all repositories call `this.validate()`, all handlers call `handleError()`) and you want to catch files that missed the memo. It works by majority rule: if most files in a folder follow a pattern, the outliers are flagged.

Detects files in the same folder where a majority follow a pattern but some don't. This catches files that forgot to adopt a convention that most siblings already follow.

```typescript
import { smells, call } from '@nielspeter/eess-ts'

smells
  .inconsistentSiblings(p)
  .inFolder('**/repositories/**')
  .forPattern(call('this.validate'))
  .because('all repositories should call this.validate()')
  .warn()
```

### How It Works

1. Groups source files by parent folder
2. For each folder with 2+ files, checks which files contain the pattern
3. If 60% or more of files match the pattern, flags the non-matching files

### Configuration

All base configuration methods from `SmellBuilder` apply (`inFolder`, `minLines`, `ignoreTests`, `ignorePaths`, `groupByFolder`, `because`). In addition:

| Method                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `forPattern(matcher)` | The `ExpressionMatcher` that siblings should follow. Required. |

The `matcher` parameter accepts any expression matcher -- `call()`, `newExpr()`, `access()`, or `expression()`.

## Real-World Examples

### Detecting Copy-Pasted Parsers

```typescript
smells
  .duplicateBodies(p)
  .inFolder('**/parsers/**')
  .minLines(8)
  .withMinSimilarity(0.8)
  .ignoreTests()
  .groupByFolder()
  .because('copy-pasted parsers should be consolidated into a shared utility')
  .warn()
```

### Enforcing Consistent Error Handling

```typescript
smells
  .inconsistentSiblings(p)
  .inFolder('**/handlers/**')
  .forPattern(call('handleError'))
  .because('all request handlers should use the shared error handler')
  .warn()
```

### Catching Duplicate Service Methods Across Features

```typescript
smells
  .duplicateBodies(p)
  .inFolder('**/features/**/services/**')
  .minLines(15)
  .withMinSimilarity(0.9)
  .ignorePaths('**/shared/**')
  .because('similar service methods across features should be extracted to shared/')
  .warn()
```

### Consistent Validation in Repositories

```typescript
smells
  .inconsistentSiblings(p)
  .inFolder('**/repositories/**')
  .forPattern(call('this.validate'))
  .minLines(5)
  .ignoreTests()
  .because('repositories should validate inputs before database operations')
  .warn()
```

## Tips

- **Default to `.warn()`** -- smells are advisory. Use `.check()` only when you want to enforce zero tolerance.
- **Start with high similarity** -- `withMinSimilarity(0.9)` avoids false positives. Lower gradually as you clean up duplicates.
- **Combine with `ignorePaths()`** -- exclude generated files, migration scripts, or intentionally duplicated code.
- **Use `groupByFolder()`** -- makes violation output easier to triage by grouping related findings together.
