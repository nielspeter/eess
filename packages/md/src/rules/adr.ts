import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  dispatchRule,
  finishPreset,
  validateOverrides,
  not,
  type ArchViolation,
  type PresetBaseOptions,
  mergeCollectResults,
} from '@nielspeter/eess'
import type { Corpus } from '../corpus.js'
import { docs } from '../builders/docs.js'
import { haveNameMatching } from '../predicates/document.js'
import { haveTableRowsSatisfying, type TableRowContext } from '../conditions/table-rows.js'

// The ADR directory's index/schema doc (README.md, index.md) is not an ADR —
// exempt it so it isn't required to carry an `## Enforcement` table. the external repo's
// hand-built adr-enforcement.ts scopes to numbered files for the same reason;
// excluding by name (not "numbered-only") keeps MADR-style named ADRs in scope.
const notIndexDoc = not(haveNameMatching(/^(README|index)\.md$/i))

/**
 * Options for `adrEnforcement` — an OPINIONATED preset implementing the EESS
 * enforcement-tier model (a `## Enforcement` table with tier + mechanism +
 * status). Teams whose ADRs differ compose their own gate from the generic
 * primitives (`haveSection`, `haveTable`, `haveTableRowsSatisfying`, `resolve`).
 */
export interface AdrEnforcementOptions extends PresetBaseOptions {
  /** Glob selecting ADR files. Default `docs/adr/**`. */
  readonly dir?: string
  /** Heading of the enforcement section. Default `/^enforcement$/i`. */
  readonly section?: string | RegExp
  /** Header patterns locating the tier/mechanism/status columns. */
  readonly columns?: { tier: RegExp; mechanism: RegExp; status: RegExp }
  /** Valid tier numbers. Default `[1,2,3,4,5]`. */
  readonly tiers?: readonly number[]
  /** Verify cited file paths exist and cited `it('…')` titles resolve. Default `true`. */
  readonly verifyCitations?: boolean
}

const RULE_IDS = ['adr/enforcement-declared', 'adr/valid-tiers', 'adr/citations-resolve'] as const

const PATH_RE = /`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g
const IT_CITE_RE = /it(?:\.\w+)?\(\s*['"]([^'"]+)['"]/g

/** Does `testFile` define a test titled `title`? (Text-level; 0059 upgrades to AST.) */
function testDefinesIt(testAbs: string, title: string): boolean {
  if (!existsSync(testAbs)) return false
  const content = readFileSync(testAbs, 'utf8')
  const esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`it(?:\\.\\w+)?\\(\\s*['"\`]${esc}`).test(content)
}

function validateTier(ctx: TableRowContext, tiers: ReadonlySet<number>): string[] {
  const clause = ctx.cells[0] ?? ''
  const match = ctx.get('tier').match(/[1-5]/)
  if (!match || !tiers.has(Number(match[0]))) {
    return [`clause "${clause}" has no valid tier (1–5): got "${ctx.get('tier')}"`]
  }
  return []
}

function validateCitations(ctx: TableRowContext, corpus: Corpus): string[] {
  const clause = ctx.cells[0] ?? ''
  const mech = ctx.get('mechanism')
  const problems: string[] = []
  const citedPaths: string[] = []

  for (const m of mech.matchAll(PATH_RE)) {
    const p = m[1]
    if (p === undefined) continue
    citedPaths.push(p)
    if (!corpus.fileIndex.has(p)) {
      problems.push(`clause "${clause}" cites missing file \`${p}\``)
    }
  }

  const testFiles = citedPaths.filter((p) => p.endsWith('.ts'))
  for (const m of mech.matchAll(IT_CITE_RE)) {
    const title = m[1]
    if (title === undefined) continue
    const found = testFiles.some((p) => testDefinesIt(join(corpus.root, p), title))
    if (!found) {
      problems.push(
        `clause "${clause}" cites it('${title}') not found in ${
          testFiles.length ? testFiles.join(', ') : 'any cited test file'
        }`,
      )
    }
  }
  return problems
}

/**
 * OPINIONATED preset: gate a repo's ADRs on the EESS enforcement-tier model.
 * Gates on *declaration* — an ADR fails for a missing `## Enforcement` table, a
 * clause with no valid tier, or (when `verifyCitations`) a citation that doesn't
 * resolve; a soft-tier clause declared as such passes.
 *
 * Emits per-rule ids so `overrides` can downgrade/disable individual checks.
 *
 * The citation check resolves two forms — a backticked file path and an
 * `it('…')` title. A Mechanism cell that cites something else (a rule id in
 * your own architecture tool, a CI job) is not resolved here, and this preset
 * takes no plugin for it: what counts as a live id is your fact, not the
 * corpus's. Compose that check from `rows()` + `correspondence()` against the
 * set you hold — the worked recipe is "Citing something that is not a file or
 * a test" on the `eess-md` docs page.
 */
export function adrEnforcement(
  corpus: Corpus,
  options: AdrEnforcementOptions = {},
): ArchViolation[] {
  const dir = options.dir ?? 'docs/adr/**'
  const section = options.section ?? /^enforcement$/i
  const columns = options.columns ?? {
    tier: /tier/i,
    mechanism: /mechanism/i,
    status: /status/i,
  }
  const tiers = new Set(options.tiers ?? [1, 2, 3, 4, 5])
  const verify = options.verifyCitations ?? true
  validateOverrides(options.overrides, [...RULE_IDS])

  const declared = docs(corpus)
    .that()
    .resideInFolder(dir)
    .satisfy(notIndexDoc)
    .should()
    .haveTable({ section, columns: [columns.tier, columns.mechanism, columns.status] })

  const validTiers = docs(corpus)
    .that()
    .resideInFolder(dir)
    .satisfy(notIndexDoc)
    .should()
    .satisfy(haveTableRowsSatisfying({ section, columns, row: (ctx) => validateTier(ctx, tiers) }))

  // The kernel merge, not a spread: a spread drops each receipt's evidence, and
  // this preset's own all-off case (every rule id overridden `'off'`) is then
  // indistinguishable from a healthy run that found nothing — bug 0261, measured
  // in this very function.
  const parts = [
    dispatchRule(declared, 'adr/enforcement-declared', 'error', options.overrides),
    dispatchRule(validTiers, 'adr/valid-tiers', 'error', options.overrides),
  ]

  if (verify) {
    const citations = docs(corpus)
      .that()
      .resideInFolder(dir)
      .satisfy(notIndexDoc)
      .should()
      .satisfy(
        haveTableRowsSatisfying({ section, columns, row: (ctx) => validateCitations(ctx, corpus) }),
      )
    parts.push(dispatchRule(citations, 'adr/citations-resolve', 'error', options.overrides))
  }

  return finishPreset(mergeCollectResults(parts), options)
}
