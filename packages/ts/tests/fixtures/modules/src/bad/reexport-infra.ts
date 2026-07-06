// Re-exports from infra via `export … from` — a dependency edge that
// getImportDeclarations() misses but getDependencyDecls() catches.
export { connect } from '../infra/database.js'
