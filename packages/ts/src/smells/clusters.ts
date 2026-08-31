import type { ArchFunction } from '../models/arch-function.js'
import type { SimilarPair } from './similar-pairs.js'

/** A group of bodies that are mutually reachable through reported similarity. */
export interface SimilarCluster {
  /** Members, in first-seen order; the first is what the violation anchors to. */
  readonly members: readonly ArchFunction[]
  /** The pairs that put these members in one group. */
  readonly pairs: readonly SimilarPair[]
  /** Highest similarity among {@link pairs}. */
  readonly peakSimilarity: number
}

/**
 * Group reported pairs into connected components.
 *
 * A pair is the wrong unit of report and it is not a close call. Measured on a
 * ~5,600-file production monorepo: 407 clusters produced **4,770** pair
 * findings, the eight largest clusters alone produced 49% of them, one cluster
 * of 89 members produced 398, and the worst single function was named 29 times.
 *
 * Every one of those findings can be true and the output is still unreadable,
 * because N mutually-similar bodies carry ONE observation and emit N^2/2 lines
 * of it. The observation is "these 89 share a shape", which is also the unit a
 * reader can act on. That is what this returns.
 */
export function clusterPairs(pairs: readonly SimilarPair[]): SimilarCluster[] {
  const parent = new Map<ArchFunction, ArchFunction>()
  const find = (x: ArchFunction): ArchFunction => {
    let root = parent.get(x) ?? x
    if (root === x) {
      parent.set(x, x)
      return x
    }
    root = find(root)
    parent.set(x, root)
    return root
  }
  const union = (a: ArchFunction, b: ArchFunction): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const pair of pairs) union(pair.a, pair.b)

  // First-seen order throughout, so the report is stable across runs. Map
  // iteration order is insertion order, and `pairs` arrives in the order the
  // comparison found them, which is the source-file walk order.
  const byRoot = new Map<ArchFunction, { members: ArchFunction[]; pairs: SimilarPair[] }>()
  const seen = new Set<ArchFunction>()
  for (const pair of pairs) {
    const root = find(pair.a)
    let entry = byRoot.get(root)
    if (!entry) {
      entry = { members: [], pairs: [] }
      byRoot.set(root, entry)
    }
    entry.pairs.push(pair)
    for (const fn of [pair.a, pair.b]) {
      if (seen.has(fn)) continue
      seen.add(fn)
      entry.members.push(fn)
    }
  }

  return [...byRoot.values()].map((entry) => ({
    members: entry.members,
    pairs: entry.pairs,
    peakSimilarity: entry.pairs.reduce((best, p) => Math.max(best, p.similarity), 0),
  }))
}

/**
 * How likely a cluster is to be worth acting on, highest first.
 *
 * Not a filter and deliberately not a score change — the similarity number is
 * left exactly as it was. This decides only what a reader sees first, because at
 * 4,770 findings the order IS the product.
 *
 * The signal is the one the fingerprint throws away: a body's identifiers are
 * ignored by design (that is what makes the score a type-2 clone score), and so
 * is the DECLARATION's own name, which is where the evidence was. Measured over
 * that same corpus, bucketed by how the two names relate:
 *
 * | bucket                        | share | reading                    |
 * | ----------------------------- | ----- | -------------------------- |
 * | different file, different name | 56%  | convergent idiom           |
 * | same class                     | 20%  | siblings, often extractable |
 * | different file, SAME name      | 14%  | a COPY of one function     |
 * | same file, different class     | 10%  | co-located                 |
 *
 * Two pairs from that run, both scored 100%: `timestampPrefix` in two files (a
 * literal copy) and two unrelated SDK wrapper methods (a shared idiom). Same
 * number on screen, opposite verdicts, and the thing that separates them costs
 * nothing to compute.
 *
 * **It is a ranking and not a filter on purpose.** Dropping the different-name
 * bucket would discard real same-class duplication — one repository in that
 * corpus has six `exists*` methods differing only in a table name. Dropping
 * cross-file would have discarded the finding that led to bug 0227.
 */
export function clusterRank(cluster: SimilarCluster): number {
  const bare = (fn: ArchFunction): string => (fn.getName() ?? '<anonymous>').split('.').pop() ?? ''
  const file = (fn: ArchFunction): string => fn.getSourceFile().getFilePath()
  let best = 0
  for (const pair of cluster.pairs) {
    const sameFile = file(pair.a) === file(pair.b)
    const sameName = bare(pair.a) === bare(pair.b)
    // A copy of one function into another file is the most actionable thing
    // this detector can find, and the cheapest to verify.
    const score = !sameFile && sameName ? 3 : sameFile ? 2 : 1
    if (score > best) best = score
  }
  return best
}
