import path from 'node:path'
import { watchAndRerun as watchAndRerunShared } from '@nielspeter/eess/internal'

/**
 * Watch mode for `eess-ts`.
 *
 * The scheduling and the watch loop live in the kernel — they were duplicated
 * with `eess-mermaid` and the copies drifted (see `@nielspeter/eess`'s
 * `watch.ts`). What is dialect-specific is only which filenames count.
 */
interface WatchOptions {
  /** Directories to watch for changes */
  watchDirs: string[]
  /** Additional files to watch (e.g., rule files) */
  watchFiles: string[]
  /** Callback to run on detected changes */
  onChangeDetected: () => Promise<void>
  /** Debounce window in ms. Default: 250 */
  debounceMs?: number
}

// eess-exclude eess/no-unused-exports: consumed by the test suite; the build tsconfig this gate reads excludes tests, so `src` is the only usage it can see
export const TS_FILE_RE = /\.[cm]?tsx?$/

export function watchAndRerun(options: WatchOptions): void {
  watchAndRerunShared({ ...options, watchedFileRe: TS_FILE_RE })
}

/**
 * Import a module with cache-busting for watch mode.
 *
 * Node ESM has no cache eviction API. Each call creates a new module entry via a
 * unique query string. Over long sessions this leaks memory.
 *
 * Stays in this package rather than moving to the kernel with the watch loop:
 * `eess-mermaid` has no equivalent, so it is not duplicated and unifying it
 * would be inventing shared surface rather than removing copied surface.
 */
export async function importFresh(filePath: string): Promise<unknown> {
  const resolved = path.resolve(filePath)
  const url = `file://${resolved}?t=${Date.now()}`
  return import(url)
}
