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
 * Two locations in reading order (bug 0526): a run of digits compares as a number, so `a.md:9` comes
 * before `a.md:10` and `a2.md` before `a10.md`; anything else by code unit. No locale is consulted, so
 * the order is the same on every runtime.
 */
function byLocation(a: string, b: string): number {
  const pa = a.match(/\d+|\D+/g) ?? []
  const pb = b.match(/\d+|\D+/g) ?? []
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i] ?? ''
    const y = pb[i] ?? ''
    if (x === y) continue
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const nx = x.replace(/^0+(?=\d)/, '')
      const ny = y.replace(/^0+(?=\d)/, '')
      if (nx.length !== ny.length) return nx.length - ny.length
      if (nx !== ny) return nx < ny ? -1 : 1
    }
    return x < y ? -1 : 1
  }
  if (pa.length !== pb.length) return pa.length - pb.length
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The one `beUniqueBy` condition (proposal 017, block 13; plan 0459): no two
 * elements share a key. Every member of a group is a finding at its own place,
 * naming the others, so excluding one member cannot hide the group. Keys compare
 * exactly. The others are named by location, not in load order, so a message is the same on every
 * runtime (bug 0526). Not cardinality-exempt: zero elements is the kernel's ordinary
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
          const others = group
            .filter((_, j) => j !== i)
            .map((o) => opts.locate(o).at)
            .sort(byLocation)
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
