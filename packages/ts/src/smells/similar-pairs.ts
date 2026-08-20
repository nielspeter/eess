import type { ArchFunction } from '../models/arch-function.js'
import type { Fingerprint } from './fingerprint.js'
import { buildFingerprint, computeSimilarity } from './fingerprint.js'

/** A function paired with its structural fingerprint. */
interface FingerprintedFunction {
  fn: ArchFunction
  fingerprint: Fingerprint
}

/** Two bodies the detector considers similar enough to report, and by how much. */
export interface SimilarPair {
  a: ArchFunction
  b: ArchFunction
  similarity: number
}

/**
 * The pairwise comparison behind `smells.duplicateBodies()`.
 *
 * Separated from the builder because it is the algorithm, not the DSL: the
 * builder's job is to collect a fluent configuration and hand it here. The
 * thresholds arrive as arguments rather than being read off a builder, so the
 * comparison is callable and testable without one.
 */

/** Build fingerprints for all collected functions. */
export function fingerprintAll(functions: ArchFunction[]): FingerprintedFunction[] {
  const result: FingerprintedFunction[] = []
  for (const fn of functions) {
    const body = fn.getBody()
    if (!body) continue
    result.push({ fn, fingerprint: buildFingerprint(body) })
  }
  return result
}

/** Compare all pairs of fingerprints, collect those above threshold. */
export function findSimilarPairs(
  items: FingerprintedFunction[],
  minSimilarity: number,
  minDistinctVocabulary: number,
): SimilarPair[] {
  const pairs: SimilarPair[] = []

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]
      const b = items[j]
      if (!a || !b) continue
      // Fast rejection 1: if node counts differ too much, similarity cannot reach threshold
      const maxCount = Math.max(a.fingerprint.nodeCount, b.fingerprint.nodeCount)
      const minCount = Math.min(a.fingerprint.nodeCount, b.fingerprint.nodeCount)
      if (maxCount > 0 && minCount / maxCount < minSimilarity) {
        continue
      }
      // Fast rejection 2 (plan 0103): neither body has enough distinct vocabulary
      // for a match to be evidence of anything. `Math.min`, not sum or average —
      // ONE small-vocabulary side is enough to make the pair uninformative
      // regardless of the other side's size.
      const minDistinct = Math.min(
        a.fingerprint.distinctVocabulary,
        b.fingerprint.distinctVocabulary,
      )
      if (minDistinct < minDistinctVocabulary) {
        continue
      }
      const similarity = computeSimilarity(a.fingerprint, b.fingerprint)
      if (similarity >= minSimilarity) {
        pairs.push({ a: a.fn, b: b.fn, similarity })
      }
    }
  }

  return pairs
}
