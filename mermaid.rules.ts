/**
 * Mermaid-dialect rules for the eess monorepo's own architecture diagram
 * (plan 0060 Phase 1 — the family dogfooding eess-mermaid).
 *
 * Run: `npx eess-mermaid check mermaid.rules.ts` (or `npm run check:diagram`).
 * The diagram↔code cross-validation lives in scripts/check-crossval.mjs.
 */
import { diagram, classes } from '@nielspeter/eess-mermaid'

const d = diagram('docs/architecture.mmd')

export default [
  // Charter: every class in the kernel diagram declares the <<kernel>> role.
  classes(d).should().haveStereotype('kernel').rule({
    id: 'diagram/kernel-stereotype',
    because: 'the architecture diagram depicts kernel classes only (plan 0060 charter)',
  }),
]
