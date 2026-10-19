import type { Predicate, Undecided } from '@nielspeter/eess'
import { membership, partition, refuseUndecided, type Membership } from '@nielspeter/eess/internal'
import type { MdDocument } from '../model/document.js'
import { contains, sectionsOf, type MdSectionElement } from '../model/sections.js'
import { declaresSections, sectionDeclarationsOf } from '../model/section-declarations.js'

type HasDoc = { readonly doc: MdDocument }

/** A lifted predicate, with its verdict per document for the diagnosis. */
type Lifted<T> = Predicate<T> & { readonly docMembership: (d: MdDocument) => Membership }

/**
 * Package-internal: the lift, with the description the caller sees. Not a scope: `codeBlocks()`'
 * `resideInFile`/`resideInFolder` use it so their rule text stays the caller's own call.
 *
 * The verdict is memoized per document, in three values (ADR-021): a corpus document is built once
 * and never mutated, so it cannot go stale, and a `WeakMap` keyed on the object keeps two corpora
 * with the same `relPath` apart. `undecided` is declared only when `p` declares it, so a rule over a
 * two-valued scope keeps the kernel's two-valued path; when declared, `test` never asks `p.test` of a
 * document `p.undecided` reports, and refuses if it is called on one.
 */
export function liftToDocument<T extends HasDoc>(
  p: Predicate<MdDocument>,
  description: string,
): Lifted<T> {
  const memo = new WeakMap<MdDocument, Membership>()
  const docMembership = (doc: MdDocument): Membership => {
    const known = memo.get(doc)
    if (known !== undefined) return known
    const m = membership([p], 'all', doc)
    memo.set(doc, m)
    return m
  }
  const test = (element: T): boolean => {
    const m = docMembership(element.doc)
    if (m === true || m === false) return m
    refuseUndecided(m, 'test()')
    return false
  }
  const undecided = (element: T): readonly Undecided[] => {
    const m = docMembership(element.doc)
    return m === true || m === false ? [] : m
  }
  // `globs` and `originLabel` forwarded, so plan 0456's `cardinalitySelectorFault()` judges a folder
  // glob through the lift (through `not()`/`or()` too: the kernel walks them).
  return {
    description,
    test,
    docMembership,
    ...(p.undecided === undefined ? {} : { undecided }),
    ...(p.globs === undefined ? {} : { globs: p.globs }),
    ...(p.originLabel === undefined ? {} : { originLabel: p.originLabel }),
  }
}

/**
 * A scope a rule holds (`inDocuments` or `inSections`), by identity, so its diagnosis can name it:
 * what it is called, what it counts, and its verdict per document.
 */
interface Scope {
  /** `inDocuments(…)` or `inSections(…)`, as a finding names it. */
  readonly label: string
  readonly unit: 'documents' | 'sections'
  /** The document's verdict: decided true when the scope admits some element of it. */
  readonly docMembership: (d: MdDocument) => Membership
  /** The sections of the document the scope decides true (a section scope only). */
  readonly sectionsIn?: (d: MdDocument) => number
}
/** The predicates `inDocuments` and `inSections` made, by identity. */
const SCOPES = new WeakMap<object, Scope>()

/**
 * Lift a document predicate onto any element that carries its document:
 * `taskItems(c).that().satisfy(inDocuments(areLive()))`. A document the predicate cannot judge
 * (ADR-021) leaves its elements undecided, reported by the rule, never dropped.
 *
 * Compose inside the scope (`inDocuments(or(p, q))`), not around it: a positive rule names a scope
 * that matched no document only when the scope is one of its own predicates.
 */
export function inDocuments<T extends HasDoc>(p: Predicate<MdDocument>): Predicate<T> {
  const lifted = liftToDocument<T>(p, `are in documents that ${p.description}`)
  SCOPES.set(lifted, {
    label: `inDocuments(${p.description})`,
    unit: 'documents',
    docMembership: lifted.docMembership,
  })
  return lifted
}

type OnALine = { readonly doc: MdDocument; readonly line: number }

/** A section scope's verdicts, per section of one document, in `sectionsOf` order. */
interface SectionVerdicts {
  readonly sections: readonly MdSectionElement[]
  readonly verdicts: readonly Membership[]
}

/** The innermost section a section scope selected that contains `line`, for a finding's message. */
const ATTRIBUTION = new WeakMap<
  object,
  (doc: MdDocument, line: number) => MdSectionElement | undefined
>()

/**
 * Plan 0503 — lift a section predicate onto any element that sits on a line of its document
 * (boxes, links, pointers, rows, terms, fields): `taskItems(c).that().satisfy(inSections(
 * sectionsNamed('Acceptance criteria')))`. An element is in a section when the section contains its
 * line, from the heading line to its last line; "under" is any enclosing section, so a box under
 * `### Detail` inside `## Acceptance` is under both. Membership is strong Kleene over the enclosing
 * sections (ADR-021): selected when `p` holds for one, undecided when it holds for none and cannot
 * judge one, otherwise not selected.
 *
 * The section names `p` reads are recorded for the section-name scan when `p` is one of md's
 * section predicates itself; one wrapped in the kernel's `not()`, `and()` or `or()` is not seen,
 * since those keep no reference to their inputs (bug 0512). On a positive rule a scope that selects
 * no section is named; on `notExist()` it is green, as an absence rule over nothing is: guard it.
 */
export function inSections<T extends OnALine>(p: Predicate<MdSectionElement>): Predicate<T> {
  const memo = new WeakMap<MdDocument, SectionVerdicts>()
  const verdictsOf = (doc: MdDocument): SectionVerdicts => {
    const known = memo.get(doc)
    if (known !== undefined) return known
    const sections = sectionsOf(doc)
    const fresh = { sections, verdicts: sections.map((s) => membership([p], 'all', s)) }
    memo.set(doc, fresh)
    return fresh
  }
  // Strong Kleene `any` over the enclosing sections, decided once per element.
  const elementMembership = (e: T): Membership => {
    const { sections, verdicts } = verdictsOf(e.doc)
    const causes: Undecided[] = []
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i]
      if (s === undefined || !contains(s, e.line)) continue
      const m = verdicts[i]
      if (m === true) return true
      if (m !== undefined && m !== false) causes.push(...m)
    }
    return causes.length > 0 ? causes : false
  }
  const test = (e: T): boolean => {
    const m = elementMembership(e)
    if (m === true || m === false) return m
    refuseUndecided(m, 'test()')
    return false
  }
  const docMembership = (doc: MdDocument): Membership => {
    const { verdicts } = verdictsOf(doc)
    if (verdicts.some((m) => m === true)) return true
    const causes = verdicts.flatMap((m) => (m === true || m === false ? [] : m))
    return causes.length > 0 ? causes : false
  }
  const lifted: Predicate<T> = {
    description: `are in sections that ${p.description}`,
    test,
    ...(p.undecided === undefined
      ? {}
      : {
          undecided: (e: T): readonly Undecided[] => {
            const m = elementMembership(e)
            return m === true || m === false ? [] : m
          },
        }),
  }
  SCOPES.set(lifted, {
    label: `inSections(${p.description})`,
    unit: 'sections',
    docMembership,
    sectionsIn: (doc) => verdictsOf(doc).verdicts.filter((m) => m === true).length,
  })
  ATTRIBUTION.set(lifted, (doc, line) => {
    const { sections, verdicts } = verdictsOf(doc)
    let innermost: MdSectionElement | undefined
    sections.forEach((s, i) => {
      if (verdicts[i] === true && contains(s, line)) innermost = s
    })
    return innermost
  })
  return declaresSections(lifted, sectionDeclarationsOf([p]))
}

/**
 * The innermost section a rule's section scopes selected that contains `line` of `doc`, or
 * `undefined` when the rule holds no section scope (plan 0503: a finding names its section).
 */
export function attributedSection<E>(
  predicates: readonly Predicate<E>[],
  doc: MdDocument,
  line: number,
): MdSectionElement | undefined {
  let found: MdSectionElement | undefined
  for (const p of predicates) {
    const s = ATTRIBUTION.get(p)?.(doc, line)
    if (s !== undefined && (found === undefined || s.line > found.line)) found = s
  }
  return found
}

/** Whether the rule holds a section scope among its own predicates. */
export function holdsSectionScope<E>(predicates: readonly Predicate<E>[]): boolean {
  return predicates.some((p) => ATTRIBUTION.has(p))
}

const decidedTrue = (m: Membership): boolean => m === true

/**
 * The documents a rule's document scopes admit: those every `inDocuments` scope among its own
 * predicates decides true; every document when it has none (plan 0496's section-name scan).
 */
export function admittedDocuments<T>(
  predicates: readonly Predicate<T>[],
  documents: readonly MdDocument[],
): readonly MdDocument[] {
  const scopes = predicates.flatMap((p) => {
    const s = SCOPES.get(p)
    return s === undefined || s.unit !== 'documents' ? [] : [s]
  })
  if (scopes.length === 0) return documents
  return documents.filter((d) => scopes.every((s) => decidedTrue(s.docMembership(d))))
}

/**
 * For a positive rule that examined nothing: every scope that matched no document, by name; else,
 * when the rest of the rule selected something, that the scopes emptied it. `undefined` when the rule
 * has no scope, or when a predicate other than a scope emptied the selection, so the kernel's
 * generic finding speaks. The kernel asks only when no subject was undecided (ADR-021).
 *
 * `elements` is a thunk: the kernel asks for this diagnosis on every rule that examined nothing,
 * absence rules included, and a rule with no scope must not pay for a second extraction (PR #245).
 */
export function scopeDiagnosis<T>(
  predicates: readonly Predicate<T>[],
  elements: () => readonly T[],
  documents: readonly MdDocument[],
  noun: string,
): string | undefined {
  const scopes = predicates.flatMap((p) => {
    const s = SCOPES.get(p)
    return s === undefined ? [] : [s]
  })
  if (scopes.length === 0) return undefined
  const n = documents.length
  // 1. Every dead scope is named, not only the first. A document a scope cannot judge is not a
  //    match, and the message says how many there were.
  const dead = scopes.filter((s) => !documents.some((d) => decidedTrue(s.docMembership(d))))
  if (dead.length > 0) {
    const unjudged = documents.filter((d) =>
      dead.some((s) => {
        const m = s.docMembership(d)
        return m !== true && m !== false
      }),
    ).length
    const note = unjudged === 0 ? '' : ` (${String(unjudged)} could not be judged)`
    const lapse =
      'declare .expectEmpty() if no document is meant to match yet (the declaration lapses the ' +
      'first time this rule examines an element)'
    const deadDocs = dead.filter((s) => s.unit === 'documents')
    const deadSections = dead.filter((s) => s.unit === 'sections')
    const parts: string[] = []
    if (deadDocs.length > 0) {
      parts.push(
        `${deadDocs.map((s) => s.label).join(', ')} matched none of the corpus's ${String(n)} ` +
          `documents${note} — the document predicate is dead; fix it, or ${lapse}`,
      )
    }
    if (deadSections.length > 0) {
      const total = documents.reduce((k, d) => k + sectionsOf(d).length, 0)
      parts.push(
        `${deadSections.map((s) => s.label).join(', ')} selected none of the corpus's ` +
          `${String(total)} sections in ${String(n)} documents${deadDocs.length > 0 ? '' : note} — ` +
          `the section predicate is dead; fix it, or ${lapse.replace('no document', 'no section')}`,
      )
    }
    return parts.join('; ')
  }
  // 2. Blame the scopes only if the rest of the rule selected something: the kernel's one owner of
  //    "apply a rule's predicates", where a subject the rest cannot judge is not counted.
  const before = partition(
    elements(),
    predicates.filter((p) => !SCOPES.has(p)),
  ).elements.length
  if (before === 0) return undefined
  const k = documents.filter((d) => scopes.every((s) => decidedTrue(s.docMembership(d)))).length
  const selected = `${String(before)} ${noun} the rest of this rule selects`
  const [only] = scopes
  const matched =
    scopes.length === 1 && only?.sectionsIn !== undefined
      ? `the section scope selected ${String(documents.reduce((t, d) => t + (only.sectionsIn?.(d) ?? 0), 0))} ` +
        `sections in ${String(k)} of ${String(n)} documents, and they hold none of the ${selected}`
      : scopes.length === 1
        ? `the scope matched ${String(k)} of ${String(n)} documents, and they hold none of the ${selected}`
        : k === 0
          ? `no document matches every scope (each matches some of the corpus's ${String(n)}), so ` +
            `none of the ${selected} is in scope`
          : `the scopes together matched ${String(k)} of ${String(n)} documents, and they hold none ` +
            `of the ${selected}`
  return (
    `${matched} — declare .expectEmpty() if that is expected (the declaration lapses the first ` +
    `time this rule examines an element)`
  )
}
