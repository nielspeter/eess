/**
 * `eess-mermaid check` refuses a builder that enforces nothing — bug 0269.
 *
 * The dialect's CLI accepted any object with a `check` method and counted the
 * throws. Measured before this fix, a rule file exporting
 * `[{ check: () => {} }]` printed `✓ eess-mermaid — 1 rule across 1 file · 0
 * failing` and exited 0, and one exporting `[]` printed the same over `0 rules`.
 *
 * **The receipt was already there.** `ClassRuleBuilder extends RuleBuilder`,
 * which extends the kernel's `TerminalBuilder` — so every real builder already
 * has `violations(): CollectResult`, and a real rule with a dead selector
 * already reddened through `.check()`. What was missing was the guard: the
 * loader keyed on `check`, which a hand-rolled object satisfies, so a builder
 * with no receipt at all was counted as a rule. This is the wiring fix
 * `eess-ts` made in plan 0263 Phase 2, one dialect over.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { run } from '../../src/cli/index.js'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const cleanReceipt = resolve(here, '../fixtures/rules/clean-receipt.rules.ts')

async function runCli(args: string[]): Promise<{ out: string; exitCode: number | undefined }> {
  const chunks: string[] = []
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk): boolean => {
    chunks.push(String(chunk))
    return true
  })
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk): boolean => {
    chunks.push(String(chunk))
    return true
  })
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation((...parts: unknown[]) => {
    chunks.push(parts.map((p) => String(p)).join(' '))
  })
  const prev = process.exitCode
  process.exitCode = undefined
  try {
    await run(args)
    return { out: chunks.join('\n'), exitCode: process.exitCode }
  } finally {
    outSpy.mockRestore()
    errSpy.mockRestore()
    consoleSpy.mockRestore()
    process.exitCode = prev
  }
}

function withRuleFile(source: string, fn: (file: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'eess-mermaid-0269-'))
  const file = join(dir, 'probe.rules.ts')
  writeFileSync(file, source)
  return fn(file).finally(() => {
    rmSync(dir, { recursive: true, force: true })
  })
}

describe('eess-mermaid check — a builder that enforces nothing (bug 0269)', () => {
  beforeEach(() => {
    process.exitCode = undefined
  })
  afterEach(() => {
    process.exitCode = undefined
  })

  it('reds on a hand-rolled builder that certifies nothing', async () => {
    await withRuleFile('export default [{ check: () => {} }]\n', async (file) => {
      const { out, exitCode } = await runCli(['check', file])
      expect(exitCode).toBe(1)
      expect(out).not.toContain('✓ eess-mermaid')
    })
  })

  it('reds on a builder that hands back a bare array instead of a receipt', async () => {
    await withRuleFile('export default [{ violations: () => [] }]\n', async (file) => {
      const { out, exitCode } = await runCli(['check', file])
      expect(exitCode).toBe(1)
      expect(out).toContain('emitter/no-receipt')
      // Named at its own rule file — bug 0026's seam. An emitter finding carries
      // `file: ''` by construction, and "which rule file" is the first thing the
      // reader needs.
      expect(out).toContain('probe.rules.ts')
    })
  })

  it('reports that finding ONCE, not once attributed and once bare', async () => {
    // The first cut re-wrapped the gated findings with the RAW receipt's
    // `examined` — which a bare array does not have — so `reportViolations`'
    // own gate saw no evidence and appended a second `emitter/no-receipt`.
    // Measured: `[1 of 2]` and `[2 of 2]`, the same finding twice, one
    // attributed and one not.
    await withRuleFile('export default [{ violations: () => [] }]\n', async (file) => {
      const { out } = await runCli(['check', '--format', 'json', file])
      const matches = out.match(/"ruleId": "emitter\/no-receipt"/g) ?? []
      expect(matches).toHaveLength(1)
    })
  })

  it('CONTROL — a builder with a real receipt and nothing to report stays green', async () => {
    // Without this, "reds on a builder that certifies nothing" is satisfied by a
    // gate that reds on everything. A fixture rather than a temp file: a rule
    // file importing `@nielspeter/eess` resolves only inside the workspace.
    const { out, exitCode } = await runCli(['check', cleanReceipt])
    expect(exitCode).toBeFalsy()
    expect(out).toContain('✓ eess-mermaid')
  })

  it('reds on a rule file that contributes no rules, rather than ticking over zero', async () => {
    await withRuleFile('export default []\n', async (file) => {
      const { out, exitCode } = await runCli(['check', file])
      expect(exitCode).toBe(1)
      // The zero-denominator-under-a-tick that CLAUDE.md calls a red flag.
      expect(out).not.toContain('0 rules across 1 file · 0 failing')
      // And the summary must not dress a zero as a ratio: an earlier cut printed
      // `0 of 0 rules across 1 file failing`.
      expect(out).not.toContain('0 of 0 rules')
      expect(out).toContain('rule-file finding')
    })
  })
})
