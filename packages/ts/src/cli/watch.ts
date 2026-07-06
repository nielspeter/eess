import { watch, type FileChangeInfo } from 'node:fs/promises'
import path from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'

// eess-exclude eess/no-unused-exports: parameter type of the exported watchAndRerun API (must stay exported for declaration emit)
export interface WatchOptions {
  /** Directories to watch for changes */
  watchDirs: string[]
  /** Additional files to watch (e.g., rule files) */
  watchFiles: string[]
  /** Callback to run on detected changes */
  onChangeDetected: () => Promise<void>
  /** Debounce window in ms. Default: 250 */
  debounceMs?: number
}

// eess-exclude eess/no-unused-exports: consumed by the test suite (tests are outside the build project)
export const TS_FILE_RE = /\.[cm]?tsx?$/

/**
 * Scheduling logic for watch mode — extracted for testability.
 *
 * Debounces rapid triggers. If a trigger arrives while the callback
 * is running, it queues a re-run after the current run completes.
 */
// eess-exclude eess/no-unused-exports: consumed by the test suite (tests are outside the build project)
export class RunScheduler {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private _pendingRerun = false
  private readonly debounceMs: number
  private readonly onRun: (trigger: string) => Promise<void>
  #runCount = 0

  constructor(onRun: (trigger: string) => Promise<void>, debounceMs = 250) {
    this.onRun = onRun
    this.debounceMs = debounceMs
  }

  get runCount(): number {
    return this.#runCount
  }

  get pendingRerun(): boolean {
    return this._pendingRerun
  }

  get isRunning(): boolean {
    return this.running
  }

  /**
   * Queue a run for the given trigger, resetting the debounce window.
   * If a run is already in progress, marks a pending re-run instead.
   */
  schedule(trigger: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      if (this.running) {
        this._pendingRerun = true
        return
      }
      this.executeRun(trigger)
    }, this.debounceMs)
  }

  private executeRun(trigger: string): void {
    this.running = true
    this._pendingRerun = false
    this.#runCount++
    process.stdout.write('\x1B[2J\x1B[H') // clear screen, preserve scrollback
    process.stdout.write(`Change detected: ${trigger}\n\n`)
    this.onRun(trigger)
      .catch((err: unknown) => {
        // Rule failures are expected — swallow ArchRuleError, print others
        if (!(err instanceof ArchRuleError)) {
          if (err instanceof Error) {
            console.error(err.message)
          }
        }
      })
      .finally(() => {
        this.running = false
        if (this._pendingRerun) {
          this.executeRun('(queued change)')
        } else {
          process.stdout.write('\nWatching for changes...\n')
        }
      })
  }
}

/**
 * Watch for file changes and re-run the callback.
 *
 * Uses Node.js `fs.watch` with `recursive: true` (Node 24+).
 * Debounces rapid filesystem events. If a change arrives while
 * a run is in progress, it is queued and executed after the
 * current run completes.
 *
 * Known limitation: each re-run loads rule files with a fresh (cache-busting)
 * jiti instance. Over long sessions, memory grows — restart the watcher
 * periodically for long sessions.
 */
export function watchAndRerun(options: WatchOptions): void {
  const { watchDirs, watchFiles, onChangeDetected, debounceMs = 250 } = options
  const scheduler = new RunScheduler(onChangeDetected, debounceMs)

  const watchers: Array<AsyncIterable<FileChangeInfo<string>>> = []

  // Watch directories recursively
  for (const dir of watchDirs) {
    const resolved = path.resolve(dir)
    const watcher = watch(resolved, { recursive: true })
    watchers.push(watcher)
    void (async () => {
      try {
        for await (const event of watcher) {
          if (event.filename && TS_FILE_RE.test(event.filename)) {
            scheduler.schedule(event.filename)
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message !== 'The operation was aborted') {
          console.error(`Watcher error on ${dir}: ${err.message}`)
        }
      }
    })()
  }

  // Watch individual rule files
  for (const file of watchFiles) {
    const resolved = path.resolve(file)
    const watcher = watch(resolved)
    watchers.push(watcher)
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must consume async iterator
        for await (const _event of watcher) {
          scheduler.schedule(path.basename(file))
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message !== 'The operation was aborted') {
          console.error(`Watcher error on ${file}: ${err.message}`)
        }
      }
    })()
  }

  // Graceful shutdown — close all watchers on SIGINT
  process.on('SIGINT', () => {
    for (const w of watchers) {
      // Ask each async iterator to release its underlying fs.watch handle.
      void w[Symbol.asyncIterator]().return?.()
    }
    process.exit(0)
  })
}
