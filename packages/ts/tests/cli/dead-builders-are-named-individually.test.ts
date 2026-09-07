/**
 * Three dead builders in one rule file are three findings — plan 0263 Phase 2.
 *
 * The per-builder gate exists so the finding names the rule file it came from
 * (bug 0026's seam). That buys nothing if the reporting layer then merges the
 * findings back together, and it did: `dedupeConfigFindings` keys on
 * `(rule file, rule id, offending glob)`, and an `emitter/*` finding sets
 * `element` to its own rule id — it points at a verdict, not at a place in
 * anyone's code — so all three collapsed into one, with a note claiming they
 * were "one edit".
 *
 * They are three edits in three places. `keyFor` now refuses a key for the ids
 * in `EMITTER_IDS`, which `emitter-findings.ts` owns.
 *
 * **Keyed on the id set, not on the `element === identity` shape.** A first cut
 * used the shape and was too broad — a real rule with a real narrowing and no
 * glob to name looks identical, and two instances of it genuinely are one edit.
 * `tests/core/the-floor.test.ts`'s "CONTROL: genuinely identical findings still
 * collapse" reds on that version. This note used to describe the rejected cut,
 * which would have sent the next reader to make the change a control forbids.
 *
 * This lives in `packages/ts` rather than beside the kernel unit test because
 * `check:crossval` resolves ADR `it()` citations against `packages/ts`'s
 * tsconfig only — a kernel test cannot be cited (bug 0262). The kernel keeps
 * its own unit test for `keyFor`; this one pins the behaviour at the door the
 * ADR clause is actually about.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCheck } from '../../src/cli/commands/check.js'

const baseArgs = { changed: false, base: 'main', format: 'terminal' as const, fresh: true }

let stderr: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  stderr = []
})

describe('several evidence-free builders in one rule file', () => {
  it('names every dead builder, rather than collapsing them into one edit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eess-three-bare-'))
    const file = join(dir, 'three.rules.ts')
    writeFileSync(
      file,
      'export default [\n' +
        '  { violations: () => [] },\n' +
        '  { violations: () => [] },\n' +
        '  { violations: () => [] },\n' +
        ']\n',
    )
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk))
      return true
    })
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const code = await runCheck({ ...baseArgs, ruleFiles: [file] })
      const report = stderr.join('')
      expect(code).toBeGreaterThan(0)
      expect(report).toContain('[1 of 3]')
      expect(report).toContain('[3 of 3]')
      // The fan-out note belongs to a preset that generated N rules from one
      // option. Three hand-rolled builders are not that, and telling their
      // author it is one edit sends them to fix one of three places.
      expect(report).not.toContain('one edit')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
