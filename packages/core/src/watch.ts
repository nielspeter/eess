import { watch, type FileChangeInfo } from 'node:fs/promises'
import path from 'node:path'
import { isArchRuleError } from './errors.js'
import { isNullaryCallable } from './type-guards.js'

/**
 * Watch-mode scheduling and the watch loop, shared by every dialect CLI.
 *
 * **Why this is in the kernel.** It was copied, and the copies drifted. Measured
 * on 2026-08-31: `watchAndRerun` scored 98% between `eess-ts` and `eess-mermaid`,
 * `RunScheduler.schedule` 100%, `RunScheduler.executeRun` 98% — and the drift was
 * not cosmetic. Two fixes had landed on the ts copy alone:
 *
 * - `isArchRuleError` instead of `err instanceof ArchRuleError`. The structural
 *   check exists because a rule file does not load through the same module
 *   registry as the CLI loading it, so `instanceof` is FALSE for an error that is
 *   an `ArchRuleError` in every way that matters. With the `instanceof` form,
 *   `eess-mermaid --watch` printed an ordinary rule failure as an unexpected
 *   crash.
 * - `isNullaryCallable(w.return)` instead of a `typeof` test plus
 *   `w.return.call(w)`, which the copy's own comment noted yields `any`.
 *
 * Nothing here needs a project or a tokenizer, so this unification is not
 * waiting on either decision plan 0188 turns on — see that plan's inventory.
 *
 * Kernel-safe: node builtins and this package only.
 */
export interface WatchOptions {
  /** Directories to watch, recursively. */
  watchDirs: string[]
  /** Additional individual files to watch (e.g. rule files). */
  watchFiles: string[]
  /** Which filenames inside `watchDirs` count as a change. */
  watchedFileRe: RegExp
  /** Runs on a debounced change. */
  onChangeDetected: () => Promise<void>
  /** Debounce window in ms. Default: 250. */
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 250

/** `fs.watch` reports this when a watcher is closed; it is not a fault. */
const ABORTED = 'The operation was aborted'

/**
 * Scheduling logic for watch mode — separate from the loop so it is testable
 * without a filesystem.
 *
 * Debounces rapid triggers. A trigger arriving mid-run is remembered and
 * replayed once the run finishes, so a save during a run is never dropped and
 * never starts a second concurrent run.
 */
export class RunScheduler {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined
  private running = false
  private _pendingRerun = false
  private readonly debounceMs: number
  private readonly onRun: (trigger: string) => Promise<void>
  #runCount = 0

  constructor(onRun: (trigger: string) => Promise<void>, debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.onRun = onRun
    this.debounceMs = debounceMs
  }

  /**
   * Completed runs.
   *
   * Hard-private with a getter: the counter is this class's own bookkeeping, and
   * a caller that could reassign it would make the number mean nothing.
   */
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
    process.stdout.write('\x1B[2J\x1B[H') // clear screen, preserve scrollback
    process.stdout.write(`Change detected: ${trigger}\n\n`)
    this.onRun(trigger)
      .catch((err: unknown) => {
        // A rule failure is the expected outcome of a watch run — swallow it and
        // let the reporter's own output stand. Anything else is a real fault.
        if (!isArchRuleError(err) && err instanceof Error) {
          console.error(err.message)
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

/** Consume one watcher, scheduling on each qualifying event. */
function consume(
  watcher: AsyncIterable<FileChangeInfo<string>>,
  label: string,
  onEvent: (event: FileChangeInfo<string>) => void,
): void {
  void (async () => {
    try {
      for await (const event of watcher) onEvent(event)
    } catch (err: unknown) {
      if (err instanceof Error && err.message !== ABORTED) {
        console.error(`Watcher error on ${label}: ${err.message}`)
      }
    }
  })()
}

/**
 * Watch for file changes and re-run the callback.
 *
 * Uses `fs.watch` with `recursive: true` (Node 24+). Debounces rapid events; a
 * change during a run is queued and executed after it completes.
 */
export function watchAndRerun(options: WatchOptions): void {
  const {
    watchDirs,
    watchFiles,
    watchedFileRe,
    onChangeDetected,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options
  const scheduler = new RunScheduler(onChangeDetected, debounceMs)
  const watchers: Array<AsyncIterable<FileChangeInfo<string>>> = []

  for (const dir of watchDirs) {
    const watcher = watch(path.resolve(dir), { recursive: true })
    watchers.push(watcher)
    consume(watcher, dir, (event) => {
      if (event.filename && watchedFileRe.test(event.filename)) {
        scheduler.schedule(event.filename)
      }
    })
  }

  for (const file of watchFiles) {
    const watcher = watch(path.resolve(file))
    watchers.push(watcher)
    consume(watcher, file, () => {
      scheduler.schedule(path.basename(file))
    })
  }

  // Graceful shutdown — close all watchers on SIGINT.
  process.on('SIGINT', () => {
    for (const w of watchers) {
      if ('return' in w && isNullaryCallable(w.return)) {
        void w.return()
      }
    }
    process.exit(0)
  })
}
