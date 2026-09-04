import type { ArchViolation } from '@nielspeter/eess'
import type { ArchFunction } from '../models/arch-function.js'
import type { SimilarPair } from './similar-pairs.js'
import type { SimilarCluster } from './clusters.js'
import { variationBetween } from './variation.js'

/**
 * How a duplicate-body finding READS.
 *
 * Separated from `DuplicateBodiesBuilder` for the same reason `similar-pairs.ts`
 * is: the builder's job is to collect a fluent configuration, and this is what
 * the result says. Keeping them together pushed the class past the repo's own
 * 150-line class rule, which is the rule noticing correctly.
 */

/**
 * Cluster members and variation axes shown before the message elides.
 *
 * Three is enough to recognise the group and short enough to stay one line in a
 * terminal. The remainder is always counted, never dropped silently.
 */
const MAX_SHOWN = 3

/**
 * Longest an axis text is shown before it is elided.
 *
 * A varying "identifier" can be a string literal, and a string literal can be a
 * forty-line SQL query in a template. Measured on a ~5,600-file monorepo: 527
 * findings rendered as **658 lines**, because axis texts carried their own
 * newlines straight into the message. A finding that spills over many lines
 * defeats the entire point of reporting axes, which is that a reader can triage
 * one at a glance.
 */
const MAX_AXIS_TEXT = 32

/**
 * One axis text, guaranteed to be one short line.
 *
 * Whitespace is collapsed BEFORE truncating, so a multi-line literal is not
 * merely cut at its first newline — that would silently present the first line
 * as if it were the whole text.
 */
function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= MAX_AXIS_TEXT ? flat : `${flat.slice(0, MAX_AXIS_TEXT - 1)}…`
}

/** How one body reads inside a message. */
function locate(fn: ArchFunction): string {
  return `${fn.getName() ?? '<anonymous>'} (${fn.getSourceFile().getFilePath()}:${String(fn.getStartLineNumber())})`
}

/**
 * What differs between two reported bodies, in one clause.
 *
 * The percentage answers "how alike are these shapes" and cannot answer the
 * question a reader actually has, which is "should I consolidate them". That
 * turns on how many things vary: one call target is a parameter extraction,
 * nine property names is a shared idiom, and those two score identically today.
 *
 * Measured on a ~5,600-file production monorepo — the bucket that is mostly
 * convergent idiom carries a median of 6 varying axes against 4 for the rest.
 * Real information, and NOT a classifier: it is reported, never filtered on.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests. Its last in-`src` caller moved into this module when `pairViolation` was extracted here (bug 0242), so the export now exists for `variation.test.ts` alone — two tests there, both feeding it a hand-built fingerprint pair: one pins the one-line elision measured at 527 findings rendering as 658 lines, the other pins the `too large to diff` wording. Writing this reason down found that its `skipped` branch was rendered by nobody's test — asserted on `variationBetween` alone — so `variation.test.ts` now pins that wording too.
export function varianceSummary(pair: SimilarPair | undefined): string {
  const a = pair?.fingerprintA
  const b = pair?.fingerprintB
  if (!a || !b) return ''
  const variation = variationBetween(a, b)
  // A declared non-answer, not a computed zero (ADR-010) — saying "differs in
  // nothing" about a pair too large to align would be a lie in the direction
  // that costs a reader most.
  if (variation.skipped) return ' — too large to diff'
  if (variation.axes.length === 0) return ' — identical text: a literal copy'
  const shown = variation.axes
    .slice(0, MAX_SHOWN)
    .map((axis) => `${oneLine(axis.from)} -> ${oneLine(axis.to)}`)
    .join(', ')
  const rest = variation.axes.length - Math.min(MAX_SHOWN, variation.axes.length)
  const noun = variation.axes.length === 1 ? 'axis' : 'axes'
  return ` — ${String(variation.axes.length)} varying ${noun}: ${shown}${rest > 0 ? `, +${String(rest)} more` : ''}`
}

/**
 * The files a finding concerns besides the one it is reported at.
 *
 * `relatedFiles` means the OTHERS: `file` is already the finding's own, and
 * repeating it would make the field's own meaning ambiguous to any consumer
 * that reads the two together. Sorted so the value does not depend on source
 * walk order, and `undefined` rather than `[]` when a duplicate sits entirely
 * within one file — an empty array reads as "checked, none", which is true, but
 * omitting it keeps a single-file finding byte-identical to what shipped.
 */
function otherFiles(own: string, all: readonly string[]): string[] | undefined {
  const rest = [...new Set(all)].filter((f) => f !== own).sort()
  return rest.length > 0 ? rest : undefined
}

/**
 * One body's place in the total order every part of a finding is derived from.
 *
 * `name` is the third key and is optional only so the choice stays testable as
 * pure data. Two anonymous functions can share a file AND a line —
 * `{ handler: () => {}, fallback: () => {} }` on one line, which
 * `collectFunctions({ includeObjectLiteralFunctions: true })` does collect — and
 * without a third component such a pair falls back to walk order, which is the
 * whole defect.
 */
interface BodyPosition {
  readonly file: string
  readonly line: number
  readonly name?: string
}

/**
 * The total order: path, then line, then name.
 *
 * ONE comparator, because this is one decision. It was briefly two — a `<` on
 * `{ file, line }` here and a zero-padded string key beside `orientPair` — which
 * review called out as the module whose subject is duplicated bodies duplicating
 * a body. They agreed, but only by accident of padding width: unpadded, `":10"`
 * sorts before `":9"` lexicographically, so two same-file bodies at lines 9 and
 * 10 would have oriented a finding's axes against the anchor it reports at.
 */
function comparePositions(a: BodyPosition, b: BodyPosition): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1
  if (a.line !== b.line) return a.line - b.line
  const an = a.name ?? ''
  const bn = b.name ?? ''
  return an < bn ? -1 : an > bn ? 1 : 0
}

/** Where a body sits, as the order above wants it. */
function positionOf(fn: ArchFunction): BodyPosition {
  return {
    file: fn.getSourceFile().getFilePath(),
    line: fn.getStartLineNumber(),
    name: fn.getName() ?? '<anonymous>',
  }
}

/**
 * Which member a finding is reported at — by the total order, never walk order.
 *
 * Bug 0242. The identity is sorted precisely so it "survives a filesystem
 * walking the members in a different order"; the ANCHOR decides `file` and
 * `line`, which is where an author must put `// eess-exclude`, and it was
 * `members[0]` — that same walk order. Durable identity beside a non-durable
 * location, in one finding: a waiver committed against the member one machine
 * reported would stop suppressing on a machine that reported the other.
 *
 * Precondition: at least one member. On an empty list it returns 0, which is not
 * a valid index — the caller guards on the lookup, and returning a sentinel
 * would move that guard rather than remove it. Stated because a total signature
 * over a partial function is worth saying out loud.
 *
 * Takes plain positions rather than the nodes, so the choice is testable without
 * a ts-morph project. An end-to-end test that reads whatever order the
 * filesystem happens to give cannot tell "sorted" from "walk order" when that
 * walk is already alphabetical — it would pass against the bug it was written
 * for. One that *reverses* the walk deliberately can, and both
 * `tests/smells/anchor-determinism.test.ts` and
 * `tests/integration/baseline-portability.test.ts` do: together they are a
 * differently-derived pair (ADR-009 rule 5), not a duplicate.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests. Exported ON PURPOSE — `anchor-determinism.test.ts` asserts this choice as pure data, which is the derivation an end-to-end test reading the filesystem's own order cannot supply when that order is already alphabetical.
export function anchorIndex(members: readonly BodyPosition[]): number {
  let best = 0
  for (let i = 1; i < members.length; i++) {
    const m = members[i]
    const b = members[best]
    if (!m || !b) continue
    if (comparePositions(m, b) < 0) best = i
  }
  return best
}

/**
 * The file a finding over these bodies will be reported at.
 *
 * Exported so report ORDER can be keyed on the member the finding actually
 * names. `.groupByFolder()` sorted on the walk-order endpoint, which agreed with
 * the reported location only until bug 0242 moved the anchor — after which a
 * finding reported in one folder could sort into a different folder's group,
 * which is the one thing that option exists to prevent.
 *
 * Returns '' for an empty list, matching what the callers already did with a
 * missing member rather than inventing a second convention for it.
 */
export function anchorFile(members: readonly ArchFunction[]): string {
  const positions = members.map((fn) => ({
    file: fn.getSourceFile().getFilePath(),
    line: fn.getStartLineNumber(),
  }))
  return positions[anchorIndex(positions)]?.file ?? ''
}

/**
 * Which pair's varying axes stand as the cluster's evidence.
 *
 * `pairs[0]` was the first pair the search happened to find, so the axes quoted
 * for one finding differed between machines (bug 0242, second pass). Chosen by
 * the same total order as the anchor, applied to the pair's own endpoints, so
 * the evidence is a function of the members and not of discovery.
 */
function representativePair(pairs: readonly SimilarPair[]): SimilarPair | undefined {
  // Oriented BEFORE comparing, which is what lets `comparePairs` be a plain
  // two-key comparison. The first version sorted each pair's ends inside the
  // comparator instead; that sort was redundant with this orientation and no
  // sabotage of it went red, so it was removed rather than given a test. An
  // unfalsifiable branch is worth deleting when the alternative is a fixture
  // written to justify keeping it.
  let best: SimilarPair | undefined
  for (const p of pairs) {
    const oriented = orientPair(p)
    if (best === undefined || comparePairs(oriented, best) < 0) best = oriented
  }
  return best
}

/**
 * Two ORIENTED pairs, by their lower end and then their upper.
 *
 * Requires both arguments to have been through {@link orientPair}, which is why
 * it is not exported: on an un-oriented pair `a` is the source walk and this
 * comparison would inherit exactly the non-determinism it exists to remove.
 */
function comparePairs(x: SimilarPair, y: SimilarPair): number {
  const first = comparePositions(positionOf(x.a), positionOf(y.a))
  return first !== 0 ? first : comparePositions(positionOf(x.b), positionOf(y.b))
}

/**
 * A pair with its two ends in the total order — `a` is the end a finding over
 * this pair is reported at.
 *
 * `varianceSummary` renders `from -> to` off the pair's own `a`/`b`, and which
 * end is `a` is the source walk — so the SAME finding read `'x' -> 'y'` on one
 * machine and `'y' -> 'x'` on another (bug 0242, second pass). Ordering the ends
 * makes the direction a function of the members.
 *
 * **Requires a pair with real nodes.** `SimilarPair` documents a hand-built pair
 * as a supported shape, and an earlier version of this comment claimed such a
 * pair was "never touched" because the in-order branch returned it unchanged.
 * That was false, and review measured it: `positionOf(pair.a)` is the FIRST
 * thing evaluated, so a pair with no nodes throws before any branch is taken. A
 * caller that only wants a variance summary must call `varianceSummary`
 * directly, as `variation.test.ts` does.
 *
 * Always returns a new object, in both branches. Returning the caller's own
 * object when it was already in order gave the two branches different ownership
 * semantics — a later mutation of the result would write through to the input on
 * one path and not the other.
 */
function orientPair(pair: SimilarPair): SimilarPair {
  if (comparePositions(positionOf(pair.a), positionOf(pair.b)) <= 0) return { ...pair }
  return {
    ...pair,
    a: pair.b,
    b: pair.a,
    fingerprintA: pair.fingerprintB,
    fingerprintB: pair.fingerprintA,
  }
}

/**
 * The finding for a duplicated PAIR — two bodies, the common case.
 *
 * Lives here beside `clusterViolation` for the reason this module's own
 * docstring gives: the builder collects a fluent configuration, and this is what
 * the result says. Keeping it inline pushed `DuplicateBodiesBuilder` past the
 * repo's 150-line class rule and its own method past 30 — the rules noticing
 * correctly, twice, exactly as they did when this module was first split out.
 */
export function pairViolation(
  pair: SimilarPair,
  context: { rule: string; because?: string },
): ArchViolation {
  // Bug 0242: which endpoint is `a` is the source walk, so the REPORTED
  // location — where an author must put `// eess-exclude` — moved with the
  // filesystem, while the identity below was sorted precisely so it would not.
  //
  // Oriented ONCE, and everything below derived from that one decision. It was
  // briefly derived twice — `anchorIndex` for the coordinates, `orientPair` for
  // the axis direction — which review called out: a divergence between the two
  // would print a finding whose prose leads with one body while its axes read in
  // the other direction, the exact contradiction `anchor-determinism.test.ts`
  // was added to catch.
  //
  // Total, not `| undefined`. The earlier shape returned `undefined` on a branch
  // that could not be reached and the caller dropped that with `?? []` — a
  // finding vanishing with no diagnostic, in a repo whose whole thesis is that
  // silent drops are the disqualifying failure. Unreachable today is not a
  // defence: the type is what stops it becoming reachable.
  const oriented = orientPair(pair)
  const first = positionOf(oriented.a)
  const second = positionOf(oriented.b)
  const nameA = first.name ?? '<anonymous>'
  const nameB = second.name ?? '<anonymous>'
  const pct = Math.round(pair.similarity * 100)

  return {
    rule: context.rule,
    element: nameA,
    file: first.file,
    line: first.line,
    // Both endpoints (bug 0239). A two-body duplicate is the COMMON case — copy
    // a function into one new file — and it had the same defect as a cluster:
    // anchored on one end, so the other could not see it under `--changed`.
    relatedFiles: otherFiles(first.file, [first.file, second.file]),
    message:
      `${nameA} (${first.file}:${String(first.line)}) is ${String(pct)}% similar to ` +
      `${nameB} (${second.file}:${String(second.line)})${varianceSummary(oriented)}`,
    // Sorted, path-qualified and without the percentage, so the pair reads the
    // same whichever way a filesystem walks it and does not drift as a body is
    // edited. The anchor above uses the same ordering.
    //
    // Limitation: two anonymous functions in one file share an endpoint
    // (`<file>#<anonymous>`) and so share an identity. Measured at 0 collisions
    // over 1006 findings on a real codebase; the guard in
    // `tests/integration/baseline-portability.test.ts` is what would catch it
    // becoming common.
    identity: `duplicate-pair::${[`${first.file}#${nameA}`, `${second.file}#${nameB}`].sort().join('::')}`,
    because: context.because,
  }
}

/** The single finding standing for a group of three or more similar bodies. */
export function clusterViolation(
  cluster: SimilarCluster,
  context: { rule: string; because?: string },
): ArchViolation {
  const at = anchorIndex(
    cluster.members.map((fn) => ({
      file: fn.getSourceFile().getFilePath(),
      line: fn.getStartLineNumber(),
    })),
  )
  // Total, like `pairViolation`. `members` is typed non-empty, so the anchor
  // lookup cannot miss and there is no `undefined` for the caller to drop.
  const anchor = cluster.members[at] ?? cluster.members[0]
  // Sorted by the same total order the anchor uses (bug 0242, second pass).
  // `MAX_SHOWN` elides all but the first few, so first-seen order decided WHICH
  // member a reader never sees — the filesystem's choice, printed as evidence.
  // Nothing here moves the identity or `relatedFiles`, so no waiver breaks; what
  // breaks is a reader comparing a local run against CI.
  const others = cluster.members
    .filter((_, i) => i !== at)
    .map((fn) => ({ fn, at: positionOf(fn) }))
    .sort((x, y) => comparePositions(x.at, y.at))
    .map((m) => m.fn)
  const shown = others.slice(0, MAX_SHOWN).map(locate).join(', ')
  const rest = others.length - Math.min(MAX_SHOWN, others.length)
  const pct = Math.round(cluster.peakSimilarity * 100)
  const keys = cluster.members
    .map((fn) => `${fn.getSourceFile().getFilePath()}#${fn.getName() ?? '<anonymous>'}`)
    .sort()
  return {
    rule: context.rule,
    element: anchor.getName() ?? '<anonymous>',
    file: anchor.getSourceFile().getFilePath(),
    line: anchor.getStartLineNumber(),
    // Every member's file, so `--changed` keeps this finding for whichever
    // member a developer actually edited (bug 0239). Keyed on the ANCHOR — this
    // comment used to say "the anchor is walk order", which bug 0242 made false
    // in the same commit that left the sentence standing. De-duplicated: several
    // members commonly share one file, and a repeated path would say nothing
    // extra to a set-based filter.
    relatedFiles: otherFiles(
      anchor.getSourceFile().getFilePath(),
      cluster.members.map((fn) => fn.getSourceFile().getFilePath()),
    ),
    message:
      `${locate(anchor)} is up to ${String(pct)}% similar to ` +
      `${String(others.length)} other bodies: ${shown}${rest > 0 ? `, +${String(rest)} more` : ''}` +
      `${varianceSummary(representativePair(cluster.pairs))}`,
    // Same construction as the pair identity — sorted, path-qualified, and
    // without the percentage — so it survives a filesystem walking the members
    // in a different order and does not drift as a body is edited.
    identity: `duplicate-cluster::${keys.join('::')}`,
    because: context.because,
  }
}
