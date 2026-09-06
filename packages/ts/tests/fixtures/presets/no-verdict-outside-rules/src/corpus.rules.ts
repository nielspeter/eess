// GREEN — a rule file. The same shape as `runtime-import.ts`, exempt because of
// where it lives, which is the exemption doing its job.
import { docs } from '@nielspeter/eess-md'
import { finishPreset } from '@nielspeter/eess'

export default [docs('work/**')]
export const report = (v: unknown[]): void => finishPreset(v)
