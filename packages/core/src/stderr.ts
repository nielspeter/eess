/**
 * The library's single stderr channel.
 *
 * Every library-originated warning going through `console.warn` is invisible
 * inside a test runner: vitest's default reporter **intercepts** console
 * output and replays it only for **failing** tests. `.warn()` never fails a
 * test, so its output was always dropped — measured on a real child `vitest
 * run` with the default reporter, a passing test whose rule has 4 real
 * violations printed **nothing**. That silence is not confined to `.warn()`:
 * every other library warning (stale exclusions, unused exclusions,
 * exclusion-comment parse warnings, invalid-baseline, diff-aware fallback)
 * is invisible in a passing test the same way. A finding nobody reads has
 * not been reported.
 *
 * **The EPIPE guard is not optional, and it is why this is a function rather
 * than a bare write.** Node's `Console` is constructed with `ignoreErrors:
 * true` and swallows write errors; `process.stderr.write` does not. With a
 * closed downstream pipe — `eess-ts check 2>&1 | head` — the error arrives
 * **asynchronously**, so neither `try`/`catch` nor the write callback can see
 * it, and the process dies with an uncaught EPIPE.
 *
 * A persistent listener rather than `once`: `once` removes itself after the
 * first error, leaving a second EPIPE uncaught, and re-adding per write leaks
 * listeners. One listener, attached lazily, never removed — the same trade
 * `ignoreErrors: true` makes.
 *
 * **The accepted cost:** vitest annotates intercepted console output with the
 * test that produced it (`stderr | file > test name`), and a direct write
 * loses that. For a violation report the rule's own identity is in the
 * message, so the loss is real but small — and being attributed to a test
 * that never printed is worse than being unattributed.
 */
let listenerAttached = false

/**
 * Write one message to stderr so it survives a test runner.
 *
 * A trailing newline is added when absent, because the call sites this
 * replaces used `console.warn`, which appends one — omitting it at ten call
 * sites is a mistake waiting to happen, and a message run onto the next is
 * the defect this channel exists to avoid.
 */
export function writeStderr(message: string): void {
  if (!listenerAttached) {
    // See the module docstring: the EPIPE is asynchronous, so this listener is
    // the only thing that can catch it.
    process.stderr.on('error', () => {})
    listenerAttached = true
  }
  process.stderr.write(message.endsWith('\n') ? message : `${message}\n`)
}

/**
 * Reset the lazily-attached listener. **Tests only** — a suite that asserts on
 * the attachment needs to observe it happening rather than inherit it from
 * whichever earlier test wrote first.
 */
// eess-exclude eess/no-unused-exports: test-only reset hook, consumed by tests/stderr.test.ts (the gate does not count test-file imports as usage)
export function resetStderrGuardForTests(): void {
  process.stderr.removeAllListeners('error')
  listenerAttached = false
}
