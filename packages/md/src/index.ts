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
} from '@nielspeter/eess'
// `correspondence`/`CorrespondenceBuilder`: not touched by this package's
// OWN source (so the family.rules.ts code-import scan can't see this gap —
// review found it manually), but this README's own "Binding a spec table to
// code" example, and docs/markdown.md's equivalent, both teach
// `rows()` + `correspondence()` as the flagship way to bind a markdown table
// to code — without this re-export, that documented example does not
// compile against @nielspeter/eess-md alone, the exact second-install this
// plan exists to close.
export { correspondence, CorrespondenceBuilder } from '@nielspeter/eess'
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
export type { LinkResolveOptions } from './conditions/resolve.js'
export { pointers, PointerRuleBuilder } from './builders/pointers.js'
export type { MdPointer } from './builders/pointers.js'
export { presentExternalRoots } from './conditions/pointer-resolve.js'
export type { PointerResolveOptions } from './conditions/pointer-resolve.js'
export { rows, RowsRuleBuilder } from './builders/rows.js'
export { taskItems, TaskItemRuleBuilder } from './builders/task-items.js'
export type { MdTaskItem } from './builders/task-items.js'
export { collectTaskItems } from './model/task-items.js'
export type { MdTaskItemRef } from './model/task-items.js'
export { vocabulary, terms, TermRuleBuilder } from './builders/vocabulary.js'
export type { Vocabulary, VocabularyOptions, MdTerm, TermsOptions } from './builders/vocabulary.js'

// Conditions (for composing custom rules / presets)
export { haveSection, haveTable } from './conditions/structure.js'
export type { HaveTableOptions } from './conditions/structure.js'
export { haveTableRowsSatisfying } from './conditions/table-rows.js'
export type { HaveTableRowsOptions, TableRowContext } from './conditions/table-rows.js'
