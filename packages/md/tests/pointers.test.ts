import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, pointers } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')

describe('pointers()', () => {
  it('resolve() flags broken, stale and ambiguous live pointers, not ok/fenced', () => {
    const c = corpus({ roots: ['docs/pointers.md'], cwd: fixtureRoot })
    const v = pointers(c).that().areLive().should().resolve().violations()
    const messages = v.map((x) => x.message).join('\n')

    // Three classes, each asserted by its own message rather than by a count:
    // a version that emitted three copies of one class would satisfy a bare
    // `toHaveLength(3)`.
    //
    // `dup.ts` moved from the not-flagged list to here in bug 0254 — it used to
    // be skipped silently while still counting toward the caller's denominator.
    expect(v).toHaveLength(3)
    expect(messages).toMatch(/broken code pointer.*missing\.ts/s)
    expect(messages).toMatch(/stale code pointer.*app\.ts.*line 99/s)
    expect(messages).toMatch(/ambiguous code pointer.*dup\.ts/s)

    // Still NOT flagged: ok full path, ok bare basename, fenced. These are the
    // assertions that keep the fix from being "flag everything" — without them
    // a condition that violated on every pointer would pass the three above.
    expect(messages).not.toMatch(/:3\b/) // ok full path
    expect(messages).not.toMatch(/`app\.ts:2`/) // ok bare basename
    expect(messages).not.toMatch(/:1000/) // fenced → ignored
  })

  it('areLive excludes frozen docs; areFrozen includes only them', () => {
    const c = corpus({ roots: ['docs/pointers.md', 'docs/completed/old.md'], cwd: fixtureRoot })

    const live = pointers(c).that().areLive().should().resolve().violations()
    expect(live.some((x) => x.message.includes('gone.ts'))).toBe(false) // frozen, excluded

    const frozen = pointers(c).that().areFrozen().should().resolve().violations()
    expect(frozen).toHaveLength(1)
    expect(frozen[0]?.message).toMatch(/gone\.ts/)
  })

  it('a bare basename resolves when unique', () => {
    const c = corpus({ roots: ['docs/pointers.md'], cwd: fixtureRoot })
    const v = pointers(c).that().areLive().should().resolve().violations()
    // `app.ts:2` is a unique bare basename → resolves to src/app.ts, line 2 in range → no violation
    expect(v.some((x) => x.element.includes('app.ts:2'))).toBe(false)
  })
})

// Unique path-suffix resolution (plan 0064): a partial path resolves to the one
// file ending with it — bare basename is just the single-segment case.
describe('pointers() — path-suffix resolution', () => {
  const suffixRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/suffix')
  const c = () => corpus({ roots: ['doc.md'], cwd: suffixRoot })

  it('resolves a unique partial path; the ambiguous and the missing both report', () => {
    const v = pointers(c()).that().areLive().should().resolve().violations()
    // admin/index.vue → app/pages/admin/index.vue (unique suffix) resolves.
    // dup/x.ts → a/dup/x.ts AND b/dup/x.ts → ambiguous, reported (bug 0254).
    // ghost/missing.ts → nothing ends with it → broken.
    //
    // Asserted as a set of classes, so a regression that reported the ambiguous
    // one AS broken — losing the candidate list and the remedy with it — fails
    // here rather than passing on the count.
    expect(v).toHaveLength(2)
    const messages = v.map((x) => x.message)
    expect(messages.filter((m) => /^broken/.test(m))).toHaveLength(1)
    expect(messages.filter((m) => /^ambiguous/.test(m))).toHaveLength(1)
    expect(messages.join('\n')).toMatch(/broken.*ghost\/missing\.ts/s)
  })

  it('an ambiguous suffix is a violation naming every candidate (bug 0254)', () => {
    const v = pointers(c()).that().areLive().should().resolve().violations()
    const ambiguous = v.filter((x) => x.message.includes('ambiguous'))
    expect(ambiguous).toHaveLength(1)

    // The candidates by name, not a count of them: a message saying "2 files"
    // and nothing else leaves the author with the same problem they started
    // with, and would satisfy a bare length assertion.
    expect(ambiguous[0]?.message).toMatch(/a\/dup\/x\.ts/)
    expect(ambiguous[0]?.message).toMatch(/b\/dup\/x\.ts/)
    expect(ambiguous[0]?.message).toMatch(/dup\/x\.ts:2/)
  })

  it('the ambiguous violation carries the remedy, and no autofix', () => {
    const v = pointers(c()).that().areLive().should().resolve().violations()
    const ambiguous = v.find((x) => x.message.includes('ambiguous'))

    // ADR-009: the failure surface is the instruction. The remedy rides in the
    // message rather than `because`, because `because` is rule-level and the
    // caller's to set (ADR-008) — one rule covers broken, stale AND ambiguous,
    // which need different remedies. The message is the per-violation field.
    expect(ambiguous?.message).toMatch(/longer suffix/)

    // No autofix: the whole point is that the repair is NOT deterministic.
    // A fix here would rewrite the pointer to whichever candidate sorted first.
    expect(ambiguous?.fix).toBeUndefined()
  })

  it('CONTROL — the unique suffix still resolves, so this is not "flag everything"', () => {
    // Without this, a change that violated on every suffix match would satisfy
    // both tests above. `admin/index.vue` has exactly one candidate.
    const v = pointers(c()).that().areLive().should().resolve().violations()
    expect(v.map((x) => x.message).join('\n')).not.toMatch(/admin\/index\.vue/)
  })

  it('exact mode requires the full path — a shortened-but-unique pointer is broken', () => {
    const v = pointers(c()).that().areLive().should().resolve({ paths: 'exact' }).violations()
    const messages = v.map((x) => x.message).join('\n')
    // Under exact, the unique-suffix pointer no longer resolves.
    expect(messages).toMatch(/broken.*admin\/index\.vue/s)
    // The missing one is still broken.
    expect(messages).toMatch(/broken.*ghost\/missing\.ts/s)
  })
})

describe('pointers() — HTML-comment sanctions (family exclusion mechanism)', () => {
  it('an HTML eess-exclude comment above the line sanctions the pointer for its rule id', () => {
    const c = corpus({ roots: ['docs/sanctioned-pointer.md'], cwd: fixtureRoot })
    const v = pointers(c)
      .that()
      .areLive()
      .should()
      .resolve()
      .rule({ id: 'corpus/pointers-resolve' })
      .violations()
    expect(v).toHaveLength(0)
  })

  it('the sanction is rule-id-scoped: a different id still fails (both forms)', () => {
    const c = corpus({ roots: ['docs/sanctioned-pointer.md'], cwd: fixtureRoot })
    const v = pointers(c)
      .that()
      .areLive()
      .should()
      .resolve()
      .rule({ id: 'corpus/other-rule' })
      .violations()
    // Neither the single-line- nor the block-sanctioned pointer is excluded
    // for a rule id the comments don't name.
    expect(v).toHaveLength(2)
    expect(v.every((x) => /missing\.ts/.test(x.message))).toBe(true)
  })
})
