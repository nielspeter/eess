import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import picomatch from 'picomatch'
import type { GherkinFeature, GherkinScenario } from './model.js'

export interface FeaturesOptions {
  /** Globs (relative to `cwd`) selecting the `.feature` files to load. */
  readonly roots: readonly string[]
  /** Root the globs resolve against. Defaults to `process.cwd()`. */
  readonly cwd?: string
}

/** The loaded set of feature files — the dialect's "project" object. */
export interface FeatureSet {
  /** Root the set was loaded from. */
  readonly root: string
  /** All parsed feature files, in path order. */
  features(): GherkinFeature[]
  /** All scenarios across the set, in source order. */
  scenarios(): GherkinScenario[]
}

const BUILTIN_IGNORE = new Set(['node_modules', '.git', 'dist'])

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function walk(dir: string, root: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (BUILTIN_IGNORE.has(entry)) continue
    const abs = join(dir, entry)
    const st = statSync(abs)
    if (st.isDirectory()) walk(abs, root, acc)
    else acc.push(toPosix(relative(root, abs)))
  }
}

// Scenario-introducing keywords. `Example:` is the Gherkin 6 synonym for
// `Scenario:`; the trailing-colon requirement keeps `Examples:` (an outline's
// data table) from matching. `Background:` is deliberately not a scenario.
const SCENARIO_RE = /^(Scenario Outline|Scenario|Example):\s*(.*)$/
const FEATURE_RE = /^Feature:\s*(.*)$/
const TAG_LINE_RE = /^@\S/
// Doc-string fences — content inside must never read as a keyword line.
const DOCSTRING_RE = /^("""|```)/

/** Parse one `.feature` source (line grammar; steps/tables stay opaque). */
export function parseFeature(text: string, file: string, relPath: string): GherkinFeature {
  let featureTitle = ''
  let featureLine = 0
  let featureTags: readonly string[] = []
  let pendingTags: string[] = []
  let docstring: string | undefined
  const scenarios: GherkinScenario[] = []

  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim()

    if (docstring !== undefined) {
      if (line.startsWith(docstring)) docstring = undefined
      continue
    }
    const fence = DOCSTRING_RE.exec(line)
    if (fence?.[1] !== undefined) {
      docstring = fence[1]
      continue
    }
    if (line === '' || line.startsWith('#')) continue

    if (TAG_LINE_RE.test(line)) {
      pendingTags.push(
        ...line
          .split(/\s+/)
          .filter((t) => t.startsWith('@'))
          .map((t) => t.slice(1)),
      )
      continue
    }

    const feat = FEATURE_RE.exec(line)
    if (feat && featureLine === 0) {
      featureTitle = (feat[1] ?? '').trim()
      featureLine = i + 1
      featureTags = pendingTags
      pendingTags = []
      continue
    }

    const sc = SCENARIO_RE.exec(line)
    if (sc) {
      const keyword = sc[1]
      if (keyword === 'Scenario' || keyword === 'Scenario Outline' || keyword === 'Example') {
        scenarios.push({
          title: (sc[2] ?? '').trim(),
          keyword,
          feature: featureTitle,
          file,
          relPath,
          line: i + 1,
          tags: pendingTags,
        })
      }
      pendingTags = []
      continue
    }

    // Any other content line (steps, table rows) clears dangling tags.
    pendingTags = []
  }

  return { title: featureTitle, file, relPath, line: featureLine, tags: featureTags, scenarios }
}

/**
 * Load a set of Gherkin feature files. Walks `roots` from `cwd`, parses each
 * `.feature` with the line grammar, and exposes features/scenarios as
 * first-class elements — the Gherkin dialect's entry point.
 */
export function features(options: FeaturesOptions): FeatureSet {
  const root = options.cwd ?? process.cwd()
  const all: string[] = []
  walk(root, root, all)
  const matches = picomatch([...options.roots])

  const parsed: GherkinFeature[] = all
    .filter((rel) => rel.endsWith('.feature') && matches(rel))
    .sort()
    .map((rel) => parseFeature(readFileSync(join(root, rel), 'utf8'), join(root, rel), rel))

  return {
    root,
    features: () => [...parsed],
    scenarios: () => parsed.flatMap((f) => [...f.scenarios]),
  }
}
