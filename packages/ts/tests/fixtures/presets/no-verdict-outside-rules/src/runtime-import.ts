// RED (import leg alone): a runtime import of a dialect, and no emitter call.
import { docs } from '@nielspeter/eess-md'

export function countDocs(dir: string): number {
  return docs(dir).length
}
