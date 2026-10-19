import type { Condition, ConditionContext } from './condition.js'
import type { ArchViolation } from './violation.js'

/** How a dialect keys, names and reports the elements that must not share a value. */
export interface UniqueByOptions<T> {
  /** The value compared. Exact string equality; normalisation is the caller's. */
  readonly key: (element: T) => string
  /** How a message names an element and where it is: `guides/a.md:1`. */
  readonly locate: (element: T) => { readonly name: string; readonly at: string }
  /** What the key is, for the message: "record number", "title". */
  readonly what: string
  /** Optional: why a duplicate matters, appended to the message. */
  readonly why?: string
  /** The dialect's own constructor, so its finding's shape survives. */
  readonly toViolation: (element: T, message: string, ctx: ConditionContext) => ArchViolation
}

/** At most this many other locations in one message; the rest are counted. */
const LISTED = 10

/**
 * The one `beUniqueBy` condition (proposal 017, block 13; plan 0459): no two
 * elements share a key. Every member of a group is a finding at its own place,
 * naming the others, so excluding one member cannot hide the group. Keys compare
 * exactly. Not cardinality-exempt: zero elements is the kernel's ordinary
 * zero-examined finding, and one element is evidence. A key that throws
 * propagates.
 */
export function uniqueByCondition<T>(opts: UniqueByOptions<T>): Condition<T> {
  return Object.freeze({
    description: `be unique by ${opts.what}`,
    evaluate: (elements: T[], ctx: ConditionContext): ArchViolation[] => {
      const groups = new Map<string, T[]>()
      for (const e of elements) {
        const k = opts.key(e)
        const group = groups.get(k)
        if (group) group.push(e)
        else groups.set(k, [e])
      }
      const tail = opts.why === undefined ? '' : `; ${opts.why}`
      const out: ArchViolation[] = []
      for (const group of groups.values()) {
        if (group.length < 2) continue
        for (const [i, e] of group.entries()) {
          const others = group.filter((_, j) => j !== i).map((o) => opts.locate(o).at)
          // A group of k members gives k findings; listing all k-1 others in each would be k² text.
          const listed = others.slice(0, LISTED).join(', ')
          const more = others.length > LISTED ? ` and ${String(others.length - LISTED)} more` : ''
          const count = `${String(others.length)} other${others.length === 1 ? '' : 's'}`
          const msg = `${opts.locate(e).name} has the same ${opts.what} as ${count}: ${listed}${more}${tail}`
          out.push(opts.toViolation(e, msg, ctx))
        }
      }
      return out
    },
  })
}
