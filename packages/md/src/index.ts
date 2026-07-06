// @nielspeter/eess-md — the Markdown dialect of the eess family.
//
// Validates a repo's markdown corpus against the shared @nielspeter/eess kernel:
// documents have the sections/tables they should, cross-links resolve, and code
// pointers ground against real files. The opinionated ADR gate ships separately
// from `@nielspeter/eess-md/rules/adr`.

// Corpus loader
export { corpus } from './corpus.js'
export type { CorpusOptions, Corpus } from './corpus.js'

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
export type { PointerResolveOptions } from './conditions/pointer-resolve.js'
export { rows, RowsRuleBuilder } from './builders/rows.js'

// Conditions (for composing custom rules / presets)
export { haveSection, haveTable } from './conditions/structure.js'
export type { HaveTableOptions } from './conditions/structure.js'
export { haveTableRowsSatisfying } from './conditions/table-rows.js'
export type { HaveTableRowsOptions, TableRowContext } from './conditions/table-rows.js'
