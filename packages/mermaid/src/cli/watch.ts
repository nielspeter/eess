import { watchAndRerun as watchAndRerunShared } from '@nielspeter/eess/internal'

/**
 * Watch mode for `eess-mermaid`.
 *
 * The scheduling and the watch loop live in the kernel — they were duplicated
 * with `eess-ts` and the copies drifted, one of them keeping an `instanceof`
 * check the other had already replaced (see `@nielspeter/eess`'s `watch.ts`).
 * What is dialect-specific is only which filenames count as a change.
 */
export interface WatchOptions {
  watchDirs: string[]
  watchFiles: string[]
  onChangeDetected: () => Promise<void>
  debounceMs?: number
}

/** Diagrams and the rule files that read them. */
const WATCHED_FILE_RE = /\.(mmd|[cm]?tsx?|[cm]?jsx?)$/

export function watchAndRerun(options: WatchOptions): void {
  watchAndRerunShared({ ...options, watchedFileRe: WATCHED_FILE_RE })
}
