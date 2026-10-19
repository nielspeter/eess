/**
 * Plan 0459: the kernel's one `beUniqueBy` condition, built by a dialect with its
 * own violation shape. Driven through a minimal `RuleBuilder` and its terminal.
 */
import { describe, it, expect } from 'vitest'
import { RuleBuilder, type ArchViolation } from '@nielspeter/eess'
import { uniqueByCondition } from '@nielspeter/eess/internal'

interface Widget {
  readonly name: string
  readonly key: string
  readonly file: string
  readonly line: number
}

class WidgetRules extends RuleBuilder<Widget, readonly Widget[]> {
  protected getElements(): Widget[] {
    return [...this.project]
  }
  named(re: RegExp): this {
    return this.addPredicate({ description: `named ${String(re)}`, test: (w) => re.test(w.name) })
  }
  beUniqueBy(key: (w: Widget) => string = (w) => w.key, why?: string): this {
    return this.addCondition(
      uniqueByCondition<Widget>({
        key,
        what: 'key',
        ...(why !== undefined && { why }),
        locate: (w) => ({ name: w.name, at: `${w.file}:${String(w.line)}` }),
        toViolation: (w, message, ctx): ArchViolation => ({
          rule: ctx.rule,
          ruleId: ctx.ruleId,
          element: w.name,
          file: w.file,
          line: w.line,
          message,
        }),
      }),
    )
  }
}

const w = (name: string, key: string, line = 1): Widget => ({
  name,
  key,
  file: `${name}.md`,
  line,
})

const run = (ws: readonly Widget[], why?: string): ArchViolation[] => [
  ...new WidgetRules(ws).should().beUniqueBy(undefined, why).violations(),
]

describe('uniqueByCondition (plan 0459)', () => {
  it('a group of three gives three findings, each naming the other two', () => {
    const found = run([w('a', 'x', 2), w('b', 'x', 3), w('c', 'x', 4), w('d', 'y')])
    expect(found.map((v) => [v.file, v.line, v.message])).toEqual([
      ['a.md', 2, 'a has the same key as 2 others: b.md:3, c.md:4'],
      ['b.md', 3, 'b has the same key as 2 others: a.md:2, c.md:4'],
      ['c.md', 4, 'c has the same key as 2 others: a.md:2, b.md:3'],
    ])
  })

  it('two distinct groups are reported separately', () => {
    const found = run([w('a', 'x'), w('b', 'y'), w('c', 'x'), w('d', 'y')])
    expect(found.map((v) => v.message)).toEqual([
      'a has the same key as 1 other: c.md:1',
      'c has the same key as 1 other: a.md:1',
      'b has the same key as 1 other: d.md:1',
      'd has the same key as 1 other: b.md:1',
    ])
  })

  it('all-distinct keys are green, every value examined', () => {
    const found = new WidgetRules([w('a', 'x'), w('b', 'y'), w('c', 'z')])
      .should()
      .beUniqueBy()
      .violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(3)
  })

  it('compares keys exactly: 066 and 0066 are distinct', () => {
    expect(run([w('a', '066'), w('b', '0066')])).toEqual([])
  })

  it('compares keys exactly: A and a are distinct', () => {
    expect(run([w('a', 'A'), w('b', 'a')])).toEqual([])
  })

  it('compares keys exactly: 7 and 7-space are distinct', () => {
    expect(run([w('a', '7'), w('b', '7 ')])).toEqual([])
  })

  it('one element is green, with examined 1', () => {
    const found = new WidgetRules([w('a', 'x')]).should().beUniqueBy().violations()
    expect([...found]).toEqual([])
    expect(found.examined).toBe(1)
  })

  it('zero elements is the kernel zero-examined finding, not a pass', () => {
    const found = new WidgetRules([w('a', 'x')])
      .that()
      .named(/^zzz/)
      .should()
      .beUniqueBy()
      .violations()
    expect(found.map((v) => [v.bypassFilters, v.message])).toEqual([
      [true, expect.stringContaining('examined zero units')],
    ])
  })

  it('a key that throws propagates rather than passing', () => {
    const rule = new WidgetRules([w('a', 'x')]).should().beUniqueBy(() => {
      throw new Error('no key here')
    })
    expect(() => rule.violations()).toThrow('no key here')
  })

  it('why is appended when given and absent when not', () => {
    const pair = [w('a', 'x'), w('b', 'x')]
    expect(run(pair, 'a citation is ambiguous')[0]?.message).toBe(
      'a has the same key as 1 other: b.md:1; a citation is ambiguous',
    )
    expect(run(pair)[0]?.message).toBe('a has the same key as 1 other: b.md:1')
  })

  it('a group of twelve lists ten other locations and 1 more in each of its twelve findings', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => w(`m${String(i)}`, 'same'))
    const found = run(twelve)
    expect(found).toHaveLength(12)
    for (const [i, v] of found.entries()) {
      expect(v.message).toMatch(/^m\d+ has the same key as 11 others: .* and 1 more$/)
      expect(v.message.match(/m\d+\.md:1/g)).toHaveLength(10)
      expect(v.message).not.toContain(`m${String(i)}.md:1,`)
    }
    expect(found[0]?.message).toBe(
      'm0 has the same key as 11 others: ' +
        Array.from({ length: 10 }, (_, i) => `m${String(i + 1)}.md:1`).join(', ') +
        ' and 1 more',
    )
  })

  it('the others are listed by location, whatever order the elements load in (bug 0526)', () => {
    const group = [
      w('c', 'x', 2),
      w('a', 'x', 10),
      w('b', 'x', 1),
      w('a', 'x', 9),
      w('d', 'y'),
      w('a10', 'x'),
      w('a2', 'x'),
    ]
    const messages = (ws: readonly Widget[]): string[] =>
      run(ws)
        .map((v) => v.message)
        .sort()
    const expected = messages(group)
    // Every rotation and the reverse: the same findings, each naming its others in one order.
    for (let k = 1; k < group.length; k++) {
      expect(messages([...group.slice(k), ...group.slice(0, k)])).toEqual(expected)
    }
    expect(messages([...group].reverse())).toEqual(expected)
    // A run of digits compares as a number, the rest by code unit: a.md:9 before a.md:10, a2.md
    // before a10.md, and a2.md before a.md, as its first run, 'a', is shorter than 'a.md:'.
    expect(expected).toContain(
      'b has the same key as 5 others: a2.md:1, a10.md:1, a.md:9, a.md:10, c.md:2',
    )
  })

  it('above ten others, the ten named are the first by location, not the first loaded (bug 0526)', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => w(`m${String(i)}`, 'same'))
    const forward = run(twelve).find((v) => v.element === 'm11')?.message
    const backward = run([...twelve].reverse()).find((v) => v.element === 'm11')?.message
    expect(backward).toBe(forward)
    expect(forward).toBe(
      'm11 has the same key as 11 others: ' +
        Array.from({ length: 10 }, (_, i) => `m${String(i)}.md:1`).join(', ') +
        ' and 1 more',
    )
  })

  it('the condition it returns is frozen', () => {
    const c = uniqueByCondition<Widget>({
      key: (x) => x.key,
      what: 'key',
      locate: (x) => ({ name: x.name, at: x.file }),
      toViolation: () => ({ rule: '', element: '', file: '', line: 0, message: '' }),
    })
    expect(Object.isFrozen(c)).toBe(true)
    expect(c.description).toBe('be unique by key')
  })
})
