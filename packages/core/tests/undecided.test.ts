/**
 * ADR-021 (plan 0486): a predicate that cannot judge a subject says so. Membership is strong Kleene,
 * decided once; an undecided subject is neither selected nor dropped silently; every door that hands
 * no findings back refuses.
 */
import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  RuleBuilder,
  and,
  not,
  or,
  type ArchViolation,
  type Predicate,
  type Undecided,
} from '@nielspeter/eess'
import { matchingElements, notExistCondition } from '@nielspeter/eess/internal'

interface Item {
  readonly name: string
  readonly folder: string
  /** `'?'` is a status no predicate can read. */
  readonly status: string
}

/** A status no one can read is undecided, with one cause per item. */
const statusIs = (wanted: string): Predicate<Item> => ({
  description: `have status ${wanted}`,
  undecided: (i) =>
    i.status === '?'
      ? [
          {
            file: `${i.name}.md`,
            line: 3,
            element: `${i.name}.md:3`,
            message: `${i.name}: status cannot be read`,
          },
        ]
      : [],
  test: (i) => {
    if (i.status === '?') throw new Error('test() called on an undecided subject')
    return i.status === wanted
  },
})
const inFolder = (folder: string): Predicate<Item> => ({
  description: `in ${folder}`,
  test: (i) => i.folder === folder,
})
const always: Predicate<Item> = { description: 'always', test: () => true }
const never: Predicate<Item> = { description: 'never', test: () => false }

class ItemRules extends RuleBuilder<Item, readonly Item[]> {
  protected getElements(): Item[] {
    return [...this.project]
  }
  notExist(): this {
    return this.addCondition(
      notExistCondition<Item>({
        name: (i) => i.name,
        toViolation: (i, message, ctx): ArchViolation => ({
          rule: ctx.rule,
          element: i.name,
          file: `${i.name}.md`,
          line: 1,
          message,
        }),
      }),
    )
  }
  beNamedA(): this {
    return this.addCondition({
      description: 'be named a',
      evaluate: (items, ctx) =>
        items
          .filter((i) => i.name !== 'a')
          .map((i) => ({
            rule: ctx.rule,
            element: i.name,
            file: `${i.name}.md`,
            line: 1,
            message: `${i.name} is not a`,
          })),
    })
  }
}

const done: Item = { name: 'done', folder: 'bugs', status: 'done' }
const open: Item = { name: 'open', folder: 'bugs', status: 'open' }
const unread: Item = { name: 'unread', folder: 'bugs', status: '?' }
const readme: Item = { name: 'readme', folder: 'root', status: '?' }
const said = (vs: readonly ArchViolation[]): string[] =>
  vs.map((v) => `${v.element}: ${v.message}${v.bypassFilters === true ? ' [bypass]' : ''}`)

describe('the truth table (ADR-021 clause 2)', () => {
  const u = statusIs('done')
  it('and(): a decided false input decides false; otherwise unknown wins', () => {
    expect(and(never, u).undecided?.(unread)).toEqual([])
    expect(and(never, u).test(unread)).toBe(false)
    expect(and(always, u).undecided?.(unread)).toHaveLength(1)
  })
  it('or(): a decided true input decides true; otherwise unknown wins', () => {
    expect(or(always, u).undecided?.(unread)).toEqual([])
    expect(or(always, u).test(unread)).toBe(true)
    expect(or(never, u).undecided?.(unread)).toHaveLength(1)
  })
  it('not(): unknown stays unknown', () => {
    expect(not(u).undecided?.(unread)).toHaveLength(1)
    expect(not(u).undecided?.(done)).toEqual([])
    expect(not(u).test(done)).toBe(false)
  })
  it('a combinator over predicates that cannot be undecided declares no undecided', () => {
    expect(and(always, never).undecided).toBeUndefined()
    expect(not(never).undecided).toBeUndefined()
  })
  it('the combinator cache answers an undefined element, as any other', () => {
    const maybe: Predicate<string | undefined> = {
      description: 'is set',
      undecided: (s) =>
        s === undefined ? [{ file: 'x', line: 1, element: 'x', message: 'unset' }] : [],
      test: (s) => s !== undefined,
    }
    const both = and(maybe, { description: 'any', test: () => true })
    expect(both.undecided?.(undefined)).toHaveLength(1)
    expect(both.undecided?.('a')).toEqual([])
  })
  it("a combinator's test() refuses a subject it cannot decide, naming the cause", () => {
    expect(() => and(always, u).test(unread)).toThrow(/unread: status cannot be read/)
  })
})

describe('a rule over an undecided subject (ADR-021 clauses 3, 5, 7)', () => {
  it('reports the cause once, unsuppressable, and selects only decided subjects', () => {
    const found = new ItemRules([done, open, unread])
      .that()
      .satisfy(not(statusIs('done')))
      .should()
      .beNamedA()
      .violations()
    expect(said(found)).toEqual([
      'open: open is not a',
      'unread.md:3: unread: status cannot be read [bypass]',
    ])
    expect(found.examined).toBe(1)
  })
  it('a subject another input decides is not reported', () => {
    const r = new ItemRules([done, readme])
      .that()
      .satisfy(and(inFolder('bugs'), statusIs('done')))
      .should()
      .notExist()
    expect(said(r.violations())).toEqual(['done: done should not exist'])
    const s = new ItemRules([unread])
      .that()
      .satisfy(or(always, statusIs('done')))
      .should()
      .notExist()
    expect(said(s.violations())).toEqual(['unread: unread should not exist'])
  })
  it('one cause shared by many subjects is one finding', () => {
    const twin: Item = { ...unread }
    const found = new ItemRules([unread, twin])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual(['unread.md:3: unread: status cannot be read [bypass]'])
    // Zero examined over an absence rule is a declaration only when nothing was undecided.
    expect(found.declaredEmpty).toBeUndefined()
    expect(found.undecided).toBe(1)
  })
  it('a more specific zero-examined finding still stands beside the causes', () => {
    const found = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .beNamedA()
      .expectNonEmpty()
      .violations()
    expect(said(found)[0]).toBe('unread.md:3: unread: status cannot be read [bypass]')
    expect(found).toHaveLength(2)
  })
  it('a rule with no assertion names the causes beside its own finding', () => {
    const found = new ItemRules([done, unread]).that().satisfy(statusIs('done')).violations()
    expect(said(found)).toContain('unread.md:3: unread: status cannot be read [bypass]')
    expect(found).toHaveLength(2)
  })
  it('a rule whose every subject is undecided reports the causes and no generic zero-examined finding', () => {
    const found = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .beNamedA()
      .violations()
    expect(said(found)).toEqual(['unread.md:3: unread: status cannot be read [bypass]'])
    expect(found.examined).toBe(0)
    expect(found.declaredEmpty).toBeUndefined()
  })
  it('an absence rule whose every subject is undecided is not green', () => {
    const found = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .notExist()
      .violations()
    expect(said(found)).toEqual(['unread.md:3: unread: status cannot be read [bypass]'])
    // Zero examined over an absence rule is a declaration only when nothing was undecided.
    expect(found.declaredEmpty).toBeUndefined()
  })
  it('.excluding() naming the cause does not hide it', () => {
    const found = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .notExist()
      .excluding('unread.md:3')
      .violations()
    expect(said(found)).toEqual(['unread.md:3: unread: status cannot be read [bypass]'])
  })
  it('a .warn() rule with an undecided subject still fails', () => {
    expect(() =>
      new ItemRules([unread]).that().satisfy(statusIs('done')).should().notExist().warn(),
    ).toThrow(/Architecture violation/)
  })
})

describe('a door that hands no findings back refuses (ADR-021 clause 6)', () => {
  it('matchingElements throws, naming the first cause', () => {
    expect(() => matchingElements([done, unread], [statusIs('done')], 'this caller')).toThrow(
      /unread: status cannot be read/,
    )
  })
  it('select() throws, naming the first cause', () => {
    const rule = new ItemRules([done, unread]).that().satisfy(statusIs('done'))
    expect(() => rule.select({ label: 'item', identify: (i) => ({ name: i.name }) })).toThrow(
      /unread: status cannot be read/,
    )
  })
  it('matchingElements over decided subjects is unchanged', () => {
    expect(matchingElements([done, open], [statusIs('done')], 'this caller')).toEqual([done])
  })
  it("select()'s refusal names select(), the door the caller used", () => {
    const rule = new ItemRules([unread]).that().satisfy(statusIs('done'))
    expect(() => rule.select({ label: 'item', identify: (i) => ({ name: i.name }) })).toThrow(
      /^select\(\) cannot answer/,
    )
  })
})

describe('a third-party predicate whose test() does not refuse (ADR-021 clause 6)', () => {
  /** Declares what it cannot judge, but answers `false` from `test` instead of refusing. */
  const lenient: Predicate<Item> = {
    description: 'lenient',
    undecided: statusIs('done').undecided,
    test: (i) => i.status === 'done',
  }
  it("not()'s test refuses rather than negating a guess", () => {
    expect(() => not(lenient).test(unread)).toThrow(/unread: status cannot be read/)
  })
  it('a hand wrapper around not().test in a rule refuses rather than selecting the subject', () => {
    const wrapped: Predicate<Item> = { description: 'wrapped', test: (i) => not(lenient).test(i) }
    expect(() =>
      new ItemRules([unread]).that().satisfy(wrapped).should().notExist().violations(),
    ).toThrow(/status cannot be read/)
  })
})

describe('the finding says what to do (ADR-021 clause 5)', () => {
  it('carries a remedy for the cause and the unsuppressable sentence, never the rule suggestion', () => {
    const [found] = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .notExist()
      .rule({ id: 'items/none-done', suggestion: 'Move the item to done/.' })
      .violations()
    expect(found?.suggestion).toMatch(/^Fix the cause the message names.*cannot be suppressed/s)
    expect(found?.suggestion).not.toMatch(/Move the item/)
  })
  it('two rules with different ids each report the cause (one per cause per rule)', () => {
    const a = new ItemRules([unread])
      .that()
      .satisfy(statusIs('done'))
      .should()
      .notExist()
      .rule({ id: 'a' })
    const b = new ItemRules([unread])
      .that()
      .satisfy(statusIs('open'))
      .should()
      .notExist()
      .rule({ id: 'b' })
    expect([...a.violations(), ...b.violations()].map((v) => v.ruleId)).toEqual(['a', 'b'])
  })
})

describe('the member (ADR-021 clause 1)', () => {
  it('takes the element only, and returns the causes', () => {
    type Member = NonNullable<Predicate<Item>['undecided']>
    expectTypeOf<Parameters<Member>>().toEqualTypeOf<[element: Item]>()
    expectTypeOf<ReturnType<Member>>().toEqualTypeOf<readonly Undecided[]>()
  })
})
