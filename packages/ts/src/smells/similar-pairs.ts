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
  /**
   * The fingerprints the score came from, carried so a REPORTED pair can be
   * asked what varies between the two bodies without a second AST pass.
   *
   * Optional because a caller may construct a pair by hand — the message
   * builder degrades to the bare percentage rather than assuming.
   */
  fingerprintA?: Fingerprint
  fingerprintB?: Fingerprint
}

/**
 * The pairwise comparison behind `smells.duplicateBodies()`.
 *
 * Separated from the builder because it is the algorithm, not the DSL: the
 * builder's job is to collect a fluent configuration and hand it here. The
 * thresholds arrive as arguments rather than being read off a builder, so the
 * comparison is callable and testable without one.
 */

/**
 * Does one function's body enclose the other's?
 *
 * Only meaningful within one source file; two bodies in different files can
 * never nest. Compared on the BODY spans rather than the declarations, because
 * that is what was fingerprinted.
 */
function containsOther(a: ArchFunction, b: ArchFunction): boolean {
  const bodyA = a.getBody()
  const bodyB = b.getBody()
  if (!bodyA || !bodyB) return false
  if (bodyA.getSourceFile() !== bodyB.getSourceFile()) return false
  const [startA, endA] = [bodyA.getStart(), bodyA.getEnd()]
  const [startB, endB] = [bodyB.getStart(), bodyB.getEnd()]
  return (startA <= startB && endA >= endB) || (startB <= startA && endB >= endA)
}

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
      // A body compared against a body NESTED INSIDE IT can never be
      // actionable: "extract the shared logic into one function" is impossible
      // when one function already contains the other. The detector generates
      // these itself, because it collects object-literal functions by design —
      // so `const rule = () => ({ evaluate })` yields both the outer arrow and
      // the `evaluate` inside it, and they are similar by construction.
      //
      // Measured on this repo: 10 of 173 pairs, every one of them noise.
      if (containsOther(a.fn, b.fn)) continue
      const similarity = computeSimilarity(a.fingerprint, b.fingerprint)
      if (similarity >= minSimilarity) {
        pairs.push({
          a: a.fn,
          b: b.fn,
          similarity,
          fingerprintA: a.fingerprint,
          fingerprintB: b.fingerprint,
        })
      }
    }
  }

  return pairs
}
