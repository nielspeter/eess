// GREEN — `*.spec.ts` is in the default list. An earlier draft of plan 0237
// dropped it with no reason given; this fixture is why it is back.
import { checkAll } from '@nielspeter/eess-ts'

export const run = (rules: object[]): void => checkAll(rules)
