import { it, expect } from 'vitest'

/**
 * The public surface, exercised the way a consumer meets it.
 *
 * Every import below uses the PUBLISHED specifier, not a relative path into
 * `packages/*\/src`. That distinction is the whole point: 76 test files in this
 * repo import `../src/index.js` and 7 import `@nielspeter/eess-ts`, so most of
 * the suite would pass with the published barrels completely wrong.
 *
 * And every type below is NAMED in an annotation rather than inferred. That is
 * the half no runtime test can reach: TypeScript erases types, so a test can call
 * `correspondence({ left, right })` with an object literal, pass, and never touch
 * `CorrespondenceOptions`. `standalone-surface.test.ts` says so in its own words —
 * *"`import * as ns` only captures what exists at runtime, so type-only kernel
 * exports aren't covered here"* — and that blind spot is exactly where ADR-011's
 * classification went wrong: of six symbols review sent back to the root, the
 * three type-only ones (`CorrespondenceOptions`, `RelationSpec`, `KeyBy`) were
 * invisible to every existing gate and every test.
 *
 * So this file's job is to FAIL TO COMPILE. If a symbol named here stops being
 * reachable from its published entry point, `tsc --noEmit -p examples/tsconfig.json`
 * reds before a single assertion runs. The runtime expectations at the bottom are
 * incidental — they exist so vitest has something to run.
 *
 * Adding a name here is how you declare "a consumer may name this". Removing one
 * is a deliberate narrowing of the public surface and should ride with a changeset.
 */

// ---------- @nielspeter/eess — the kernel root ----------
import type {
  Predicate,
  Condition,
  ConditionContext,
  Matcher,
  ArchViolation,
  ArchFix,
  RuleSeverity,
  ReportMode,
  ReportOptions,
  PresetBaseOptions,
  Dispatchable,
  RuleBuilderLike,
  CollectResult,
  CheckOptions,
  OutputFormat,
  BaselineFilter,
  DiffFilterLike,
  UntestedReason,
  EdgeCoverage,
  ElementInfo,
  Selection,
  Direction,
  CorrespondenceOptions,
  RelationSpec,
  KeyBy,
  ArchJsonReport,
  ArchJsonViolation,
  ArchJsonSuppression,
  ArchJsonUntestedAllowlist,
  DeclaredGlob,
  DeclaredGlobs,
  GlobKind,
  GlobBase,
  ExclusionComment,
  ParseResult,
} from '@nielspeter/eess'
import { not, and, or, isArchRuleError, ArchRuleError, globNode, globAnyOf } from '@nielspeter/eess'

// ---------- @nielspeter/eess-md ----------
import type {
  CorpusOptions,
  MdDocument,
  MdSection,
  MdTable,
  MdRow,
  ColumnSpec,
  RowMatchOptions,
  MdLink,
  MdPointer,
  MdTaskItem,
  MdTerm,
  Vocabulary,
  VocabularyOptions,
} from '@nielspeter/eess-md'
import { corpus, docs, links, pointers, rows, taskItems, terms } from '@nielspeter/eess-md'
// The dialect-side half, and the reason this file subsumes bug 0225. `check:family`
// is IMPORT-driven: eess-md re-exports `correspondence()` and its own source never
// imports `CorrespondenceOptions`, so nothing obliged the type to come with it. A
// consumer could call the function and not name its argument — measured, with only
// eess-md installed, before it was fixed. Naming them HERE, from the dialect
// specifier, is what makes that obligation mechanical instead of remembered.
import { correspondence as mdCorrespondence } from '@nielspeter/eess-md'
import type {
  CorrespondenceOptions as MdCorrespondenceOptions,
  RelationSpec as MdRelationSpec,
  KeyBy as MdKeyBy,
} from '@nielspeter/eess-md'

// ---------- @nielspeter/eess-mermaid ----------
import type { ArchClass, ArchRelationship } from '@nielspeter/eess-mermaid'
import { diagram, classes as mermaidClasses } from '@nielspeter/eess-mermaid'

// ---------- @nielspeter/eess-gherkin ----------
import type { GherkinFeature, GherkinScenario, FeaturesOptions } from '@nielspeter/eess-gherkin'
import { features } from '@nielspeter/eess-gherkin'

// ---------- @nielspeter/eess-ts ----------
import { project, workspace, classes, functions, modules } from '@nielspeter/eess-ts'

/**
 * Named, not inferred. Each line fails to compile if its type stops being
 * reachable from the specifier above it — which is the assertion.
 */
type KernelSurface = {
  predicate: Predicate<unknown>
  condition: Condition<unknown>
  ctx: ConditionContext
  matcher: Matcher<string>
  violation: ArchViolation
  fix: ArchFix
  severity: RuleSeverity
  reportMode: ReportMode
  reportOptions: ReportOptions
  presetOptions: PresetBaseOptions
  dispatchable: Dispatchable
  builderLike: RuleBuilderLike
  collect: CollectResult
  checkOptions: CheckOptions
  format: OutputFormat
  baselineFilter: BaselineFilter
  diffFilter: DiffFilterLike
  untested: UntestedReason
  coverage: EdgeCoverage
  element: ElementInfo
  selection: Selection<unknown>
  direction: Direction
  corrOptions: CorrespondenceOptions<unknown, unknown>
  relation: RelationSpec<unknown, unknown>
  keyBy: KeyBy<unknown, unknown>
  jsonReport: ArchJsonReport
  jsonViolation: ArchJsonViolation
  jsonSuppression: ArchJsonSuppression
  jsonAllowlist: ArchJsonUntestedAllowlist
  glob: DeclaredGlob
  globs: DeclaredGlobs
  globKind: GlobKind
  globBase: GlobBase
  exclusion: ExclusionComment
  parseResult: ParseResult
}

type MdSurface = {
  corpusOptions: CorpusOptions
  doc: MdDocument
  section: MdSection
  table: MdTable
  row: MdRow
  columns: ColumnSpec
  rowMatch: RowMatchOptions
  link: MdLink
  pointer: MdPointer
  taskItem: MdTaskItem
  term: MdTerm
  vocab: Vocabulary
  vocabOptions: VocabularyOptions
}

/** A dialect that exposes a function must expose the types of its arguments. */
type MdCorrespondenceSurface = {
  options: MdCorrespondenceOptions<unknown, unknown>
  relation: MdRelationSpec<unknown, unknown>
  keyBy: MdKeyBy<unknown, unknown>
}

type MermaidSurface = { cls: ArchClass; rel: ArchRelationship }
type GherkinSurface = { feature: GherkinFeature; scenario: GherkinScenario; opts: FeaturesOptions }

it('every published entry point still exposes the surface a consumer names', () => {
  // The compile above IS the test. These keep vitest honest about having run,
  // and prove the value exports resolve at runtime as well as at type level.
  const values = [
    not,
    and,
    or,
    isArchRuleError,
    globNode,
    globAnyOf,
    corpus,
    docs,
    links,
    pointers,
    rows,
    taskItems,
    terms,
    diagram,
    mermaidClasses,
    mdCorrespondence,
    features,
    project,
    workspace,
    classes,
    functions,
    modules,
  ]
  expect(values.every((v) => typeof v === 'function')).toBe(true)
  expect(typeof ArchRuleError).toBe('function')

  // A named-type sanity check that cannot be optimised away: if these aliases
  // stopped resolving the file would not have compiled.
  const surfaces: Array<
    KernelSurface | MdSurface | MdCorrespondenceSurface | MermaidSurface | GherkinSurface
  > = []
  expect(surfaces).toEqual([])
})
