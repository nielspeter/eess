import { SyntaxKind, type Node, Node as NodeClass } from 'ts-morph'

// Deliberately not exhaustive over every text-bearing kind — `TemplateHead`/
// `TemplateMiddle`/`TemplateTail` (interpolated templates), `BigIntLiteral` and
// `RegularExpressionLiteral` are omitted. Every omission UNDERcounts vocabulary,
// which only makes the floor (plan 0103) more conservative — fewer pairs
// compared, never a false positive from a body that reads as emptier than it
// is. Widen this set if a real interpolated-template-heavy corpus needs it.
const TEXT_KINDS = new Set<SyntaxKind>([
  SyntaxKind.Identifier,
  SyntaxKind.PrivateIdentifier,
  SyntaxKind.StringLiteral,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.NumericLiteral,
])

/**
 * Structural fingerprint of a function body.
 * Captures the shape (node kinds, call targets) while ignoring
 * identifiers, literals, and whitespace.
 */
export interface Fingerprint {
  /** Ordered sequence of syntax node kinds in the body */
  readonly kinds: readonly SyntaxKind[]
  /** Normalized call targets (e.g. ['parseInt', 'this.extractCount']) */
  readonly calls: readonly string[]
  /** Total AST node count (for line-count filtering) */
  readonly nodeCount: number
  /**
   * Count of DISTINCT identifier/literal texts in the body — the vocabulary
   * a body actually carries, as opposed to its punctuation/keyword shape.
   * Plan 0103's floor reads this; `computeSimilarity()` does not — see that
   * function's own docs for why.
   */
  readonly distinctVocabulary: number
}

/**
 * Build a structural fingerprint from a function body AST node.
 * Walks all descendants, records their SyntaxKind in order,
 * and extracts call expression targets.
 */
export function buildFingerprint(body: Node): Fingerprint {
  const kinds: SyntaxKind[] = []
  const calls: string[] = []
  const distinct = new Set<string>()

  for (const node of body.getDescendants()) {
    const kind = node.getKind()
    kinds.push(kind)
    if (NodeClass.isCallExpression(node)) {
      calls.push(node.getExpression().getText().replace(/\?\./g, '.'))
    }
    if (TEXT_KINDS.has(kind)) {
      distinct.add(node.getText())
    }
  }

  return { kinds, calls, nodeCount: kinds.length, distinctVocabulary: distinct.size }
}

/**
 * Overlap between two sets of call targets, normalized to [0, 1].
 *
 * Two bodies that make no calls at all carry no behavioural signal, so they
 * score 1.0 and leave the structural score to decide alone — six pairs in this
 * repo's own source are that shape, and they are unaffected by this factor.
 *
 * Targets are compared WHOLE (`JSON.parse`, `record.send`), never by trailing
 * member name. Measured: normalising to the last segment scores a condition
 * against its own negation at 0.974 — `haveStereotype` and `notHaveStereotype`
 * call the same methods on the same receiver — which is the false positive this
 * factor exists to remove.
 */
function callOverlap(a: readonly string[], b: readonly string[]): number {
  const aCalls = new Set(a)
  const bCalls = new Set(b)
  if (aCalls.size === 0 && bCalls.size === 0) return 1.0

  let shared = 0
  for (const call of aCalls) {
    if (bCalls.has(call)) shared++
  }
  // `max`, matching how the structural half normalises by the longer sequence.
  return shared / Math.max(aCalls.size, bCalls.size)
}

/**
 * Compute similarity between two fingerprints, in [0, 1].
 *
 * Two axes, and the WEAKER one governs: longest common subsequence over the
 * kind sequence (shape), and overlap of call targets (behaviour). A threshold
 * therefore keeps a single reading — "at least this similar on every axis
 * measured" — rather than averaging a strong signal over a weak one.
 *
 * **Why the second axis exists.**
 * [Bug 0169](../../../../work/bugs/0169-computesimilarity-ignores-call-targets-so-opposite-functions-read-as-duplicates.md):
 * this returned the structural score alone, and `buildFingerprint` had been
 * collecting `calls` since it was written with nothing ever reading them. Shape
 * alone measures punctuation. In a codebase built on a fluent DSL — where every
 * condition is `{ description, evaluate(elements, ctx) }` and ADR-003 makes that
 * uniformity the design — near-total structural similarity is the intent, so the
 * detector reported consistency as duplication. Measured over this repo at the
 * documented defaults it produced 218 findings, among them
 * `TerminalBuilder.check` ~ `TerminalBuilder.warn` at 100% (one throws and one
 * does not) and `haveStereotype` ~ `notHaveStereotype` at 97%.
 *
 * Call targets are the right second axis because they survive the rename that
 * DEFINES a type-2 clone: copy-pasted code with renamed variables still calls
 * the same functions, while two unrelated bodies sharing a skeleton do not.
 *
 * **Why `min` and not a product or a mean.** All three were measured against
 * known-true and known-false pairs in this repo:
 *
 * - a product drops `and`~`and` across the kernel/dialect split to 0.775 — a
 *   REAL duplicate, lost;
 * - a geometric mean scores `haveStereotype`~`notHaveStereotype` at 0.855, back
 *   over the 0.85 default;
 * - `min` keeps both true pairs and rejects every false one.
 *
 * Corpus effect: 164 reported pairs become 52, and what remains is dominated by
 * the genuine kernel/dialect duplication (`assertHomogeneous`,
 * `isExcludedByComment`, `viewsFor`, `RuleBuilder.select`).
 *
 * **What this does not fix.** Bodies sharing both a skeleton and their call
 * targets still score high — `TerminalBuilder`'s violation constructors are the
 * local example, and those are arguably fair findings. `duplicateBodies` remains
 * a `.warn()` detector rather than a gate, which is the honest weight for it.
 */
export function computeSimilarity(a: Fingerprint, b: Fingerprint): number {
  if (a.kinds.length === 0 && b.kinds.length === 0) return 1.0
  if (a.kinds.length === 0 || b.kinds.length === 0) return 0.0

  const lcs = lcsLength(a.kinds, b.kinds)
  const structural = lcs / Math.max(a.kinds.length, b.kinds.length)
  return Math.min(structural, callOverlap(a.calls, b.calls))
}

/** Standard LCS length computation (space-optimized two-row DP). */
function lcsLength(a: readonly number[], b: readonly number[]): number {
  const m = a.length
  const n = b.length
  let prev = new Array<number>(n + 1).fill(0)
  let curr = new Array<number>(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const prevDiag = prev[j - 1] ?? 0
      const prevAbove = prev[j] ?? 0
      const currLeft = curr[j - 1] ?? 0
      curr[j] = a[i - 1] === b[j - 1] ? prevDiag + 1 : Math.max(prevAbove, currLeft)
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }

  return prev[n] ?? 0
}
