import type { Fingerprint } from './fingerprint.js'

/**
 * One way two similar bodies differ: a text that appears in A where B has
 * another, at structurally-aligned positions.
 *
 * `occurrences` is how many aligned positions carry this same substitution. A
 * systematic rename — `cls` to `fn` throughout — is ONE axis with many
 * occurrences, which is the whole point: it is one decision a reader has to
 * evaluate, not twelve.
 */
export interface VariationAxis {
  readonly from: string
  readonly to: string
  readonly occurrences: number
}

/** What varies between two aligned bodies, and how much of them is shared. */
export interface Variation {
  /** Distinct substitutions, most frequent first. */
  readonly axes: readonly VariationAxis[]
  /** Aligned text-bearing positions whose texts are identical. */
  readonly sharedTexts: number
  /** Aligned text-bearing positions compared in total. */
  readonly comparedTexts: number
  /**
   * `true` when the bodies were too large to align, so the result is a declared
   * non-answer rather than a computed zero (ADR-010: a pass is constructed from
   * evidence, never from a default).
   */
  readonly skipped: boolean
}

/**
 * Bodies larger than this are not aligned. Traceback needs the full O(n*m)
 * matrix, unlike `computeSimilarity`'s two-row form, so a pathological pair
 * would allocate hundreds of MB. At the cap the matrix is 1200*1200 Int32 =
 * ~5.8MB, allocated one pair at a time and only for pairs already REPORTED —
 * never on the hot path that compares every pair.
 */
const MAX_ALIGN = 1200

/**
 * Which positions of `a` and `b` the LCS pairs up.
 *
 * `computeSimilarity` throws its alignment away and keeps only the length. The
 * alignment is the thing worth having: it is what lets a caller ask "at the
 * places these two bodies agree structurally, do they say the same words?" —
 * the question that separates a copy-paste from a shared idiom.
 */
function alignByKind(a: readonly number[], b: readonly number[]): Array<readonly [number, number]> {
  const m = a.length
  const n = b.length
  const dp = new Int32Array((m + 1) * (n + 1))
  const at = (i: number, j: number): number => i * (n + 1) + j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[at(i, j)] =
        a[i - 1] === b[j - 1]
          ? (dp[at(i - 1, j - 1)] ?? 0) + 1
          : Math.max(dp[at(i - 1, j)] ?? 0, dp[at(i, j - 1)] ?? 0)
    }
  }
  const pairs: Array<readonly [number, number]> = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1])
      i--
      j--
    } else if ((dp[at(i - 1, j)] ?? 0) >= (dp[at(i, j - 1)] ?? 0)) {
      i--
    } else {
      j--
    }
  }
  return pairs.reverse()
}

/**
 * What varies between two structurally-similar bodies.
 *
 * The detector's score answers "how alike are these shapes". It cannot answer
 * the question a reader actually has — "should I consolidate them" — and that
 * turns almost entirely on HOW MANY things vary:
 *
 * - one axis (`executeCheck` to `executeWarn`) — extract a parameter, clearly
 * - three axes (a measure, a name, a message) — extract, probably
 * - nine axes (every property name differs) — a shared idiom; leave it
 *
 * All three score alike today and read alike on screen, which is why triaging a
 * finding means opening both files. This returns what the reader would have gone
 * looking for.
 */
export function variationBetween(a: Fingerprint, b: Fingerprint): Variation {
  if (a.kinds.length > MAX_ALIGN || b.kinds.length > MAX_ALIGN) {
    return { axes: [], sharedTexts: 0, comparedTexts: 0, skipped: true }
  }
  const alignment = alignByKind(a.kinds, b.kinds)
  const counts = new Map<string, VariationAxis>()
  let shared = 0
  let compared = 0
  for (const [i, j] of alignment) {
    const ta = a.texts[i]
    const tb = b.texts[j]
    if (ta === undefined && tb === undefined) continue
    compared += 1
    if (ta === tb) {
      shared += 1
      continue
    }
    const from = ta ?? ''
    const to = tb ?? ''
    const key = `${from}\0${to}`
    const prev = counts.get(key)
    counts.set(key, { from, to, occurrences: (prev?.occurrences ?? 0) + 1 })
  }
  const axes = [...counts.values()].sort(
    (x, y) => y.occurrences - x.occurrences || x.from.localeCompare(y.from),
  )
  return { axes, sharedTexts: shared, comparedTexts: compared, skipped: false }
}
