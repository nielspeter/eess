import type { Predicate, Undecided } from '@nielspeter/eess'
import { membership, partition, refuseUndecided, type Membership } from '@nielspeter/eess/internal'
import type { MdDocument } from '../model/document.js'

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

interface Scope {
  readonly inner: Predicate<MdDocument>
  readonly docMembership: (d: MdDocument) => Membership
}
/** The predicates `inDocuments` made, by identity, so a rule's diagnosis can name them. */
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
  SCOPES.set(lifted, { inner: p, docMembership: lifted.docMembership })
  return lifted
}

const decidedTrue = (m: Membership): boolean => m === true

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
    const names = dead.map((s) => `inDocuments(${s.inner.description})`).join(', ')
    const unjudged = documents.filter((d) =>
      dead.some((s) => {
        const m = s.docMembership(d)
        return m !== true && m !== false
      }),
    ).length
    const note = unjudged === 0 ? '' : ` (${String(unjudged)} could not be judged)`
    return (
      `${names} matched none of the corpus's ${String(n)} documents${note} — the document ` +
      `predicate is dead; fix it, or declare .expectEmpty() if no document is meant to match yet ` +
      `(the declaration lapses the first time this rule examines an element)`
    )
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
  const matched =
    scopes.length === 1
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
