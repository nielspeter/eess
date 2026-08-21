/**
 * **The exports here are `crossProject` / `CrossProjectBuilder`; the FILE is still
 * `correspondence-builder.ts`, on purpose.**
 *
 * The symbols were renamed because `correspondence` collided: the kernel exports
 * a different `correspondence({ left, right })` that `eess-md` re-exports and
 * `docs/markdown.md` teaches, so one word named two incompatible APIs inside one
 * family — and `family.rules.ts`'s allowlist, written to mean "eess-ts has no
 * correspondence", silently permitted "eess-ts has a different one". Found by the
 * product and architect reviews of PR #72.
 *
 * The filename did not follow because nine `path:line` pointers in CLOSED records
 * (plans 0147 and 0150) cite it. Renaming the file would either break them or
 * require rewriting finished history to describe a name that never existed at the
 * time. The collision was in the published API, and that is what was fixed;
 * tidying the filename is not worth falsifying a record.
 */
import type { ViolationMeta } from './correspondence-findings.js'
import {
  duplicateKeyFindings,
  materializeSides,
  resolveSides,
  emptinessFindings,
  matchFindings,
  unboundDeclarationFindings,
} from './correspondence-findings.js'
import type { RuleDescription } from '@nielspeter/eess'
import type { CollectResult } from '../core/terminal-builder.js'
import { selectionMemo } from '@nielspeter/eess'
import type { ArchProject } from '../core/project.js'
import { RuleBuilder } from '../core/rule-builder.js'
import { TerminalBuilder } from '../core/terminal-builder.js'
import { setCorrespondence } from '@nielspeter/eess'
import type { CorrespondenceResult } from '@nielspeter/eess'

/**
 * Map a selection subject to one or more comparison keys.
 *
 * This is the acknowledged raw-node seam (ADR-007): `subject` is the builder's
 * element type (a ts-morph node for `classes()`/`types()`, an `ArchCall` /
 * `ArchFunction` wrapper otherwise). Prefer the `byName` / `byArg` /
 * `byPropertyNames` vocabulary below for the common cases.
 */
export type KeyFn<T> = (subject: T) => string | readonly string[]

/** A plain, already-derived key set. Normalize keys before passing them. */
export type KeysSource = readonly string[] | ReadonlySet<string>

/**
 * The materialized state of one correspondence check, threaded to the phase
 * helpers as ONE object.
 *
 * Six values travel together — two sides, their keyed maps, the set result and
 * the violation metadata — and passing them positionally would put every helper
 * over the four-parameter cap while inviting the transposition that cap exists
 * to prevent (`aKeyed`/`bKeyed` are the same type).
 */
export interface Pairing {
  readonly sideA: Side
  readonly sideB: Side
  readonly aKeyed: Map<string, unknown[]>
  readonly bKeyed: Map<string, unknown[]>
  readonly result: CorrespondenceResult
  readonly meta: ViolationMeta
  /** What the rule DECLARED — the fields the findings functions read. */
  readonly declared: Declared
}

/** The assertions a correspondence rule made about its two sides. */
export interface Declared {
  readonly sides: readonly Side[]
  readonly distinctKeys: ReadonlySet<string>
  readonly expectEmptySides: ReadonlySet<string>
  readonly checkComplete: boolean
  readonly checkNoOrphans: boolean
  readonly metadata: { id?: string; suggestion?: string; docs?: string } | undefined
  readonly reason: string | undefined
}

export interface Side {
  readonly name: string
  /** Lazily build key → subjects (subjects is empty for a literal side). */
  readonly materialize: () => Map<string, unknown[]>
}

function toKeyArray(key: string | readonly string[]): readonly string[] {
  return typeof key === 'string' ? [key] : key
}

/** Model wrappers (ArchCall, ArchFunction, …) expose getNode(): Node. */

function keyedFromSelection<T>(source: RuleBuilder<T>, keyFn: KeyFn<T>): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>()
  for (const subject of source.subjects()) {
    for (const key of toKeyArray(keyFn(subject))) {
      const bucket = map.get(key)
      if (bucket) bucket.push(subject)
      else map.set(key, [subject])
    }
  }
  return map
}

function keyedFromKeys(keys: KeysSource): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>()
  for (const key of keys) {
    if (!map.has(key)) map.set(key, [])
  }
  return map
}

/**
 * Assert a correspondence between two independently-derived key sets:
 * "every X has a matching Y" (and/or the reverse). This is ADR-008 Rule 5 as a
 * primitive — two derivations plus a disagreement test — so identity-not-count
 * and non-vacuity are impossible to get wrong.
 *
 * The chain: `.side()` twice → `.beComplete()` / `.haveNoOrphans()` /
 * `.beBijective()` → `.check()`.
 *
 * @example
 * correspondence(p)
 *   .side('routes', calls(p).that().onObject('app'), byArg(0))
 *   .side('matrix', Object.keys(ROUTE_PERMISSIONS))
 *   .should()
 *   .beComplete()
 *   .rule({ id: 'auth/route-matrix', suggestion: 'Add the route to ROUTE_PERMISSIONS.' })
 *   .check()
 */
export const sidesOf = selectionMemo<Map<string, unknown[]>>()

/**
 * The two-sided join: bind two artifacts by key and fail on the difference.
 *
 * Where every other builder selects subjects and asserts something about each,
 * this one declares two (or more) named SIDES, derives a key set from each, and
 * reports the set difference. It is the kernel's answer to "these two things must
 * agree" — a route table against its permission map, a diagram against the code,
 * a README table against the workspace.
 *
 * ```ts
 * correspondence(project)
 *   .side('routes', classes(project).that().haveDecorator('Controller'), routeKey)
 *   .side('matrix', Object.keys(ROUTE_PERMISSIONS))
 *   .should()
 *   .beComplete()
 *   .check()
 * ```
 *
 * `beComplete()` reports keys the second side is missing, `haveNoOrphans()` the
 * reverse, and `beBijective()` both. A builder with fewer than two sides has
 * compared nothing, and `examinedUnits()` reports that as zero rather than
 * letting it pass vacuously (ADR-010).
 */
export class CrossProjectBuilder extends TerminalBuilder {
  private _sides: Side[] = []
  private _checkComplete = false
  private _checkNoOrphans = false
  private _expectEmptySides = new Set<string>()
  private _distinctKeys = new Set<string>()

  // `_project` is accepted for API symmetry with the other entry points
  // (modules/classes/…); correspondence's sides carry their own project.
  constructor(_project: ArchProject) {
    super()
  }

  /** Add a side from a selection, keyed by `keyFn`. */
  side<T>(name: string, source: RuleBuilder<T>, keyFn: KeyFn<T>): this
  /** Add a side from an already-derived key set (pre-normalized). */
  side(name: string, keys: KeysSource): this
  /**
   * Declare one side of the correspondence.
   *
   * `source` is either a `RuleBuilder` selection — in which case `keyFn` is
   * REQUIRED, because a subject has no inherent key and guessing one silently
   * mis-joins the two sides — or a ready-made key source.
   *
   * Call it twice; a builder with fewer than two sides has compared nothing,
   * which `examinedUnits()` reports as zero rather than passing vacuously.
   */
  side<T>(name: string, source: RuleBuilder<T> | KeysSource, keyFn?: KeyFn<T>): this {
    const next = this.copy()
    if (source instanceof RuleBuilder) {
      if (!keyFn) {
        throw new TypeError(
          `correspondence side '${name}' from a selection requires a keyFn (subject -> key).`,
        )
      }
      next._sides.push({ name, materialize: () => keyedFromSelection(source, keyFn) })
    } else {
      next._sides.push({ name, materialize: () => keyedFromKeys(source) })
    }
    return next
  }

  /**
   * An independent copy, carrying the sides and both opt-out sets.
   *
   * `collectViolations` throws unless there are exactly two sides, so a leaked
   * `_sides` push does not fail silently here — but a leaked declaration does:
   * it is what stands between a vacuous side and a finding, and inheriting it
   * turns a later rule's empty side green.
   */
  protected override copy(): this {
    const clone = super.copy()
    clone._sides = [...this._sides]
    clone._expectEmptySides = new Set(this._expectEmptySides)
    clone._distinctKeys = new Set(this._distinctKeys)
    return clone
  }

  /** Optional readability markers — the assertion terminals may be called directly. */
  should(): this {
    return this
  }
  /**
   * Reads as English between two conditions (`.beComplete().andShould()…`) and
   * changes nothing — the builder is already in its condition phase.
   */
  andShould(): this {
    return this
  }

  /** Every key of the first side must have a match in the second (A ⊆ B). */
  beComplete(): this {
    const next = this.copy()
    next._checkComplete = true
    return next
  }
  /** Every key of the second side must have a source in the first (B ⊆ A). */
  haveNoOrphans(): this {
    const next = this.copy()
    next._checkNoOrphans = true
    return next
  }
  /** Both directions — the two key sets must be identical. */
  beBijective(): this {
    const next = this.copy()
    next._checkComplete = true
    next._checkNoOrphans = true
    return next
  }

  /**
   * Declare that a NAMED side is empty — plan 0097, replacing `allowEmpty()`.
   *
   * The difference is the whole point, and it is not a rename. `allowEmpty()`
   * PERMITTED a side to be empty and never spoke again: a permanent, silent
   * opt-out that stayed green the day the side filled up and the rule started
   * certifying nothing about it. This ASSERTS the side is empty, and fails the
   * day it stops being — an intent that expires and reports itself, which is
   * the property ADR-010 part 3 requires of every declaration. Plan 0069's
   * appendix rejected the permanent form for the rule family with receipts; a
   * sibling family had it shipped and documented.
   *
   * **The zero-argument form throws here**, and that is the correction of a
   * defect this method shipped with. The parameter has to be optional — a
   * required one is not a valid override of `TerminalBuilder`'s zero-arg
   * `expectEmpty()` — but the OVERRIDE VALIDITY argument justifies the
   * signature, not the semantics. Inheriting the base meaning gave
   * `crossProject().expectEmpty()` a whole-rule flag that suppressed the
   * empty-side finding for BOTH sides and that the expiry branch never read:
   * `allowEmpty` restored, permanent and silent, in fewer characters than
   * before, on the release that deleted it. Measured green over two populated
   * sides, forever.
   *
   * A correspondence compares two named sides, so "this rule is empty" has no
   * meaning that is not per-side. Refusing at build time is the same answer
   * this class already gives a contradiction, and it is loud where the
   * inherited semantics were silent.
   */
  override expectEmpty(side?: string): this {
    if (side === undefined) {
      throw new TypeError(
        'crossProject() declares emptiness per side: call .expectEmpty(sideName) for each side ' +
          'you expect to be empty. A correspondence compares two named sides, so a whole-rule ' +
          'declaration would suppress both and expire on neither.',
      )
    }
    const next = this.copy()
    next._expectEmptySides.add(side)
    return next
  }

  /**
   * Units this rule examined — plan 0096: the keys of both sides, summed.
   *
   * Zero means the comparison had nothing to compare, which for this family is
   * two empty sides. One empty side is already its own finding and is not this
   * question.
   */

  /**
   * This family counts keys — the keys of both sides, summed.
   *
   * Plan 0099: `CollectResult.examined` is unit-typed per family (ADR-009 part
   * 1), and the zero-examined message prints the noun. Inheriting the base
   * `'subjects'` is a category error in a sentence whose whole job is naming what
   * was and was not looked at.
   */
  protected override examinedUnitNoun(): string {
    return 'keys'
  }

  /**
   * How many units this rule actually examined — ADR-010's evidence that a pass
   * was constructed rather than defaulted.
   *
   * Both materialized sides, summed — zero until two sides are declared, which is itself the evidence that nothing was compared.
   */
  examinedUnits(): number {
    const [first, second] = this._sides
    // Zero is the honest answer for an under-declared correspondence: nothing was
    // compared, and ADR-010 wants that visible rather than defaulted away.
    if (first === undefined || second === undefined) return 0
    const [a, b] = materializeSides(this, first, second)
    return a.size + b.size
  }

  /**
   * Declared when EVERY side is — plan 0097.
   *
   * The base implementation reads the whole-rule flag, which this class refuses
   * to let anyone set. Without this override, 0098's floor would red a rule
   * whose every side the author declared, with a finding telling them to
   * declare. The per-side loop in `collectViolations` does not need this — its
   * membership test covers each side directly — which is exactly why the
   * previous private version was dead code and was removed. This one is for
   * the root, which asks the question about the rule rather than about a side.
   *
   * **This was recorded as unobservable-until-0098, and that equivalence EXPIRED**
   * the moment plan 0096 made `diagnose()` its first reader. Reverting this
   * override to the base body — which for this class can never be true, since the
   * zero-arg `expectEmpty()` throws — makes a rule whose every side is declared
   * report `zero-subjects` again, telling the author to declare what they
   * declared. A recorded equivalence is a claim with a lifetime, and this one's
   * ended one commit after it was written; it is guarded now.
   */
  override emptyDeclarationAdvice(): string {
    return '.expectEmpty(sideName) for each side'
  }

  /**
   * Whether the author declared this rule's empty result intentional.
   *
   * Overrides `TerminalBuilder`'s `.expectEmpty()` reading, because this builder
   * has more than one side and each can be declared empty independently.
   */
  override declaresEmpty(): boolean {
    return this._sides.length > 0 && this._sides.every((s) => this._expectEmptySides.has(s.name))
  }

  /** Fail if a side maps two distinct subjects to one key (over-normalization guard). */
  distinctKeysOn(sideName: string): this {
    const next = this.copy()
    next._distinctKeys.add(sideName)
    return next
  }

  /**
   * Wrong arity counts as asserting nothing, **whatever assertion was chosen**.
   *
   * `.beComplete()` on a one-sided correspondence cannot assert anything: there
   * is no second side to compare against, so the call is a claim about a
   * comparison that does not exist. Reading only the assertion flags let that
   * pair through the gate and into `collectViolations()`, where the arity check
   * throws a `RangeError` — and until bug 0025 that error escaped the CLI and
   * dropped every remaining rule file's findings.
   *
   * So the same fault now reports the same way whether or not an assertion was
   * chosen, and `assertionAdvice()` below already names the right remedy for it
   * (another `.side(...)`, never `.beComplete()`). The arity throw stays as an
   * invariant on `collectViolations()`, unreachable through the terminals.
   */
  override assertsSomething(): boolean {
    return this._sides.length === 2 && (this._checkComplete || this._checkNoOrphans)
  }

  /**
   * The remedy for this builder's assertion-less state, as one string.
   *
   * One channel, so `diagnose()`'s advice and the finding's own message cannot
   * disagree. Overrides `TerminalBuilder`'s generic text with wording specific to
   * what this builder is missing.
   */
  override assertionAdvice(): string {
    // Two distinct faults reach here, and naming the wrong one is the ADR-008
    // rule 2 defect this plan is partly about: with fewer than two sides the
    // fix is another `.side(...)`, not an assertion — adding `.beComplete()`
    // would leave the rule exactly as broken (measured in review).
    if (this._sides.length !== 2) {
      return (
        `this correspondence has ${String(this._sides.length)} side(s) and needs exactly two, ` +
        'so it compares nothing. Add the missing .side(name, ...) call.'
      )
    }
    return 'this correspondence asserts nothing: call .beComplete(), .haveNoOrphans(), or .beBijective().'
  }

  /** Named by id or by its sides, not 'unnamed' (plan 0070 §4). */
  override describeRule(): RuleDescription {
    const sides = this._sides.map((side) => side.name).join(' <-> ')
    return {
      ...super.describeRule(),
      rule: this._metadata?.id ?? (sides ? `correspondence [${sides}]` : 'correspondence'),
    }
  }

  /** What this rule declared, as a value the findings functions can read. */
  private declared(): Declared {
    return {
      sides: this._sides,
      distinctKeys: this._distinctKeys,
      expectEmptySides: this._expectEmptySides,
      checkComplete: this._checkComplete,
      checkNoOrphans: this._checkNoOrphans,
      metadata: this._metadata,
      reason: this._reason,
    }
  }

  /** Materialize both sides and pair their keys — the input every finding reads. */
  private pairingFor(sideA: Side, sideB: Side, meta: ViolationMeta): Pairing {
    const [aKeyed, bKeyed] = materializeSides(this, sideA, sideB)
    return {
      sideA,
      sideB,
      aKeyed,
      bKeyed,
      result: setCorrespondence(aKeyed.keys(), bKeyed.keys()),
      meta,
      declared: this.declared(),
    }
  }

  protected collectViolations(): CollectResult {
    const { sideA, sideB, meta } = resolveSides(this._sides, this._reason, this._metadata)

    const unbound = unboundDeclarationFindings(this.declared(), sideA, sideB)
    // A configuration fault: the sides were never materialized, so nothing was
    // examined. Plan 0098 — 0 here is the honest number, not a placeholder.
    if (unbound.length > 0) return { violations: unbound, examined: 0 }

    const pairing = this.pairingFor(sideA, sideB, meta)

    // Emptiness first: a side that resolved nothing makes every later question
    // vacuous, so its finding replaces them rather than joining them.
    const { emptyFindings, falseDeclarations } = emptinessFindings(pairing)
    if (emptyFindings.length > 0) {
      return {
        violations: [...emptyFindings, ...falseDeclarations],
        examined: this.examinedUnits(),
      }
    }

    return {
      violations: [
        ...falseDeclarations,
        ...matchFindings(pairing),
        ...duplicateKeyFindings(pairing),
      ],
      examined: this.examinedUnits(),
    }
  }
}

/**
 * Entry point: assert a correspondence between two independently-derived key
 * sets. Call `.side(...)` twice, then an assertion terminal.
 */
export function crossProject(p: ArchProject): CrossProjectBuilder {
  return new CrossProjectBuilder(p)
}

// --- keyFn vocabulary (the common cases; keyFn stays a raw escape hatch) ---

/** Key a subject by its name (`getName()`); anonymous subjects fall back to `<anonymous>`. */
export function byName<T extends { getName(): string | undefined }>(): KeyFn<T> {
  return (subject) => subject.getName() ?? '<anonymous>'
}

/**
 * Key a call-like subject by its argument at `index`. String/template literal
 * arguments are unquoted so keys match plain sides (e.g. `Object.keys(map)`) —
 * `app.get("/x", …)` keys as `/x`, not `"/x"`. Non-literal args key by raw text.
 */
export function byArg<T extends { getArguments(): { getText(): string }[] }>(
  index: number,
): KeyFn<T> {
  return (subject) => {
    const arg = subject.getArguments()[index]
    return arg ? unquote(arg.getText()) : '<no-arg>'
  }
}

/** Strip a single pair of matching surrounding quotes/backticks, if present. */
function unquote(text: string): string {
  const first = text[0]
  if (
    (first === '"' || first === "'" || first === '`') &&
    text.length >= 2 &&
    text.endsWith(first)
  ) {
    return text.slice(1, -1)
  }
  return text
}

/** Key a type-like subject by each of its property names (one subject → many keys). */
export function byPropertyNames<
  T extends { getProperties(): { getName(): string }[] },
>(): KeyFn<T> {
  return (subject) => subject.getProperties().map((property) => property.getName())
}
