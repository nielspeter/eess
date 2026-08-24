import picomatch from 'picomatch'
import { type Selection } from '@nielspeter/eess'
import { correspondence } from '@nielspeter/eess'
import type { Corpus } from '@nielspeter/eess-md'
import { calls, type ArchProject } from '@nielspeter/eess-ts'
import { citedItTitles, itTitleOf } from './it-title.js'

// Kernel re-exports (plan 0089 — standalone sufficiency): see mermaid-ts.ts.
export { correspondence } from '@nielspeter/eess'
export type { Selection } from '@nielspeter/eess'

export interface AdrCitationsResolveOptions {
  /** Glob selecting ADR files. Default `docs/adr/**`. */
  readonly dir?: string
  /** Enforcement section heading. Default `/^enforcement$/i`. */
  readonly section?: string | RegExp
  /** Header pattern locating the mechanism column. Default `/mechanism/i` — non-English corpora pass their own (e.g. `/mekanisme/i`). */
  readonly mechanismColumn?: RegExp
}

interface Citation {
  readonly title: string
  readonly adr: string
  readonly line: number
}
interface TestDef {
  readonly title: string
  readonly file: string
}

function matchName(value: string, name: string | RegExp): boolean {
  return typeof name === 'string' ? value === name : name.test(value)
}

/** Extract cited `it('…')` titles from the mechanism column of ADR enforcement tables. */
function extractCitations(opts: {
  corpus: Corpus
  dir: string
  section: string | RegExp
  mechanismColumn: RegExp
}): Citation[] {
  const inDir = picomatch(opts.dir)
  const out: Citation[] = []
  for (const doc of opts.corpus.documents()) {
    if (!inDir(doc.relPath)) continue
    const table = doc.tables.find(
      (t) =>
        t.sectionPath.some((h) => matchName(h, opts.section)) &&
        t.header.some((h) => opts.mechanismColumn.test(h)),
    )
    if (!table) continue
    const mechIdx = table.header.findIndex((h) => opts.mechanismColumn.test(h))
    if (mechIdx < 0) continue
    for (const row of table.rows) {
      const mech = row[mechIdx] ?? ''
      for (const title of citedItTitles(mech)) {
        out.push({ title, adr: doc.relPath, line: table.line })
      }
    }
  }
  return out
}

/**
 * Count what this preset would actually scan — the caller's non-vacuity guard.
 * `adrCitationsResolve` reports OK when it resolves zero citations, so a drifted
 * `dir` or `roots` reads exactly like a clean pass; a gate that prints this
 * number can tell the two apart. Mirrors `scenarioTestStats` in gherkin↔ts.
 */
export function adrCitationStats(
  corpus: Corpus,
  options: AdrCitationsResolveOptions = {},
): { citations: number; adrs: number } {
  const dir = options.dir ?? 'docs/adr/**'
  const inDir = picomatch(dir)
  return {
    citations: extractCitations({
      corpus,
      dir,
      section: options.section ?? /^enforcement$/i,
      mechanismColumn: options.mechanismColumn ?? /mechanism/i,
    }).length,
    adrs: corpus.documents().filter((d) => inDir(d.relPath)).length,
  }
}

/** Collect actual `it('…')` definitions from the project via eess-ts's public call API. */
function extractTestDefs(project: ArchProject): TestDef[] {
  const allCalls = calls(project).select({
    label: 'call',
    identify: (c) => ({ name: c.getName() ?? '' }),
  }).elements
  const out: TestDef[] = []
  for (const call of allCalls) {
    // The ROOT callee, not the full name. eess-ts names a modifier call by its
    // whole member expression, so `it.skip(…)` is `'it.skip'` and comparing the
    // full name dropped every skipped, focused or concurrent test before its
    // title was read — while the citation side had always accepted those forms
    // (bug 0105). The gate binds a citation; it does not run the test, so a
    // skipped test's citation is still checked. Same reasoning, same shape as
    // `gherkin-ts.ts` — which is where it was already written down.
    //
    // **This guard is not what decides.** `itTitleOf` is anchored on the literal
    // callee (`^` + `(?:it)(?:\.\w+)?\(`), so the grammar alone already rejects
    // `describe(…)`, `test(…)`, `suite.it(…)`, `it.a.b(…)` and the outer
    // `it.each([…])(…)`. Review measured it: delete these two lines and the whole
    // suite stays green. What the guard buys is a cheap pre-filter — it skips
    // `getArguments()` + `getText()` for every call expression in the project —
    // and defence in depth: widening what counts as a test takes BOTH this line
    // and the grammar, so neither can smuggle one in alone. Keep it for those
    // reasons, not for a rejection it does not perform.
    const root = call.getObjectName() ?? call.getMethodName()
    if (root !== 'it') continue
    const title = itTitleOf(call.getName({ withArgument: 0 }) ?? '')
    if (title !== undefined) {
      out.push({ title, file: call.getSourceFile().getFilePath() })
    }
  }
  return out
}

/**
 * Cross-validate that every `it('…')` cited in an ADR's enforcement table
 * actually exists as a test in the project. The AST-grounded upgrade of the
 * text-level citation check in `eess-md`'s `adrEnforcement` — it resolves titles
 * against real test call expressions (via eess-ts's public API; no ts-morph
 * here, per ADR-007), so it also sees `it(\`no-substitution template\`)` titles
 * the regex missed.
 */
export function adrCitationsResolve(
  corpus: Corpus,
  project: ArchProject,
  options: AdrCitationsResolveOptions = {},
): void {
  const dir = options.dir ?? 'docs/adr/**'
  const section = options.section ?? /^enforcement$/i
  const mechanismColumn = options.mechanismColumn ?? /mechanism/i

  const citations = extractCitations({ corpus, dir, section, mechanismColumn })
  const testDefs = extractTestDefs(project)

  const left: Selection<Citation> = {
    elements: citations,
    label: 'cited it()',
    identify: (c) => ({ name: `it('${c.title}')`, file: c.adr, line: c.line }),
  }
  const right: Selection<TestDef> = {
    elements: testDefs,
    label: 'test',
    identify: (d) => ({ name: `it('${d.title}')`, file: d.file }),
  }

  correspondence({
    left,
    right,
    keyBy: (e) => e.title,
    // `suggest.left`, not `.rule({ suggestion })`, and now for the right reason.
    // The original comment here said rule-level suggestions never render on a
    // correspondence (true until bug 0122 fixed it) and that appending to the
    // message "does" render — which was never true: the terminal formatter
    // dropped `message` entirely, so this remedy was invisible in the one format
    // an agent reads. Both halves are fixed. `suggest` stays because the remedy
    // is per-branch: a rule-level `suggestion` is stamped onto every branch of
    // the correspondence, and "match the citation character for character" is
    // advice for a *dangling* citation, not for an ambiguous or an uncited one.
    suggest: {
      left: () =>
        'Fix: the cited title is compared as raw source text — if the test was renamed, ' +
        'match the citation to it character for character (escapes included); ' +
        'if it was deleted, restore it or retire the clause it enforced.',
    },
  })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .rule({
      id: 'crossval/adr-citations-resolve',
      because: 'an ADR that cites a test must cite one that exists',
    })
    .check()
}
