/**
 * The single matching engine shared by `correspondence()` and `eess-ts`'s
 * `crossLayer` — "given two element sets and how to match them, which pairs
 * form and which elements are left unmatched." Extracting this removes the
 * duplicate pair-matching implementations the two builders used to carry.
 */

export interface Pair<L, R> {
  readonly left: L
  readonly right: R
}

export interface MatchResult<L, R> {
  /** Every matched (left, right) pair. */
  readonly pairs: Pair<L, R>[]
  /** Left elements with no matching right. */
  readonly leftUnmatched: L[]
  /** Right elements with no matching left. */
  readonly rightUnmatched: R[]
  /** Left elements that matched more than one right (ambiguous correspondence). */
  readonly leftAmbiguous: L[]
}

export interface MatchOptions<L, R> {
  /** Arbitrary predicate — O(n×m) Cartesian matching. */
  readonly matchBy?: (left: L, right: R) => boolean
  /** Join key per left element — O(n+m) indexed matching (with `rightKey`). */
  readonly leftKey?: (element: L) => string
  /** Join key per right element. */
  readonly rightKey?: (element: R) => string
}

function indexByKey<T>(elements: readonly T[], key: (el: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const el of elements) {
    const k = key(el)
    const list = map.get(k)
    if (list) list.push(el)
    else map.set(k, [el])
  }
  return map
}

/** Match two element sets by key (fast) or predicate (fallback). */
export function matchSelections<L, R>(
  left: readonly L[],
  right: readonly R[],
  opts: MatchOptions<L, R>,
): MatchResult<L, R> {
  if (opts.matchBy) {
    const matchBy = opts.matchBy
    const pairs: Pair<L, R>[] = []
    const matchedLeft = new Set<L>()
    const matchedRight = new Set<R>()
    const leftMatchCount = new Map<L, number>()
    for (const l of left) {
      for (const r of right) {
        if (matchBy(l, r)) {
          pairs.push({ left: l, right: r })
          matchedLeft.add(l)
          matchedRight.add(r)
          leftMatchCount.set(l, (leftMatchCount.get(l) ?? 0) + 1)
        }
      }
    }
    return {
      pairs,
      leftUnmatched: left.filter((l) => !matchedLeft.has(l)),
      rightUnmatched: right.filter((r) => !matchedRight.has(r)),
      leftAmbiguous: left.filter((l) => (leftMatchCount.get(l) ?? 0) > 1),
    }
  }

  const leftKey = opts.leftKey
  const rightKey = opts.rightKey
  if (!leftKey || !rightKey) {
    throw new TypeError('matchSelections requires either matchBy or both leftKey and rightKey')
  }
  const rightByKey = indexByKey(right, rightKey)
  const leftByKey = indexByKey(left, leftKey)
  const pairs: Pair<L, R>[] = []
  for (const l of left) {
    for (const r of rightByKey.get(leftKey(l)) ?? []) {
      pairs.push({ left: l, right: r })
    }
  }
  return {
    pairs,
    leftUnmatched: left.filter((l) => (rightByKey.get(leftKey(l))?.length ?? 0) === 0),
    rightUnmatched: right.filter((r) => (leftByKey.get(rightKey(r))?.length ?? 0) === 0),
    leftAmbiguous: left.filter((l) => (rightByKey.get(leftKey(l))?.length ?? 0) > 1),
  }
}
