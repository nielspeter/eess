// RED — a two-segment dialect subpath, `@nielspeter/eess-md/rules/adr`.
import { adrEnforcement } from '@nielspeter/eess-md/rules/adr'

export const build = (docs: object): unknown => adrEnforcement(docs)
