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

function withRuleFile(
  source: string,
  fn: (file: string) => Promise<void>,
  options?: { inPackage?: boolean },
): Promise<void> {
  // `inPackage` writes the probe inside the package so a relative import of the
  // dialect's own source resolves; a temp dir cannot reach it.
  const dir =
    options?.inPackage === true
      ? mkdtempSync(join(here, '../__probe-'))
      : mkdtempSync(join(tmpdir(), 'eess-mermaid-0269-'))
  const file = join(dir, 'probe.rules.ts')
  writeFileSync(file, source)
  return fn(file).finally(() => {
    rmSync(dir, { recursive: true, force: true })
  })
}

// **`--format terminal` is pinned on every run that asserts on the summary.**
// `detectFormat()` returns `github` when `GITHUB_ACTIONS` is set, and the
// summary line is written only under `terminal`. Without the flag these tests
// passed locally and failed in CI — an assertion about the environment wearing
// the costume of an assertion about behaviour.
describe('eess-mermaid check — a builder that enforces nothing (bug 0269)', () => {
  beforeEach(() => {
    process.exitCode = undefined
  })
  afterEach(() => {
    process.exitCode = undefined
  })

  it('rejects a hand-rolled builder LOUDLY, naming the entry by index', async () => {
    // Loud, never a silent skip. Ported without its loudness, the tightened
    // guard turned a rule that ran and threw into a green run: a file holding
    // one real builder and one hand-rolled `{ check() { throw } }` went from
    // exit 1 to `✓ eess-mermaid — 1 rule across 1 file · 0 failing`.
    await withRuleFile('export default [{ check: () => {} }]\n', async (file) => {
      const { out, exitCode } = await runCli(['check', '--format', 'terminal', file])
      expect(exitCode).toBe(1)
      expect(out).not.toContain('✓ eess-mermaid')
      expect(out).toContain('entry [0]')
      // By id, where the id actually appears: the terminal format prints the
      // rule's NAME, so an id assertion belongs on the JSON stream.
      const json = await runCli(['check', '--format', 'json', file])
      expect(json.out).toContain('cli/rule-file-misconfigured')
    })
  })

  it('does not silently drop a non-builder sitting beside a real one', async () => {
    // The regression this guard would otherwise have introduced: on the previous
    // behaviour the hand-rolled entry's `check()` ran and threw, so the run
    // reddened. Dropping it silently made a failing rule cease to exist while
    // the denominator still claimed it was there.
    await withRuleFile(
      "import { diagram, classes } from '../../src/index.js'\n" +
        "const d = diagram('classDiagram\\nclass Foo\\n<<kernel>> Foo')\n" +
        'export default [\n' +
        "  classes(d).should().haveStereotype('kernel').rule({ id: 'probe/ok', because: 'p' }),\n" +
        '  { check: () => {} },\n' +
        ']\n',
      async (file) => {
        const { out, exitCode } = await runCli(['check', '--format', 'terminal', file])
        expect(exitCode).toBe(1)
        expect(out).toContain('entry [1]')
      },
      { inPackage: true },
    )
  })

  it('reds on a builder that hands back a bare array instead of a receipt', async () => {
    await withRuleFile('export default [{ violations: () => [] }]\n', async (file) => {
      const { out, exitCode } = await runCli(['check', '--format', 'terminal', file])
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
    const { out, exitCode } = await runCli(['check', '--format', 'terminal', cleanReceipt])
    expect(exitCode).toBeFalsy()
    expect(out).toContain('✓ eess-mermaid')
  })

  it('reds on a rule file that contributes no rules, rather than ticking over zero', async () => {
    await withRuleFile('export default []\n', async (file) => {
      const { out, exitCode } = await runCli(['check', '--format', 'terminal', file])
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
