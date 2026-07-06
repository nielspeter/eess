/**
 * NON-VACUITY FIXTURE — mirrors the root mermaid.rules.ts charter rule, but
 * points at scripts/nonvacuity/bad-diagram.mmd (which contains a class with no
 * <<kernel>> stereotype). Running `eess-mermaid check` on this file MUST exit 1.
 *
 * The .mmd path is repo-relative because the harness runs eess-mermaid from the
 * repo root (process.cwd()), exactly like `npm run check:diagram`.
 *
 * Loaded only by scripts/check-nonvacuity.mjs — never wired into CI directly.
 */
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('scripts/nonvacuity/bad-diagram.mmd')

export default [
  classes(d).should().haveStereotype('kernel').rule({
    id: 'diagram/kernel-stereotype',
    because: 'non-vacuity probe: the fixture class lacks <<kernel>>, so this must fail',
  }),
]
