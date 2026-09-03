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
export function otherFiles(own: string, all: readonly string[]): string[] | undefined {
  const rest = [...new Set(all)].filter((f) => f !== own).sort()
  return rest.length > 0 ? rest : undefined
}

/** The single finding standing for a group of three or more similar bodies. */
export function clusterViolation(
  cluster: SimilarCluster,
  context: { rule: string; because?: string },
): ArchViolation | undefined {
  const anchor = cluster.members[0]
  if (!anchor) return undefined
  const others = cluster.members.slice(1)
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
    // member a developer actually edited (bug 0239). The anchor is walk order,
    // so without this, which member could see the finding was decided by the
    // filesystem. De-duplicated: several members commonly share one file, and a
    // repeated path would say nothing extra to a set-based filter.
    relatedFiles: otherFiles(
      anchor.getSourceFile().getFilePath(),
      cluster.members.map((fn) => fn.getSourceFile().getFilePath()),
    ),
    message:
      `${locate(anchor)} is up to ${String(pct)}% similar to ` +
      `${String(others.length)} other bodies: ${shown}${rest > 0 ? `, +${String(rest)} more` : ''}` +
      `${varianceSummary(cluster.pairs[0])}`,
    // Same construction as the pair identity — sorted, path-qualified, and
    // without the percentage — so it survives a filesystem walking the members
    // in a different order and does not drift as a body is edited.
    identity: `duplicate-cluster::${keys.join('::')}`,
    because: context.because,
  }
}
