import { describe, it, expect } from 'vitest'
import { diagram } from '../../src/core/diagram.js'
import { classes } from '../../src/builders/class-rule-builder.js'

/**
 * Bug 0374 — `extendName`, the `extend` condition and `notExtendStereotype` read one
 * relationship edge, so a class reaching the superclass through an intermediate one was
 * neither selected nor accepted. ADR-017 rule 6: one word means one thing across the
 * family, and in `eess-ts` it means an ancestor at any depth.
 *
 * Each chain is three levels, so a walk that climbs one edge, or two, goes red.
 */
const CHAIN = [
  'classDiagram',
  'class Base',
  '<<repository>> Base',
  'class Mid',
  'class Leaf',
  'class Deep',
  'class Unrelated',
  '<<service>> Leaf',
  '<<service>> Deep',
  '<<service>> Unrelated',
  'Base <|-- Mid',
  'Leaf --|> Mid',
  'Leaf <|-- Deep',
].join('\n')

function elements(result: readonly { element: string }[]): Set<string> {
  return new Set(result.map((v) => v.element))
}

describe('bug 0374: eess-mermaid heritage words walk the edges', () => {
  it('extendName() selects every descendant, in either arrow direction', () => {
    const selected = elements(
      classes(diagram(CHAIN))
        .that()
        .extendName('Base')
        .should()
        .notExist()
        .rule({ id: 'test/0374-select' })
        .violations(),
    )
    expect(selected).toEqual(new Set(['Mid', 'Leaf', 'Deep']))
  })

  it('extend() as a condition accepts a descendant at any depth', () => {
    const reported = elements(
      classes(diagram(CHAIN))
        .that()
        .haveStereotype('service')
        .should()
        .extend('Base')
        .rule({ id: 'test/0374-condition' })
        .violations(),
    )
    // Positive anchor: a class outside the hierarchy still reds.
    expect(reported).toEqual(new Set(['Unrelated']))
  })

  it('notExtendStereotype() reports a stereotyped ancestor at any depth', () => {
    const reported = classes(diagram(CHAIN))
      .that()
      .haveStereotype('service')
      .should()
      .notExtendStereotype('repository')
      .rule({ id: 'test/0374-stereotype' })
      .violations()
    // At depth the message names the path, since Deep has no edge to Base to go and find.
    expect(new Map(reported.map((v) => [v.element, v.message]))).toEqual(
      new Map([
        ['Leaf', 'Leaf extends Base (via Mid) which has stereotype <<repository>>'],
        ['Deep', 'Deep extends Base (via Leaf, Mid) which has stereotype <<repository>>'],
      ]),
    )
  })

  it('a realization edge is walked like an inheritance edge, as it was before the walk', () => {
    // The dialect has no implement(), and its bridge maps <|.. to an extends rule, so
    // dropping realization would silently narrow every selection that relies on it.
    const realized = diagram(
      [
        'classDiagram',
        'class Operation',
        'class Add',
        'class Checked',
        'class Audited',
        'class Other',
        'Operation <|.. Add',
        'Add <|-- Checked',
        'Audited ..|> Add',
      ].join('\n'),
    )
    const selected = elements(
      classes(realized)
        .that()
        .extendName('Operation')
        .should()
        .notExist()
        .rule({ id: 'test/0374-realization' })
        .violations(),
    )
    // All four arrows: <|.. and ..|> here, <|-- and --|> in CHAIN. Other is drawn and unrelated.
    expect(selected).toEqual(new Set(['Add', 'Checked', 'Audited']))
  })

  it('a realization edge mid-chain carries extend through it, as 0377 records', () => {
    // Pinned so 0377 has to change it on purpose: Leaf only realizes Mid, which extends Base,
    // and the dialect's extend accepts Leaf. eess-ts would red the equivalent class.
    const mixed = diagram(
      [
        'classDiagram',
        'class Base',
        'class Mid',
        'class Leaf',
        'class Stray',
        'Base <|-- Mid',
        'Mid <|.. Leaf',
      ].join('\n'),
    )
    const reported = elements(
      classes(mixed)
        .that()
        .haveNameMatching(/^(Leaf|Stray)$/)
        .should()
        .extend('Base')
        .rule({ id: 'test/0374-mixed' })
        .violations(),
    )
    // Positive anchor: Stray reaches nothing, so the condition still reds it.
    expect(reported).toEqual(new Set(['Stray']))
  })

  it('the path named is the shortest one, whichever edge is drawn first', () => {
    // The longer branch is drawn first, so a depth-first walk in source order would name it.
    const diamond = diagram(
      [
        'classDiagram',
        'class Base',
        '<<repository>> Base',
        'class A',
        'class B',
        'class X',
        'class Leaf',
        'Leaf --|> B',
        'B --|> X',
        'X --|> Base',
        'Leaf --|> A',
        'A --|> Base',
      ].join('\n'),
    )
    const reported = classes(diamond)
      .that()
      .haveNameMatching(/^Leaf$/)
      .should()
      .notExtendStereotype('repository')
      .rule({ id: 'test/0374-shortest' })
      .violations()
    expect(reported.map((v) => v.message)).toEqual([
      'Leaf extends Base (via A) which has stereotype <<repository>>',
    ])
  })

  it('an edge drawn twice reports once, and a stereotyped class on a cycle reports reaching itself', () => {
    const twice = diagram(
      [
        'classDiagram',
        'class Repo',
        '<<repository>> Repo',
        'class Svc',
        'Repo <|-- Svc',
        'Repo <|-- Svc',
        'class A',
        '<<repository>> A',
        'class B',
        'A <|-- B',
        'B <|-- A',
      ].join('\n'),
    )
    const reported = classes(twice)
      .that()
      .haveNameMatching(/^(Svc|A)$/)
      .should()
      .notExtendStereotype('repository')
      .rule({ id: 'test/0374-twice' })
      .violations()
    // A direct parent carries no path; a class on a cycle names the way round it.
    expect(reported.map((v) => v.message).sort()).toEqual([
      'A extends A (via B) which has stereotype <<repository>>',
      'Svc extends Repo which has stereotype <<repository>>',
    ])
  })

  it('a cycle in the diagram ends the walk', () => {
    const cyclic = diagram(
      ['classDiagram', 'class A', 'class B', 'class C', 'A <|-- B', 'B <|-- A', 'A <|-- C'].join(
        '\n',
      ),
    )
    const selected = (name: string) =>
      elements(
        classes(cyclic)
          .that()
          .extendName(name)
          .should()
          .notExist()
          .rule({ id: `test/0374-cycle-${name}` })
          .violations(),
      )
    expect(selected('Nowhere')).toEqual(new Set())
    // A diagram may draw a cycle; a class on it reaches itself, and the walk still ends.
    expect(selected('A')).toEqual(new Set(['A', 'B', 'C']))
  })
})
