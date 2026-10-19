import { ArchConfigError } from '@nielspeter/eess'

/** The caller's `RegExp` without `g` and `y`, made once per object (bug 0506). */
const STATELESS = new WeakMap<RegExp, RegExp>()

/**
 * A `RegExp` that `.test()` can share across headings: with `g` or `y`, `lastIndex` would carry from
 * one call to the next, so the same matcher would match a heading and then fail the next document's
 * (bug 0506). A non-global copy, as `vocabulary()` makes for terms.
 */
export function stateless(re: RegExp): RegExp {
  if (!re.global && !re.sticky) return re
  const known = STATELESS.get(re)
  if (known !== undefined) return known
  const copy = new RegExp(re.source, re.flags.replace(/[gy]/g, ''))
  STATELESS.set(re, copy)
  return copy
}

/** Match a string against a name matcher (exact string or regex). */
export function matchName(value: string, name: string | RegExp): boolean {
  return typeof name === 'string' ? value === name : stateless(name).test(value)
}

/**
 * Refuse a heading depth that is not an integer from 1 to 6 (plan 0496). A depth of 7 matches
 * nothing, and a rule that cannot fail is the defect ADR-009 names, so it is refused at the call.
 */
export function checkDepth(depth: number | undefined, call: string): void {
  if (depth === undefined) return
  if (!Number.isInteger(depth) || depth < 1 || depth > 6) {
    throw new ArchConfigError(
      call,
      `${call}: depth must be an integer from 1 to 6 (a heading's level), got ${String(depth)}`,
    )
  }
}
