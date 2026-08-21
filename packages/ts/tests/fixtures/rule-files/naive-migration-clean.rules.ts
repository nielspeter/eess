// The naive migration from `@nielspeter/ts-archunit`, over a codebase with NO
// violations — and the worst shape in the whole bug, because it is silent.
//
// ts-archunit's `recommended()` returned builders unconditionally; it had no
// `report` option at all. eess-ts's runs and throws by default. So this exact line,
// which ts-archunit's own `init` scaffolded, spreads the preset's RETURN VALUE into
// the array. On a clean codebase that value is an empty violations array, so the
// file exports `[]`, the CLI loads zero rules, and `check` prints a green tick.
//
// Every rule is gone. `tsc --noEmit` passes. Nothing on stderr. Exit 0.
//
// The adopter who cleaned up their violations is the one this hits; the one with
// outstanding debt at least gets a red.
import path from 'node:path'
import { project } from '../../../src/index.js'
import { recommended } from '../../../src/presets/index.js'

const p = project(path.join(import.meta.dirname, '../poc-clean/tsconfig.json'))

export default [...recommended(p)]
