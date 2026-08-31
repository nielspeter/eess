import picomatch from 'picomatch'
import { resolveFeature, violationsFor } from './shared.js'
import { finishPreset, type ArchViolation, type PresetReportOptions } from '@nielspeter/eess'
import type { Corpus, MdDocument } from '@nielspeter/eess-md'
import type { FeatureSet } from '@nielspeter/eess-gherkin'

// Kernel re-exports (plan 0089 — standalone sufficiency): see mermaid-ts.ts.
export { finishPreset } from '@nielspeter/eess'
export type { ArchViolation, PresetReportOptions } from '@nielspeter/eess'

export interface ScenarioCitationsResolveOptions extends PresetReportOptions {
  /** Glob selecting the markdown documents to scan. Default `**` (whole corpus). */
  readonly dir?: string
  /**
   * Custom citation extractor for transition periods — receives one
   * fence-stripped line and returns the citations on it. Default: the eess
   * citation convention, a backticked feature path plus an optional quoted
   * scenario title on the same line — `` `path/to/x.feature` `` · `'Title'`.
   */
  readonly extract?: (line: string) => readonly ExtractedCitation[]
}

export interface ExtractedCitation {
  /** The cited feature path, as written (may be a unique suffix). */
  readonly path: string
  /** The cited scenario title; absent for a file-level citation. */
  readonly title?: string
}

interface Citation extends ExtractedCitation {
  readonly doc: MdDocument
  readonly line: number
}

// The eess scenario-citation convention (plan 0069, frozen at plan-ready):
// a backticked feature path, then — optionally, same line — a quoted title.
const FEATURE_PATH_RE = /`([^`\n]+\.feature)`/g
const TITLE_RE = /['"'']([^'"'']+)['"'']/
const RULE = 'markdown scenario citations should resolve against the feature set'

function defaultExtract(line: string): ExtractedCitation[] {
  const out: ExtractedCitation[] = []
  for (const m of line.matchAll(FEATURE_PATH_RE)) {
    const path = m[1]
    if (path === undefined) continue
    const rest = line.slice((m.index ?? 0) + m[0].length)
    const title = TITLE_RE.exec(rest)?.[1]
    out.push(title !== undefined ? { path, title } : { path })
  }
  return out
}

// Blank out fenced code in place (preserving line numbers) so an illustrative
// citation inside an example block never counts as a real one.
const FENCE_RE = /(```|~~~)[\s\S]*?\1/g
function stripFencedCode(s: string): string {
  return s.replace(FENCE_RE, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
}

function extractCitations(
  corpus: Corpus,
  dir: string,
  extract: (line: string) => readonly ExtractedCitation[],
): Citation[] {
  const inDir = picomatch(dir)
  const out: Citation[] = []
  for (const doc of corpus.documents()) {
    if (!inDir(doc.relPath)) continue
    const lines = stripFencedCode(doc.text).split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const cite of extract(lines[i] ?? '')) {
        out.push({ ...cite, doc, line: i + 1 })
      }
    }
  }
  return out
}

/** Resolve a cited path against the set: exact relPath, or unique `/`-boundary suffix. */

const v = violationsFor<Citation>(RULE, 'crossval/scenario-citations-resolve', (c) => ({
  element: `${c.doc.relPath}:${c.line}`,
  file: c.doc.file,
  line: c.line,
}))

/**
 * Cross-validate that every scenario citation in the markdown corpus resolves
 * against the loaded feature set — the md↔gherkin pairing (plan 0069 Phase 2),
 * the exact analogue of `adrCitationsResolve`'s `it('…')` title resolution.
 *
 * A citation is a backticked feature path with an optional quoted scenario
 * title on the same line. Three failure modes are gated: the cited feature
 * file doesn't exist in the set, the path is ambiguous (matches several
 * files), or the cited scenario title doesn't exist in that file. Citations
 * inside fenced code blocks never count.
 */
export function scenarioCitationsResolve(
  corpus: Corpus,
  set: FeatureSet,
  options: ScenarioCitationsResolveOptions = {},
): ArchViolation[] {
  const dir = options.dir ?? '**'
  const extract = options.extract ?? defaultExtract

  const citations = extractCitations(corpus, dir, extract)
  const scenarioKeys = new Set(set.scenarios().map((s) => `${s.relPath}\0${s.title}`))
  const violations: ArchViolation[] = []

  for (const c of citations) {
    const resolved = resolveFeature(c.path, set)
    if (resolved.length === 0) {
      violations.push(
        v(
          c,
          `cites \`${c.path}\` — no such feature file in the set`,
          'a story that cites a missing behavior spec is a dangling reference',
        ),
      )
      continue
    }
    if (resolved.length > 1) {
      violations.push(
        v(
          c,
          `cites \`${c.path}\` — ambiguous, matches ${resolved.length} feature files (${resolved.join(', ')})`,
          'an ambiguous citation cannot be mechanically resolved; cite a longer suffix',
        ),
      )
      continue
    }
    const rel = resolved[0]
    if (c.title !== undefined && rel !== undefined && !scenarioKeys.has(`${rel}\0${c.title}`)) {
      violations.push(
        v(
          c,
          `cites '${c.title}' in \`${rel}\` — no such scenario in that feature file`,
          'a renamed or deleted scenario must not silently orphan the story that cites it',
        ),
      )
    }
  }

  return finishPreset(violations, options)
}

/** Count citations/scenarios for a caller's non-vacuity summary line. */
export function scenarioCitationStats(
  corpus: Corpus,
  set: FeatureSet,
  options: ScenarioCitationsResolveOptions = {},
): { citations: number; features: number; scenarios: number } {
  const dir = options.dir ?? '**'
  const extract = options.extract ?? defaultExtract
  return {
    citations: extractCitations(corpus, dir, extract).length,
    features: set.features().length,
    scenarios: set.scenarios().length,
  }
}

// Referenced by tests to keep the default convention itself under test.
export { defaultExtract }
