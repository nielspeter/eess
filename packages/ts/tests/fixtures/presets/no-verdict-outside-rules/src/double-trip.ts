// Trips BOTH legs on one module: a runtime import of a dialect AND a namespaced
// emitter call. Exists to earn the test file's basename-keyed assertions — the
// docstring argues counts are the wrong key because a module like this reports
// twice, and without this fixture that argument was never exercised.
import { docs } from '@nielspeter/eess-md'
import * as eess from './local-wrapper.js'

export function report(dir: string): void {
  eess.finishPreset(docs(dir))
}
