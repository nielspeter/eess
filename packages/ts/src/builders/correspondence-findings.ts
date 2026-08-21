import { Node } from 'ts-morph'
import type { ArchViolation } from '@nielspeter/eess'
import { getElementName, getElementFile, getElementLine } from '../core/violation.js'
import type { Declared, Pairing, Side } from './correspondence-builder.js'
import { sidesOf } from './correspondence-builder.js'

/**
 * How a crossProject finding is shaped.
 *
 * Split from the builder because constructing a violation is not deciding one is
 * warranted. Every factory here is a free function over its inputs — the only
 * builder state any of them read was the rule metadata, which now arrives as an
 * argument.
 */

interface NodeBearer {
  getNode(): Node
}

function isNodeBearer(value: unknown): value is NodeBearer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getNode' in value &&
    typeof value.getNode === 'function'
  )
}

export interface ViolationMeta {
  readonly rule: string
  readonly because?: string
  readonly ruleId?: string
  readonly suggestion?: string
  readonly docs?: string
}

/** Resolve a subject to a ts-morph node for file:line, or undefined if it carries none. */
function toNode(subject: unknown): Node | undefined {
  if (Node.isNode(subject)) return subject
  if (isNodeBearer(subject)) {
    const node = subject.getNode()
    if (Node.isNode(node)) return node
  }
  return undefined
}

function keyViolations(
  keyed: Map<string, unknown[]>,
  key: string,
  message: string,
  meta: ViolationMeta,
): ArchViolation[] {
  const subjects = keyed.get(key) ?? []
  if (subjects.length === 0) {
    // Plain-key side — no source location available.
    return [baseViolation({ element: key, file: '', line: 0 }, message, meta)]
  }
  return subjects.map((subject) => {
    const node = toNode(subject)
    if (node) {
      return baseViolation(
        {
          element: getElementName(node),
          file: getElementFile(node),
          line: getElementLine(node),
        },
        message,
        meta,
      )
    }
    return baseViolation({ element: key, file: '', line: 0 }, message, meta)
  })
}

/**
 * A declaration names a side this rule does not have — plan 0097.
 *
 * Covers `.expectEmpty(name)` and `.distinctKeysOn(name)` alike, because both
 * are membership tests against side names and both were silent on a typo. The
 * remedy is mechanical and names the sides that DO exist, so the reader does
 * not have to go and look.
 */
function unboundSideViolation(
  name: string,
  actual: readonly string[],
  metadata: { id?: string } | undefined,
  reason: string | undefined,
): ArchViolation {
  const known = actual.map((s) => `'${s}'`).join(' and ')
  return {
    ...baseViolation(
      { element: name, file: '', line: 0 },
      `this rule declares something about a side named '${name}', but its sides are ${known} — ` +
        `so the declaration binds to nothing and asserts nothing.`,
      {
        rule: `crossProject [${actual.join(' <-> ')}]`,
        because: reason,
        ruleId: metadata?.id,
      },
    ),
    suggestion: `Correct the side name to one of ${known}, or remove the declaration.`,
    docs: undefined,
    bypassFilters: true,
  }
}

/**
 * The declared side filled up — plan 0097.
 *
 * This finding is why `.expectEmpty(side)` replaced `allowEmpty(side)`: the
 * permission had no failing state, so a side that gained keys silently kept a
 * rule green that was certifying nothing about them. An assertion that expires
 * reports itself; a permission never does.
 *
 * Its remedy is mechanical and is the one ADR-009 rule 2 asks be verified:
 * remove the declaration, and the finding clears.
 */
function unexpectedlyNonEmptyViolation(sideName: string, meta: ViolationMeta): ArchViolation {
  return {
    ...baseViolation(
      { element: sideName, file: '', line: 0 },
      `crossProject side '${sideName}' was declared empty with .expectEmpty('${sideName}'), ` +
        `and now matches subjects — so the declaration no longer describes this rule.`,
      meta,
    ),
    suggestion:
      `Remove .expectEmpty('${sideName}') so the side is compared like any other, or narrow ` +
      `the '${sideName}' selector if it was meant to stay empty.`,
    docs: undefined,
    bypassFilters: true,
  }
}

function emptyViolation(sideName: string, meta: ViolationMeta): ArchViolation {
  return {
    ...baseViolation(
      { element: sideName, file: '', line: 0 },
      `crossProject side '${sideName}' matched 0 subjects — a pairing over an ` +
        `empty side certifies nothing. Fix the selector, or call .expectEmpty('${sideName}') ` +
        `if an empty side is valid here.`,
      meta,
    ),
    // Its own remedy, overriding what `baseViolation` copied from the rule's
    // metadata (bug 0021). `baseViolation` is shared with real violations, where
    // inheriting the author's `suggestion` is correct — so the override has to be
    // here, and the guard in `execute-rule.ts` cannot reach it.
    suggestion:
      `Fix the '${sideName}' selector so it matches at least one subject, or call ` +
      `.expectEmpty('${sideName}') if an empty side is the point — that asserts it, and fails the day the side fills up.`,
    docs: undefined,
    // Config-level meta-finding: no source file to attribute to, so it must
    // survive diff-aware/baseline or the guard re-greens under standard CI.
    bypassFilters: true,
  }
}

/**
 * The common shape of every crossProject finding.
 *
 * `element`/`file`/`line` travel together as one `at` — they are a location,
 * and passing three positional strings-and-a-number invited exactly the
 * transposition the parameter cap exists to prevent.
 */
function baseViolation(
  at: { element: string; file: string; line: number },
  message: string,
  meta: ViolationMeta,
): ArchViolation {
  const { element, file, line } = at
  return {
    rule: meta.rule,
    ruleId: meta.ruleId,
    element,
    file,
    line,
    message,
    because: meta.because,
    suggestion: meta.suggestion,
    docs: meta.docs,
  }
}

/**
 * Declarations — `.expectEmpty(name)` / `.withDistinctKeys(name)` — that name a
 * side this crossProject does not have.
 *
 * A declaration that binds to no side is a configuration finding, not a no-op
 * (plan 0097, correcting the same defect the shipped version had).
 * `.expectEmpty('servcies')` was accepted silently and asserted nothing
 * forever: the exact hazard this class's own docstring rejects the permanent
 * form for ("one word, silent forever, TYPO OR NOT, and nothing revisits it"),
 * inherited whole by the replacement.
 *
 * ADR-010 part 3 already ruled the structurally identical preset case — a
 * declaration binding to no constructed rule is a FAILING finding, never a
 * warning — so this follows settled precedent rather than deciding anew.
 *
 * Here rather than in the setter: `.expectEmpty(name)` may legally precede
 * `.side(name, …)`, so the setter cannot know yet.
 *
 * A Set, not a concatenation: a name in BOTH sets produced two findings with
 * identical element, message, file and line — the identity shape bugs 0064,
 * 0065 and 0067 were filed for. And membership is tested against the side LIST
 * rather than two name comparisons, so it cannot rot if arity ever changes.
 */
export function unboundDeclarationFindings(
  declared: Declared,
  sideA: Side,
  sideB: Side,
): ArchViolation[] {
  const declaredNames = new Set([...declared.expectEmptySides, ...declared.distinctKeys])
  return [...declaredNames]
    .filter((n) => !declared.sides.some((side) => side.name === n))
    .map((name) =>
      unboundSideViolation(name, [sideA.name, sideB.name], declared.metadata, declared.reason),
    )
}

/**
 * Findings about each side being empty, and about a declaration that says so
 * while the side is not.
 */
export function emptinessFindings(p: Pairing): {
  emptyFindings: ArchViolation[]
  falseDeclarations: ArchViolation[]
} {
  const { sideA, sideB, result, meta, declared } = p
  const emptyFindings: ArchViolation[] = []
  const falseDeclarations: ArchViolation[] = []
  for (const [side, isEmpty] of [
    [sideA, result.aEmpty],
    [sideB, result.bEmpty],
  ] as const) {
    // Per-side only. A `declaresEmpty()` helper stood here with an
    // `_expectEmpty || every(side => declared)` body; the `every` half was
    // unreachable — if every side is in the set then `has(side.name)` is
    // already true for the side under test — and three reviewers deleted it
    // against the full suite with nothing failing. Its stated rationale
    // ("without the OR a user who declared both sides still redded") was a
    // property the code never had.
    const sideDeclared = declared.expectEmptySides.has(side.name)
    if (isEmpty && !sideDeclared) {
      emptyFindings.push(emptyViolation(side.name, meta))
    }
    // The expiry half, and the reason this is an assertion rather than a
    // permission: a declared-empty side that filled up is the intent
    // reporting itself, where `allowEmpty()` stayed silent forever.
    if (!isEmpty && declared.expectEmptySides.has(side.name)) {
      falseDeclarations.push(unexpectedlyNonEmptyViolation(side.name, meta))
    }
  }
  return { emptyFindings, falseDeclarations }
}

/**
 * Findings from the pairing itself — keys on one side with no partner
 * on the other, in whichever directions the rule asked about.
 */
export function matchFindings(p: Pairing): ArchViolation[] {
  const { sideA, sideB, aKeyed, bKeyed, result, meta, declared } = p
  const violations: ArchViolation[] = []

  if (declared.checkComplete) {
    for (const key of result.missing) {
      violations.push(
        ...keyViolations(aKeyed, key, `${sideA.name} "${key}" has no matching ${sideB.name}`, meta),
      )
    }
  }
  if (declared.checkNoOrphans) {
    for (const key of result.orphans) {
      violations.push(
        ...keyViolations(bKeyed, key, `${sideB.name} "${key}" has no matching ${sideA.name}`, meta),
      )
    }
  }

  // Over-normalization guard (opt-in): one key from many subjects can mask a
  // real "two subjects, one counterpart" mismatch.
  return violations
}

/**
 * Findings for a side whose key function maps several distinct subjects onto
 * one key — over-normalization can mask a real mismatch.
 */
export function duplicateKeyFindings(p: Pairing): ArchViolation[] {
  const { sideA, sideB, aKeyed, bKeyed, meta, declared } = p
  const violations: ArchViolation[] = []
  for (const side of [sideA, sideB] as const) {
    if (!declared.distinctKeys.has(side.name)) continue
    const keyed = side === sideA ? aKeyed : bKeyed
    for (const [key, subjects] of keyed) {
      if (subjects.length > 1) {
        violations.push(
          ...keyViolations(
            keyed,
            key,
            `${side.name} maps ${String(subjects.length)} distinct subjects to the key "${key}" — over-normalization can mask a real mismatch`,
            meta,
          ),
        )
      }
    }
  }

  // NOTE: independence of the two sides is a *requirement* stated in the docs,
  // not something the builder can mechanically enforce — two literal lists can
  // be legitimately independent (e.g. Object.keys of two different runtime
  // objects), so a "both sides literal" heuristic would false-positive, and a
  // console.warn is invisible to the agent consumer (ADR-008). Left to review.

  // The false declaration FIRST — it says the configuration is wrong, which the
  // reader needs before the findings produced under it, matching the ordering
  // `RuleBuilder.evaluate` and the preset config findings already use.
  return violations
}

/**
 * Run the pairing and collect its findings, in four phases:
 * unbound declarations, emptiness, the match itself, then duplicate keys.
 *
 * ## The arity throw is an invariant, not an error path
 *
 * Unreachable through `.check()` / `.warn()` / `.violations()` as of the
 * bug-0025 fix: `assertsSomething()` is false for wrong arity, so the gate
 * reports it as a configuration finding before this method is called. Kept as
 * the invariant it always was — this method indexes `_sides[0]` and
 * `_sides[1]` below, and a direct subclass caller deserves the named error
 * rather than an undefined read. Do not treat it as the answer to "what
 * happens with the wrong number of sides": the loud answer is the gate, and if
 * this ever throws again through a terminal, the gate is gone.
 *
 * There is deliberately NO missing-assertion throw: the gate reports that as a
 * configuration finding before this runs (bug 0019), which is why the gate sits
 * ahead of this method — a `RangeError` from here escaped the CLI's
 * `ArchRuleError`-only catch and dropped every remaining rule file. The
 * sides-count check stays, because wrong arity is a different fault from a
 * missing assertion and its remedy is another `.side(...)`.
 */
/**
 * The two sides and the metadata every finding from them carries.
 *
 * Extracted so `collectViolations` reads as the decision sequence it is —
 * unbound, then emptiness, then matching — rather than opening with a guard
 * and a literal. The arity check lives here because it is the precondition
 * for the metadata: the rule name is built from both side names.
 */
export function resolveSides(
  sides: readonly Side[],
  reason: string | undefined,
  metadata: { id?: string; suggestion?: string; docs?: string } | undefined,
): { sideA: Side; sideB: Side; meta: ViolationMeta } {
  const [sideA, sideB] = sides
  if (sides.length !== 2 || sideA === undefined || sideB === undefined) {
    throw new RangeError(
      `crossProject() requires exactly two .side(...) calls; got ${String(sides.length)}.`,
    )
  }
  return {
    sideA,
    sideB,
    meta: {
      rule: `crossProject [${sideA.name} <-> ${sideB.name}]`,
      because: reason,
      ruleId: metadata?.id,
      suggestion: metadata?.suggestion,
      docs: metadata?.docs,
    },
  }
}

/**
 * Both sides, materialized once — plan 0096, and the ONE method both readers
 * call.
 *
 * CrossProject has no corpus of its own: its sides ARE its input, so the
 * examined unit is their keys and the "selection" is the materialization
 * itself. Sharing it matters more here than anywhere else, because
 * `Side.materialize` is a bare closure over a user-supplied `keyFn` and a full
 * rule selection — so a second derivation would re-run arbitrary user code,
 * and `diagnose()` calling the accessor before `check()` would pay for the
 * whole thing twice.
 */
export function materializeSides(
  owner: object,
  a: Side,
  b: Side,
): [Map<string, unknown[]>, Map<string, unknown[]>] {
  // Narrowed, not asserted (ADR-005). A `?? new Map()` fallback would be worse
  // than the `!` this replaced — the compute always returns two entries, so the
  // fallback could never fire, and a branch that cannot fire is the shape this
  // whole programme is about even when it is only types. Throwing says the same
  // thing without lying about it.
  const pair = sidesOf(owner, () => [a.materialize(), b.materialize()])
  const [first, second] = pair
  if (first === undefined || second === undefined) {
    throw new RangeError(
      `crossProject(): the memoized side pair held ${String(pair.length)} entries, not 2.`,
    )
  }
  return [first, second]
}
