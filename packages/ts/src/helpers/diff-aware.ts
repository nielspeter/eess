/**
 * Diff-aware filtering for `eess-ts` — the kernel's, re-exported.
 *
 * This package carried its own copy, and the copies diverged in BOTH directions:
 * this one gained `DiffFilter.baseBranch` (plan 0071) and a failure message that
 * names why `git diff` could not run, while the kernel's kept the fuller
 * explanation of why a `bypassFilters` finding must never be filtered out. When
 * they were unified the kernel took this copy's behaviour and kept its own
 * docstring, so neither side lost anything.
 *
 * Re-exported from the kernel ROOT (not `/internal`), so ADR-011 clause 2 is
 * satisfied — a dialect must not forward family plumbing, and these are public
 * API on both sides.
 */
export { diffAware, DiffFilter } from '@nielspeter/eess'
