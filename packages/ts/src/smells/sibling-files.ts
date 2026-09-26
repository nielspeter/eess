import path from 'node:path'
import type { SourceFile } from 'ts-morph'
import type { ArchProject } from '../core/project.js'
import type { ExpressionMatcher } from '../helpers/matchers.js'
import { collectFunctions } from '../models/arch-function.js'
import { searchFunctionBody } from '../helpers/body-traversal.js'
import { anyMatchesPath, pathGlobMatchers } from '../core/project-relative.js'

/** Paths treated as tests when `.ignoreTests()` is on. */
const TEST_PATTERNS = ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**']

/**
 * Which files the sibling detector looks at, and how they are grouped.
 *
 * Separated from the builder because selecting and grouping files is not
 * detecting inconsistency — the builder collects a fluent configuration and
 * hands it here. The scope arrives as a value rather than being read off a
 * builder, so the grouping is callable and testable without one.
 */
export interface SiblingScope {
  readonly project: ArchProject
  readonly folders: readonly string[]
  readonly ignorePaths: readonly string[]
  readonly ignoreTests: boolean
  readonly minLines: number
  readonly pattern: ExpressionMatcher | undefined
}

/** Check if a source file contains any function matching the pattern. */
function fileMatchesPattern(sf: SourceFile, pattern: ExpressionMatcher, minLines: number): boolean {
  // Detectors scan for a property of the code, not a user-declared subject
  // set, so they always include object-literal functions. `functions()`
  // keeps anonymous values opt-in, because every inline callback would flood a
  // rule a user wrote; a detector has no such contract to break, and a
  // duplicated arrow under an object key — a resolver, a route handler, a
  // reducer case — is exactly the copy-paste rot this exists to find.
  for (const fn of collectFunctions(sf, { includeObjectLiteralFunctions: true })) {
    const body = fn.getBody()
    if (!body) continue

    const lineCount = body.getText().split('\n').length
    if (lineCount < minLines) continue

    if (searchFunctionBody(fn, pattern).found) return true
  }
  return false
}

/** Partition files into matching and non-matching based on the pattern. */
export function partitionByPattern(
  files: SourceFile[],
  pattern: ExpressionMatcher,
  minLines: number,
): { matching: SourceFile[]; nonMatching: SourceFile[] } {
  const matching: SourceFile[] = []
  const nonMatching: SourceFile[] = []
  for (const sf of files) {
    if (fileMatchesPattern(sf, pattern, minLines)) {
      matching.push(sf)
    } else {
      nonMatching.push(sf)
    }
  }
  return { matching, nonMatching }
}

/** Group source files by parent folder, applying all filters. */
export function groupFilesByFolder(scope: SiblingScope): Map<string, SourceFile[]> {
  const sourceFiles = scope.project.getSourceFiles()
  const folderMatchers = pathGlobMatchers(scope.folders)
  const ignoreMatchers = pathGlobMatchers(scope.ignorePaths)
  const testMatchers = scope.ignoreTests ? pathGlobMatchers(TEST_PATTERNS) : []

  const groups = new Map<string, SourceFile[]>()

  for (const sf of sourceFiles) {
    const filePath = sf.getFilePath()
    // Every set goes through the shared matcher — bug 0339, and reading the
    // absolute path alone was two defects here. A project-relative
    // `inFolder('src/**')` matched nothing (the fix bug 0036 made in
    // `duplicate-bodies.ts` was never made in this twin, while the census
    // classified the pair `'normalized'`), and an `inFolder('**\/src/**')`
    // matched nothing from a project path holding a dot-segment, because
    // picomatch's default `dot: false` stops `**` crossing it. Either way every
    // file was grouped into no folder and the detector reported itself inert.
    const matches = (ms: typeof folderMatchers): boolean =>
      anyMatchesPath(ms, sf, filePath, scope.project.tsConfigPath)

    // Folder filter: if folders specified, file must match at least one
    if (folderMatchers.length > 0 && !matches(folderMatchers)) {
      continue
    }

    // Ignore paths filter
    if (matches(ignoreMatchers)) {
      continue
    }

    // Test file filter
    if (matches(testMatchers)) {
      continue
    }

    const folder = path.dirname(filePath)
    const existing = groups.get(folder)
    if (existing) {
      existing.push(sf)
    } else {
      groups.set(folder, [sf])
    }
  }

  return groups
}

/** Single source of the inert message. Pure — takes the assessment, returns text. */
export function inertMessage(a: { matching: number; total: number }, patternDesc: string): string {
  return (
    `This detector examined ${String(a.total)} sibling files, but only ${String(a.matching)} of them ` +
    `hold the pattern '${patternDesc}', and no folder is within an edit of a majority — so as written it ` +
    `cannot produce a finding today. It reports a file that diverges from what its siblings do; with no ` +
    `majority reachable by adopting files, there is no divergence to report. ` +
    `If this rule asserts a convention the codebase is still adopting, replace it with ` +
    `crossProject().side(...).beComplete(), which fails the day a file falls short — until adoption is ` +
    `complete, so expect that red. If the intent is to police divergence rather than the convention itself, ` +
    `widen the folder so a majority forms, or choose a pattern the sibling files already share.`
  )
}

/**
 * Dedupe key for the inert finding. `dedupeConfigFindings` keys on
 * `${file} ${ruleId ?? rule} ${element}`; `file` is always `''` here and
 * `rule`/`ruleId` fall back to `describe()`, which is scope-blind (reads
 * `_pattern` only). So without a scope-aware `element`, two same-pattern/
 * different-scope inert detectors with no explicit `.rule({id})` would
 * collapse into one finding under `checkAll`.
 *
 * Folds in every field `groupFilesByFolder()`/`fileMatchesPattern()` read to
 * decide what's examined — `_folders`, `_ignorePaths`, `_ignoreTests`,
 * `_minLines` — sorted so option order cannot split one semantic scope into
 * two keys. Two rules with identical scope correctly collapse to one finding
 * (one edit fixes both); two rules differing in ANY of these stay distinct.
 */
export function inertElement(scope: SiblingScope): string {
  const patternDesc = scope.pattern?.description ?? 'unknown pattern'
  const folders = [...scope.folders].sort().join('|')
  const ignorePaths = [...scope.ignorePaths].sort().join('|')
  return `inert:${patternDesc}:${folders}:${ignorePaths}:${String(scope.ignoreTests)}:${String(scope.minLines)}`
}
