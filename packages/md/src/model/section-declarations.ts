import type { ArchViolation } from './violation.js'

/** A section name a rule reads, and the depth it reads it at, kept for the section-name scan. */
export interface SectionDeclaration {
  readonly name: string | RegExp
  readonly depth?: number
}

/** One key per distinct declaration, so a name declared twice is scanned once. */
function sectionDeclarationKey(d: SectionDeclaration): string {
  const name = typeof d.name === 'string' ? `s:${d.name}` : `re:${String(d.name)}`
  return d.depth === undefined ? name : `${name}@${String(d.depth)}`
}

/**
 * The section names each predicate or condition reads, by identity (plan 0496): one registry, as
 * plan 0457's scope registry keys scopes. A builder method or a registered factory records here; the
 * rule reads it back from its own predicates and conditions when it collects, so a name is recorded
 * wherever the rule holds the object, in either phase.
 */
const REGISTRY = new WeakMap<object, readonly SectionDeclaration[]>()

/** Record that `x` reads these section names; returns `x`. */
export function declaresSections<X extends object>(
  x: X,
  declarations: readonly SectionDeclaration[],
): X {
  REGISTRY.set(x, [...(REGISTRY.get(x) ?? []), ...declarations])
  return x
}

/** Whether `x` was registered as reading a section name. */
export function readsSections(x: object): boolean {
  return REGISTRY.has(x)
}

/** The distinct section names the predicates and conditions read (and `extra`), in order. */
export function sectionDeclarationsOf(
  items: readonly object[],
  extra: readonly SectionDeclaration[] = [],
): SectionDeclaration[] {
  const out: SectionDeclaration[] = []
  const seen = new Set<string>()
  for (const declared of [...items.map((item) => REGISTRY.get(item) ?? []), extra]) {
    for (const d of declared) {
      const key = sectionDeclarationKey(d)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(d)
    }
  }
  return out
}

/**
 * The headings a condition's finding already names (ADR-009 rule 2: one finding per cause), by the
 * finding's identity, so the scan can skip them without reading a message.
 */
const CITED = new WeakMap<ArchViolation, readonly number[]>()

/** Record that `violation` names the headings at these lines of its file; returns it. */
export function citesHeadings(violation: ArchViolation, lines: readonly number[]): ArchViolation {
  if (lines.length > 0) CITED.set(violation, lines)
  return violation
}

/** Every `file:line` the findings name as a heading's cause. */
export function citedHeadings(violations: readonly ArchViolation[]): ReadonlySet<string> {
  const out = new Set<string>()
  for (const v of violations) {
    for (const line of CITED.get(v) ?? []) out.add(`${v.file}:${String(line)}`)
  }
  return out
}
