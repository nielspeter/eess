// A cycle formed ONLY by `export … from` re-exports (no regular imports).
// Before re-exports counted as slice edges, this cycle was invisible.
export * from '../reexport-y/index.js'
export const x = 'x'
