/**
 * Bug 0337 — `agentGuardrails` built every rule over `functions()`, so the preset sold to
 * agent-focused projects reported an `eval` inside a function and **nothing** for a bare top-level
 * one.
 *
 * This is [bug 0333](../../../../work/bugs/fixed/0333-the-recommended-floor-reads-functions-only.md)'s
 * defect in the sibling preset, and 0333's ruling is the one applied: each rule reads the broadest
 * subject its condition has a variant for, and **exactly one**, because the subject kinds nest — a
 * module's search reads the whole file, so running two of them for one rule id reports the same call
 * twice.
 *
 * **Every fixture holds an unrelated function.** Without one the preset has no subject at all and
 * ADR-010's empty-selection finding fires, which is the opposite of the silent pass under test — the
 * delta review of PR #149 caught exactly that mistake in 0337's own record. `reported()` below
 * THROWS on such a finding rather than filtering it away, so a fixture that stopped holding one
 * would fail loudly instead of quietly reporting `[]`.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from 'ts-morph'
import { agentGuardrails } from '../../src/presets/agent-guardrails.js'
import type { AgentGuardrailsOptions } from '../../src/presets/agent-guardrails.js'
import type { ArchProject } from '../../src/core/project.js'

let base: string

/** An unrelated function, so the preset always has a function subject to examine. */
const UNRELATED = 'export function unrelated(): number {\n  return 1\n}\n'

function fixture(body: string): ArchProject {
  const root = fs.mkdtempSync(path.join(base, 'p-'))
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
  )
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), body)
  const tsConfigPath = path.join(root, 'tsconfig.json')
  const tsm = new Project({ tsConfigFilePath: tsConfigPath })
  return { tsConfigPath, _project: tsm, getSourceFiles: () => tsm.getSourceFiles() }
}

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-0337-'))
})

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true })
})

/**
 * Findings the preset reports, as `element @ line` — an IDENTITY, never a count.
 *
 * `tests/tools/scan-cardinality-assertions.test.ts` rejected the first version of
 * this file for asserting lengths, and its reason is the one that matters here: a
 * dead selector also yields exactly one violation, so `toHaveLength(1)` accepts a
 * configuration finding from a rule whose condition never ran. The element name is
 * also the thing this fix CHANGES — a module-scope match is named for the broadest
 * enclosing declaration, or the file when nothing encloses it — so a count would
 * have hidden the half of the change an adopter's baseline feels.
 *
 * **It THROWS on a configuration finding rather than filtering one out**, and that
 * is the difference between this version and the one review saw. Filtering
 * `bypassFilters` discards exactly the unsuppressable ADR-010 finding that says a
 * rule examined nothing — so a future `toEqual([])` row, added with a typo'd option
 * name, would have been green while the preset constructed nothing. The docblock
 * above claimed the fixtures made that "impossible"; filtering made it invisible,
 * which is not the same thing, and the claim is now true because the helper
 * enforces it.
 */
function reported(body: string, options: Partial<AgentGuardrailsOptions>): string[] {
  const all = agentGuardrails(fixture(body), { src: '**/src/**', report: 'return', ...options })
  const configFindings = all.filter((v) => v.bypassFilters === true)
  if (configFindings.length > 0) {
    throw new Error(
      `the preset reported a configuration finding, so this case measures nothing about what a ` +
        `rule READS: ${configFindings.map((v) => `${v.ruleId ?? '?'} — ${v.message ?? ''}`).join(' | ')}`,
    )
  }
  return all.map(
    (v) => `${v.element ?? '?'} @ ${String(/at line (\d+)/.exec(v.message ?? '')?.[1] ?? v.line)}`,
  )
}

describe('bug 0337: agentGuardrails reads the whole file, not only function bodies', () => {
  it('reports an inline-logic call wherever the file runs it, named by its scope', () => {
    // The record's own table, as identities. Before the fix only the first row
    // reported; the other three were silent, under a rule the adopter named `eval`.
    expect(
      reported(`export function c(): void {\n  eval('x')\n}\n`, { noInlineLogic: ['eval'] }),
    ).toEqual(['c @ 2'])
    expect(reported(`eval('x')\n${UNRELATED}`, { noInlineLogic: ['eval'] })).toEqual(['a.ts @ 1'])
    expect(
      reported(`class S {\n  static {\n    eval('x')\n  }\n}\nexport { S }\n${UNRELATED}`, {
        noInlineLogic: ['eval'],
      }),
    ).toEqual(['S @ 3'])
    expect(
      reported(`class S {\n  v = eval('x')\n}\nexport { S }\n${UNRELATED}`, {
        noInlineLogic: ['eval'],
      }),
    ).toEqual(['S.v @ 2'])
  })

  it('reports a generic Error thrown outside any function', () => {
    // `no-generic-errors`' own imperative is "Do NOT throw new Error()" — not
    // "…in a function" — so a throw at module scope was a false green against the
    // rule as written. That test, does the imperative claim more than the subject
    // reads, is what puts this rule in scope and leaves `no-stubs` out of it.
    expect(
      reported(`export function c(): void {\n  throw new Error('boom')\n}\n`, {
        noGenericErrors: true,
      }),
    ).toEqual(['c @ 2'])
    expect(
      reported(`if (globalThis) {\n  throw new Error('boom')\n}\n${UNRELATED}`, {
        noGenericErrors: true,
      }),
    ).toEqual(['a.ts @ 2'])
    expect(
      reported(
        `class S {\n  static {\n    throw new Error('boom')\n  }\n}\nexport { S }\n${UNRELATED}`,
        { noGenericErrors: true },
      ),
    ).toEqual(['S @ 3'])
  })

  it('reports one finding per match, not one per nesting subject', () => {
    // The reason each rule reads exactly ONE subject (0333). A module's search reads
    // the whole file, so a rule that also ran over `functions()` would report each of
    // these twice under one id — and the two are told apart by line, not by element.
    expect(
      reported(`export function c(): void {\n  eval('x')\n  eval('y')\n}\n`, {
        noInlineLogic: ['eval'],
      }),
    ).toEqual(['c @ 2', 'c @ 3'])
    // The same guard for the OTHER rule that moved. Review noted the first version
    // pinned only one of the two, which is a pin missing rather than a defect —
    // but a nesting bug would land in whichever one nobody checked.
    expect(
      reported(
        `export function c(): void {\n  throw new Error('a')\n}\nexport function d(): void {\n  throw new Error('b')\n}\n`,
        { noGenericErrors: true },
      ),
    ).toEqual(['c @ 2', 'd @ 5'])
  })

  it('CONTROL: no-stubs stays function-scoped, because its own imperative is', () => {
    // Not every silence is a defect. `no-stubs` says "Do NOT leave stub comments in a
    // function body", and a `// TODO` above a class is a different claim — so this
    // rule keeps its subject, and this case is what stops the fix from becoming "make
    // everything module-scoped".
    expect(
      reported(`export function c(): number {\n  // TODO: implement\n  return 1\n}\n`, {
        noStubs: true,
      }),
    ).toEqual(['c @ 2'])
    expect(reported(`${UNRELATED}// TODO: implement this module\n`, { noStubs: true })).toEqual([])
  })

  it('CONTROL: no-empty-bodies stays function-scoped', () => {
    // 0333's ruling, unchanged: an empty body is a fact about a function and has no
    // meaning at module scope.
    expect(reported(`export function c(): void {}\n`, { noEmptyBodies: true })).toEqual(['c @ 1'])
  })
})
