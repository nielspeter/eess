// @nielspeter/eess-md — the Markdown dialect of the eess family.
//
// Validates a repo's markdown corpus against the shared @nielspeter/eess kernel:
// documents have the sections/tables they should, cross-links resolve, and code
// pointers ground against real files. The opinionated ADR gate ships separately
// from `@nielspeter/eess-md/rules/adr`.

// Corpus loader
export { corpus } from './corpus.js'
export type { CorpusOptions, Corpus } from './corpus.js'

// Kernel re-exports (plan 0089 — standalone sufficiency): every kernel
// symbol this package's own sources import, so a caller writing a custom
// rule/preset against @nielspeter/eess-md (the same way rules/ledger.ts and
// rules/adr.ts do internally) never needs a second, direct
// @nielspeter/eess install.
export type {
  Predicate,
  Condition,
  ConditionContext,
  ArchFix,
  PresetReportOptions,
  PresetBaseOptions,
} from '@nielspeter/eess'
export {
  RuleBuilder,
  finishPreset,
  generateCodeFrame,
  not,
  dispatchRule,
  validateOverrides,
  // Bug 0276, second pass. `finishPreset` was already here; its siblings were
  // not, so a standalone consumer could finish a preset and neither report
  // without throwing nor catch what the seam throws. ADR-008 names
  // `reportViolations` as the one emitter, and ADR-014's configuration findings
  // arrive as an `ArchConfigError` a caller has to recognise.
  reportViolations,
  isArchConfigError,
  // Bug 0284: `honestyAtClose` throws it for a half-declared vocabulary.
  ArchConfigError,
  // Plan 0456: the location predicates now declare their globs.
  globNode,
} from '@nielspeter/eess'
// Plan 0456: `and`/`or` beside `not`, so a selection can be composed from this
// package alone (block 6's recipe: every page claimed by one selection, none by
// two). `check:family` cannot ask for them: this package's source does not use
// them.
export { and, or } from '@nielspeter/eess'
// The glob types the location predicates declare and `RuleBuilder.globs()` returns, as eess-ts's
// root has them.
export type { GlobNode, GlobSite } from '@nielspeter/eess'
// The document predicates, for `satisfy()` and the combinators. The same names
// exist on eess-ts's root with a different anchor: eess-md matches a path
// relative to the corpus's `cwd` (`'guides/**'`), eess-ts an absolute one
// (`'**/guides/**'`).
export { resideInFolder, resideInFile, haveNameMatching } from './predicates/document.js'
// `correspondence`/`CorrespondenceBuilder`: not touched by this package's
// OWN source (so the family.rules.ts code-import scan can't see this gap —
// review found it manually), but this README's own "Binding a spec table to
// code" example, and docs/markdown.md's equivalent, both teach
// `rows()` + `correspondence()` as the flagship way to bind a markdown table
// to code — without this re-export, that documented example does not
// compile against @nielspeter/eess-md alone, the exact second-install this
// plan exists to close.
export { correspondence, CorrespondenceBuilder } from '@nielspeter/eess'
// ADR-014's receipt: this package's own rules merge with it, so a standalone
// `eess-md` consumer must reach it without a second kernel install (plan 0089).
//
// Bug 0276: the merge was here and the CONSTRUCTOR was not, which is the same
// gap the other way round. A consumer handed a receipt could combine two and not
// build one. Import-driven `check:family` owed nothing here either.
export { collectResult, mergeCollectResults, hasEvidence } from '@nielspeter/eess'
export type { CollectResult } from '@nielspeter/eess'
// …and the types of their arguments. Re-exporting the FUNCTION and not its
// options left an eess-md user able to call `correspondence()` and unable to
// name what they pass it — the same callable-but-unnameable defect the kernel
// was fixed for, one package out. `check:family` cannot see it: it is
// import-driven, and md's source never imports these names.
export type { CorrespondenceOptions, RelationSpec, KeyBy } from '@nielspeter/eess'

// Document model
export type { MdDocument, MdSection, MdTable, MdCodeBlock } from './model/document.js'
export type { MdRow, ColumnSpec, RowMatchOptions, RowMatchMode } from './model/rows.js'
export { matchTableRows } from './model/rows.js'
export type { ArchViolation } from './model/violation.js'

// Entry points
export { docs, DocsRuleBuilder } from './builders/docs.js'
export { links, LinkRuleBuilder } from './builders/links.js'
export type { MdLink } from './builders/links.js'
export type { MdLinkBlock } from './model/links.js'
export type { LinkResolveOptions } from './conditions/resolve.js'
export { resolveLink } from './model/resolve-link.js'
export type { LinkTarget, LinkToResolve, NotInCorpusReason } from './model/resolve-link.js'
export { pointers, PointerRuleBuilder } from './builders/pointers.js'
export type { MdPointer } from './builders/pointers.js'
export { presentExternalRoots } from './conditions/pointer-resolve.js'
export type { PointerResolveOptions } from './conditions/pointer-resolve.js'
export { rows, RowsRuleBuilder } from './builders/rows.js'
export { taskItems, TaskItemRuleBuilder } from './builders/task-items.js'
export type { MdTaskItem } from './builders/task-items.js'
export { collectTaskItems } from './model/task-items.js'
export type { MdTaskItemRef, BoxMarkState, TaskItemOptions } from './model/task-items.js'
export { UNDECLARED_BOX_MARK, MALFORMED_BOX } from './builders/box-mark-findings.js'
export { vocabulary, terms, TermRuleBuilder } from './builders/vocabulary.js'
// Plan 0412: a code block parses with the parser the caller names.
export { parseCodeBlocks, DEFAULT_CODE_BLOCK_BUDGET } from './model/code-block-parse.js'
export type {
  CodeBlockVerdict,
  CodeBlockCanary,
  CodeBlockParser,
  CodeBlockBudget,
  ParseCodeBlocksOptions,
  ParsedCodeBlock,
  ParsedCodeBlocks,
  CodeBlockInstrumentFailure,
} from './model/code-block-parse.js'
export {
  codeBlocks,
  CodeBlockRuleBuilder,
  CODE_BLOCK_PARSER_INSTRUMENT,
} from './builders/code-blocks.js'
export type { Vocabulary, VocabularyOptions, MdTerm, TermsOptions } from './builders/vocabulary.js'

// Conditions (for composing custom rules / presets)
export { haveSection, haveTable } from './conditions/structure.js'
export type { HaveTableOptions } from './conditions/structure.js'
export { haveTableRowsSatisfying } from './conditions/table-rows.js'
export type { HaveTableRowsOptions, TableRowContext } from './conditions/table-rows.js'
