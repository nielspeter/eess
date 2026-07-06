import type { ArchViolation } from './violation.js'
import { TerminalBuilder } from './terminal-builder.js'
import { matchSelections, type MatchOptions } from './matching.js'

/** How to identify an element for a two-sided violation message. */
export interface ElementInfo {
  readonly name: string
  readonly file?: string
  readonly line?: number
}

/**
 * A labelled set of elements produced by a dialect's `.select()` terminal.
 * Engine-neutral: `T` is opaque; `identify` yields message metadata.
 */
export interface Selection<T> {
  readonly elements: readonly T[]
  readonly label: string
  readonly identify: (element: T) => ElementInfo
}

export type Direction = 'left-to-right' | 'right-to-left' | 'both'

/** Extract related endpoints from an element (for `preserveRelations`). */
export interface RelationSpec<L, R> {
  readonly left: (element: L) => readonly string[]
  readonly right: (element: R) => readonly string[]
  readonly direction?: Direction
}

/**
 * Join-key extraction for a correspondence (O(n+m) indexed matching).
 *
 * - A single function keys both sides — each element is `L | R`. Convenient
 *   when both sides share a key shape.
 * - A `{ left, right }` pair keys each side with its own type — no
 *   union-narrowing at the call site, and the join key may differ from the
 *   display name (show "ADR 001", join on "001").
 *
 * Omit `keyBy` entirely to key by each side's `identify().name`.
 */
export type KeyBy<L, R> =
  | ((element: L | R) => string)
  | { readonly left: (l: L) => string; readonly right: (r: R) => string }

export interface CorrespondenceOptions<L, R> {
  readonly left: Selection<L>
  readonly right: Selection<R>
  /** Fast path: extract a join key per element (O(n+m)). Defaults to `identify().name`. */
  readonly keyBy?: KeyBy<L, R>
  /** General fallback: arbitrary predicate (O(n×m)). Use only when no key exists. */
  readonly matchBy?: (left: L, right: R) => boolean
  /** Optional per-side fix suggestions for the two-sided message. */
  readonly suggest?: {
    readonly left?: (info: ElementInfo, right: Selection<R>) => string
    readonly right?: (info: ElementInfo, left: Selection<L>) => string
  }
}

function violationFor(info: ElementInfo, message: string, ruleId?: string): ArchViolation {
  return {
    rule: 'correspondence',
    ruleId,
    element: info.name,
    file: info.file ?? '<selection>',
    line: info.line ?? 0,
    message,
    codeFrame: undefined,
  }
}

type Check<L, R> = (o: CorrespondenceOptions<L, R>, ruleId?: string) => ArchViolation[]

/**
 * Builder binding two element selections and asserting they correspond. A
 * `TerminalBuilder` (it operates over two selections, like the pair builders),
 * so `because`/`rule`/`warn`/`excluding`/baseline come for free. It does NOT
 * compose with the `not`/`and`/`or` combinators (those act on
 * `Predicate`/`Condition`). Chain checks with `.andShould()`.
 */
export class CorrespondenceBuilder<L, R> extends TerminalBuilder {
  private readonly _checks: Check<L, R>[] = []

  constructor(private readonly opts: CorrespondenceOptions<L, R>) {
    super()
  }

  /** Readability marker; the condition phase is implicit. */
  should(): this {
    return this
  }

  /** Chain another correspondence check (AND). */
  andShould(): this {
    return this
  }

  /** Every element on the named side(s) has a counterpart on the other. */
  beComplete(opts: { direction?: Direction } = {}): this {
    this._checks.push((o, ruleId) => completeness(o, opts.direction ?? 'both', ruleId))
    return this
  }

  /** Related endpoints on one side have matching relations on the other. */
  preserveRelations(spec: RelationSpec<L, R>): this {
    this._checks.push((o, ruleId) => relations(o, spec, ruleId))
    return this
  }

  protected collectViolations(): ArchViolation[] {
    const ruleId = this._metadata?.id
    return this._checks.flatMap((check) => check(this.opts, ruleId))
  }
}

/** Bind two selections into a correspondence. */
export function correspondence<L, R>(
  opts: CorrespondenceOptions<L, R>,
): CorrespondenceBuilder<L, R> {
  return new CorrespondenceBuilder(opts)
}

// --- matching internals (delegate to the shared matchSelections engine) ---

function matchOptsFor<L, R>(o: CorrespondenceOptions<L, R>): MatchOptions<L, R> {
  if (o.matchBy) return { matchBy: o.matchBy }
  const { keyBy, left, right } = o
  // Omitted → key by each side's identify().name. A function → same key both
  // sides. A { left, right } pair → each side keyed by its own extractor.
  if (keyBy === undefined) {
    return {
      leftKey: (el) => left.identify(el).name,
      rightKey: (el) => right.identify(el).name,
    }
  }
  if (typeof keyBy === 'function') {
    return { leftKey: keyBy, rightKey: keyBy }
  }
  return { leftKey: keyBy.left, rightKey: keyBy.right }
}

function completeness<L, R>(
  o: CorrespondenceOptions<L, R>,
  direction: Direction,
  ruleId?: string,
): ArchViolation[] {
  const out: ArchViolation[] = []
  const suggestLeft = o.suggest?.left
  const suggestRight = o.suggest?.right
  const result = matchSelections(o.left.elements, o.right.elements, matchOptsFor(o))

  if (direction !== 'right-to-left') {
    for (const l of result.leftUnmatched) {
      const info = o.left.identify(l)
      const extra = suggestLeft ? `\n  ${suggestLeft(info, o.right)}` : ''
      out.push(
        violationFor(
          info,
          `${o.left.label} "${info.name}" has no matching ${o.right.label}${extra}`,
          ruleId,
        ),
      )
    }
    for (const l of result.leftAmbiguous) {
      const info = o.left.identify(l)
      out.push(
        violationFor(
          info,
          `${o.left.label} "${info.name}" matches multiple ${o.right.label}s — the correspondence is ambiguous`,
          ruleId,
        ),
      )
    }
  }
  if (direction !== 'left-to-right') {
    for (const r of result.rightUnmatched) {
      const info = o.right.identify(r)
      const extra = suggestRight ? `\n  ${suggestRight(info, o.left)}` : ''
      out.push(
        violationFor(
          info,
          `${o.right.label} "${info.name}" has no matching ${o.left.label}${extra}`,
          ruleId,
        ),
      )
    }
  }
  return out
}

function relations<L, R>(
  o: CorrespondenceOptions<L, R>,
  spec: RelationSpec<L, R>,
  ruleId?: string,
): ArchViolation[] {
  const out: ArchViolation[] = []
  const direction = spec.direction ?? 'both'
  const result = matchSelections(o.left.elements, o.right.elements, matchOptsFor(o))

  // group right counterparts by their left element (object identity)
  const byLeft = new Map<L, R[]>()
  for (const p of result.pairs) {
    const list = byLeft.get(p.left)
    if (list) list.push(p.right)
    else byLeft.set(p.left, [p.right])
  }

  if (direction !== 'right-to-left') {
    for (const l of o.left.elements) {
      const counterparts = byLeft.get(l) ?? []
      if (counterparts.length === 0) continue
      const rightRelations = new Set(counterparts.flatMap((r) => spec.right(r)))
      const info = o.left.identify(l)
      for (const rel of spec.left(l)) {
        if (!rightRelations.has(rel)) {
          out.push(
            violationFor(
              info,
              `${o.left.label} "${info.name}" relates to "${rel}" but its ${o.right.label} counterpart does not`,
              ruleId,
            ),
          )
        }
      }
    }
  }
  return out
}
