#!/usr/bin/env node
/**
 * NON-VACUITY FIXTURE — a text corpus's waivers are read from its registered text (ADR-024).
 *
 * `corpusFromText` registers its texts with the kernel, and the kernel's waiver scan reads a claimed
 * file's directives from them, never the disk (plan 0632). The positive witness is the promoted
 * finding for an undocumented waiver: it exists only if the kernel parsed the directive, and the
 * directive exists only in the registered text, at a root that is not on disk. A scan that fell back
 * to the disk would read nothing and the finding would not appear. A plain waiver could not tell
 * these apart: a waiver read from nowhere leaves the violation, and so does one never parsed.
 *
 * Premises, each checked so this cannot pass by doing nothing:
 *   - the control (no directive) reports the broken pointer, so the rule examined the document;
 *   - with the undocumented directive, the promoted finding names the document's own `file`.
 *
 * Exit codes (consumed by scripts/check-nonvacuity.mjs):
 *   1 = the promoted finding appeared — the registered text was read — OK
 *   0 = it did not — the waiver scan never read the registered text — the gate is vacuous
 *   2 = the fixture's own premise broke, not the gate proven
 */
import { corpusFromText, pointers } from '../../packages/md/dist/index.js'

const SENTINEL = 'bad-text-corpus-waiver:'
const RULE = 'demo/pointers'
const doc = (above) => `# A\n\n${above}\nSee \`src/missing.ts:1\`.\n`

const run = (text) => {
  const c = corpusFromText({ 'docs/a.md': text })
  const [d] = c.documents()
  const v = pointers(c).that().areLive().should().resolve().rule({ id: RULE }).violations()
  return { file: d?.file, v }
}

let control
let undocumented
try {
  control = run(doc('Plain text.'))
  undocumented = run(doc(`<!-- eess-exclude ${RULE} -->`))
} catch (err) {
  console.error(`${SENTINEL} unexpected error building or running the text corpus — ${String(err)}`)
  process.exit(2)
}

if (control.v.length !== 1 || !(control.v.examined > 0)) {
  console.error(
    `${SENTINEL} the control reported ${String(control.v.length)} finding(s) over ` +
      `${String(control.v.examined)} examined, expected 1 broken pointer — the premise broke`,
  )
  process.exit(2)
}

const promoted = undocumented.v.filter(
  (x) => /states no reason/.test(x.message) && x.file === undocumented.file,
)
if (promoted.length === 0) {
  console.error(
    `${SENTINEL} no undocumented-waiver finding on ${String(undocumented.file)} — the waiver scan ` +
      `never read the registered text (findings: ${undocumented.v.map((x) => x.message.split('\n')[0]).join(' | ') || 'none'})`,
  )
  process.exit(0)
}

console.error(
  `${SENTINEL} source-text/registered-waiver-read — the undocumented waiver in a text corpus was ` +
    `read from its registered text and promoted, at ${promoted[0].file}:${String(promoted[0].line)}`,
)
process.exit(1)
