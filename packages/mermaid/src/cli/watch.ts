import { watch, type FileChangeInfo } from 'node:fs/promises'
import path from 'node:path'
import { ArchRuleError } from '@nielspeter/eess'

export interface WatchOptions {
  watchDirs: string[]
  watchFiles: string[]
  onChangeDetected: () => Promise<void>
  debounceMs?: number
}

const WATCHED_FILE_RE = /\.(mmd|[cm]?tsx?|[cm]?jsx?)$/

class RunScheduler {
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

  /** Debounce a change on `trigger`, coalescing bursts into a single re-run. */
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
    process.stdout.write('\x1B[2J\x1B[H')
    process.stdout.write(`Change detected: ${trigger}\n\n`)
    this.onRun(trigger)
      .catch((err: unknown) => {
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

export function watchAndRerun(options: WatchOptions): void {
  const { watchDirs, watchFiles, onChangeDetected, debounceMs = 250 } = options
  const scheduler = new RunScheduler(onChangeDetected, debounceMs)
  const watchers: Array<AsyncIterable<FileChangeInfo<string>>> = []

  for (const dir of watchDirs) {
    const resolved = path.resolve(dir)
    const watcher = watch(resolved, { recursive: true })
    watchers.push(watcher)
    void (async () => {
      try {
        for await (const event of watcher) {
          if (event.filename && WATCHED_FILE_RE.test(event.filename)) {
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

  process.on('SIGINT', () => {
    for (const w of watchers) {
      if ('return' in w && typeof w.return === 'function') {
        // AsyncIterable's optional return() is untyped; invoke via Function.prototype.call
        // (yields `any`) and discard the settle-promise — best-effort watcher shutdown.
        void w.return.call(w)
      }
    }
    process.exit(0)
  })
}
