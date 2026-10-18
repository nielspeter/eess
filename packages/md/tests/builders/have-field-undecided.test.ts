/**
 * ADR-021 (plan 0486) in eess-md: `haveField` as a free predicate declares what it cannot judge, and
 * every place eess-md applies predicates reports or refuses it. The lift onto boxes is written here
 * by hand, as a caller (or plan 0457's `inDocuments`) would, forwarding `undecided`.
 */
import { describe, it, expect } from 'vitest'
import {
  corpus,
  docs,
  taskItems,
  haveField,
  fields,
  not,
  and,
  type ArchViolation,
  type MdDocument,
  type Predicate,
} from '../../src/index.js'
import { tree } from '../helpers/tree.js'

const c = corpus({
  cwd: tree({
    'bugs/done.md': '# D\n\n**Status:** done\n\n- [ ] left open\n',
    'bugs/conflict.md':
      '# C\n\n**Status:** done\n**Status:** open\n\n- [ ] one\n- [ ] two\n- [ ] three\n',
    'bugs/tilde.md': '# T\n\n**Status:** done\n**Status:** open\n\n- [~] only an unread box\n',
    'bugs/live.md': '# L\n\n**Status:** open\n\n- [ ] live box\n',
    'README.md': '# R\n\n**Status:** a\n**Status:** b\n',
  }),
  roots: ['**/*.md'],
})
const done = haveField({ label: 'Status', forms: ['bold'], oneOf: /^done$/ })
const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${v.element}: ${v.message}${v.bypassFilters === true ? ' [bypass]' : ''}`)
/** A document predicate over anything that carries its document, forwarding `undecided`. */
const lift = <E extends { readonly doc: MdDocument }>(p: Predicate<MdDocument>): Predicate<E> => ({
  description: `in documents that ${p.description}`,
  test: (e) => p.test(e.doc),
  ...(p.undecided && { undecided: (e: E) => p.undecided?.(e.doc) ?? [] }),
})
const conflict =
  "bugs/conflict.md:3,4: Status is given twice (line 3 'done', line 4 'open'); keep one [bypass]"
const tilde =
  "bugs/tilde.md:3,4: Status is given twice (line 3 'done', line 4 'open'); keep one [bypass]"

describe('haveField as a predicate (ADR-021)', () => {
  it('block 12: done documents hold no open box; each unreadable Status reported once', () => {
    const found = taskItems(c)
      .that()
      .satisfy(lift(done))
      .and()
      .areOpen()
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual([
      'bugs/done.md:5: bugs/done.md:5 should not exist',
      conflict,
      tilde,
      'bugs/tilde.md [~]: `[~]` is not a box mark this rule was told about (1 box, line 6), so it is neither open nor done and no rule can judge it. [bypass]',
    ])
  })

  it('under not(), an undecided document is reported once and none of its boxes is asserted', () => {
    const found = taskItems(c)
      .that()
      .satisfy(not(lift(done)))
      .should()
      .notExist()
      .violations()
    expect(said(found).filter((s) => s.startsWith('bugs/conflict.md'))).toEqual([conflict])
    expect(found.examined).toBe(1)
  })

  it('a document another input decides is not reported', () => {
    const inBugs: Predicate<MdDocument> = {
      description: 'in bugs',
      test: (d) => d.relPath.startsWith('bugs/'),
    }
    const found = docs(c).that().satisfy(and(inBugs, done)).should().notExist().violations()
    expect(said(found).some((s) => s.startsWith('README.md'))).toBe(false)
  })

  it('.select() over an undecided document refuses, naming the cause', () => {
    const rule = docs(c).that().satisfy(done)
    expect(() => rule.select({ label: 'doc', identify: (d) => ({ name: d.relPath }) })).toThrow(
      /^select\(\) cannot answer.*Status is given twice/s,
    )
  })

  it('a hand wrapper around test() refuses, naming the cause', () => {
    const wrapped: Predicate<MdDocument> = { description: 'wrapped', test: (d) => done.test(d) }
    expect(() => docs(c).that().satisfy(wrapped).should().notExist().violations()).toThrow(
      /Status is given twice/,
    )
  })

  it('.excluding() naming the cause does not hide it', () => {
    const found = docs(c)
      .that()
      .satisfy(done)
      .should()
      .notExist()
      .excluding('bugs/conflict.md:3,4')
      .violations()
    expect(said(found)).toContain(conflict)
  })

  it('a document whose value resolves beside disagreeing prose is decided, and selected', () => {
    const one = corpus({
      cwd: tree({ 'b.md': '# B\n\nStatus: open\n\n**Status:** done\n' }),
      roots: ['**/*.md'],
    })
    const both = haveField({ label: 'Status', forms: ['bold', 'plain'], oneOf: /^done$/ })
    const found = docs(one).that().satisfy(both).should().notExist().violations()
    expect(said(found)).toEqual(['b.md: b.md should not exist'])
  })

  it('fields() over an undecided document reports the cause and keeps its own findings', () => {
    const own = corpus({
      cwd: tree({
        'bugs/x.md': '# X\n\n**Status:** done\n**Status:** open\n\n## Priority: high\n',
      }),
      roots: ['**/*.md'],
    })
    const lifted: Predicate<{ readonly doc: MdDocument }> = lift(done)
    const found = fields(own, { label: 'Priority', forms: ['bold'] })
      .that()
      .satisfy(lifted)
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual([
      "bugs/x.md:3,4: Status is given twice (line 3 'done', line 4 'open'); keep one [bypass]",
      "bugs/x.md:6: found `## Priority: high` at line 6, in a form this rule does not read (heading); add 'heading' to forms, or rewrite the line",
    ])
  })

  it('the verdict is memoized per document: asked twice, the same causes come back', () => {
    const [doc] = c.documents().filter((d) => d.relPath === 'bugs/conflict.md')
    expect(doc).toBeDefined()
    if (doc === undefined) return
    const first = done.undecided?.(doc)
    expect(first).toHaveLength(1)
    expect(done.undecided?.(doc)).toBe(first)
  })
})
