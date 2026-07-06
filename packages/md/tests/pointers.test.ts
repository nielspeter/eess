import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { corpus, pointers } from '../src/index.js'

const fixtureRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/corpus')

describe('pointers()', () => {
  it('resolve() flags broken and stale live pointers, not ok/ambiguous/fenced', () => {
    const c = corpus({ roots: ['docs/pointers.md'], cwd: fixtureRoot })
    const v = pointers(c).that().areLive().should().resolve().violations()
    const messages = v.map((x) => x.message).join('\n')

    // exactly the broken (missing.ts) and stale (app.ts:99) pointers
    expect(v).toHaveLength(2)
    expect(messages).toMatch(/broken code pointer.*missing\.ts/s)
    expect(messages).toMatch(/stale code pointer.*app\.ts.*line 99/s)

    // NOT flagged: ok full path, ok bare basename, ambiguous, fenced
    expect(messages).not.toMatch(/:3\b/) // ok full path
    expect(messages).not.toMatch(/dup\.ts/) // ambiguous → report-only
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

  it('resolves a unique partial path and skips an ambiguous one; only the missing path is broken', () => {
    const v = pointers(c()).that().areLive().should().resolve().violations()
    // admin/index.vue → app/pages/admin/index.vue (unique suffix) resolves.
    // dup/x.ts → a/dup/x.ts AND b/dup/x.ts (ambiguous) → skipped, never failed.
    // ghost/missing.ts → nothing ends with it → broken.
    expect(v).toHaveLength(1)
    expect(v[0]?.message).toMatch(/broken.*ghost\/missing\.ts/s)
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
