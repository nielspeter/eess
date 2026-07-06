import picomatch from 'picomatch'
import { correspondence, type Selection } from '@nielspeter/eess'
import type { Corpus } from '@nielspeter/eess-md'
import { calls, type ArchProject } from '@nielspeter/eess-ts'

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

const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/g
// Parse a title out of an enriched call name like `it('does a thing')`.
const IT_NAME_RE = /^it(?:\.\w+)?\(\s*['"`]([^'"`]+)['"`]/

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
      for (const m of mech.matchAll(IT_CITE_RE)) {
        const title = m[1]
        if (title !== undefined) out.push({ title, adr: doc.relPath, line: table.line })
      }
    }
  }
  return out
}

/** Collect actual `it('…')` definitions from the project via eess-ts's public call API. */
function extractTestDefs(project: ArchProject): TestDef[] {
  const allCalls = calls(project).select({
    label: 'call',
    identify: (c) => ({ name: c.getName() ?? '' }),
  }).elements
  const out: TestDef[] = []
  for (const call of allCalls) {
    if (call.getName() !== 'it') continue
    const enriched = call.getName({ withArgument: 0 }) ?? ''
    const m = IT_NAME_RE.exec(enriched)
    if (m?.[1] !== undefined) {
      out.push({ title: m[1], file: call.getSourceFile().getFilePath() })
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
  })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .rule({
      id: 'crossval/adr-citations-resolve',
      because: 'an ADR that cites a test must cite one that exists',
    })
    .check()
}
