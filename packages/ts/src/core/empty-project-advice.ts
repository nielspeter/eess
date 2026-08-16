import type { ArchProject } from './project.js'

/**
 * The one text for "this project loaded nothing", owned in one place.
 *
 * A rule that examines zero elements because its own selector glob is dead
 * needs a different message than a rule that examines zero elements because
 * the whole tsconfig loaded nothing — the fix is at a different level
 * (correct the glob vs. correct the tsconfig `include`), and confusing the
 * two sends the reader to edit the wrong thing.
 */

/** Did this project load nothing at all? */
export function loadedNothing(project: ArchProject): boolean {
  return project.getSourceFiles().length === 0
}

/**
 * Why nothing can match, and what to do about it.
 *
 * Deliberately **not** ending in a period: the call site appends its own
 * trailing sentence.
 */
export function emptyProjectAdvice(project: ArchProject): string {
  return (
    `the project loaded 0 source files (${project.tsConfigPath}), so no glob can match. ` +
    `Check that this tsconfig includes your sources — and if it delegates to project ` +
    `references ("files": [] with "references"), it loads none of them itself, so the rules ` +
    `need the tsconfig that holds your sources rather than this one`
  )
}
