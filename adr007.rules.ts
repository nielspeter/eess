/**
 * ADR-007 Rule 1 (Confinement) — the pending, un-gated mechanism.
 *
 * Clause: "only the engine module imports ts-morph — source outside the single
 * designated engine module must not import ts-morph directly." The designated
 * module is `packages/ts/src/core/engine/` (the boundary ADR-007 will introduce).
 *
 * STATUS: pending — the code does NOT satisfy this yet. ts-morph is imported
 * across ~55 files in eess-ts; ADR-007 exists precisely to close that gap. This
 * rule is therefore RED today by design, so it is deliberately NOT wired into
 * `check:arch` (`arch.rules.ts` / `arch.internal.rules.ts`), which must stay
 * green. It is a standalone, clearly-pending mechanism: run it on demand with
 * `npx eess-ts check adr007.rules.ts` to watch the violation count fall as the
 * boundary lands. When it reaches zero, move this rule into `arch.rules.ts` and
 * ratchet the ADR-007 Enforcement row from `pending` to `gated`.
 *
 * The engine folder does not exist yet, so `not(resideInFolder(ENGINE))` today
 * selects the whole eess-ts source tree — which is correct: every current
 * ts-morph importer is a violation until confinement moves it behind the seam.
 */
import { workspace, modules, not, resideInFolder } from '@nielspeter/eess-ts'

const p = workspace(['packages/ts/tsconfig.build.json'])

/** The single designated engine module — the only place ts-morph may live. */
const ENGINE = '**/packages/ts/src/core/engine/**'

export default [
  modules(p)
    .that()
    .resideInFolder('**/packages/ts/src/**')
    .and()
    .satisfy(not(resideInFolder(ENGINE)))
    .should()
    .notImportFrom('**/ts-morph/**')
    .rule({
      id: 'adr007/ts-morph-confined-to-engine',
      because:
        'ADR-007 Rule 1: only the single engine module (packages/ts/src/core/engine) may import ts-morph; every other module talks to the engine-neutral boundary',
    }),
]
