# Bug 0637: a failed build still writes `dist`

## Status

- **State:** Draft — found 2026-11-07 while running
  [plan 0582](../plans/completed/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s sabotage matrix; no red test yet.
- **Severity:** Low — no gate is known to trust a failed build's `dist`, and nothing here measured
  whether one does. The hazard is to anything that reads `dist` after a build it did not check: a
  hand-run sabotage matrix, a fixture that imports `dist`, a release step.
- **Origin:** self-found · [plan 0582](../plans/completed/0582-md-a-document-has-a-section-that-satisfies-a-predicate.md)'s build review, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

A kernel mutant in `packages/core/src/terminal-builder.ts` failed to compile (code after an early
`return`), and `npm run build -w packages/core` exited non-zero. The build had still emitted
`packages/core/dist` from the mutated source: the next test run, after the source was restored,
read the mutant's behaviour (2 red on a restored tree) until the kernel was rebuilt. No
`tsconfig*.json` in this repository sets `noEmitOnError` (checked by the build review's method
lens, 2026-11-07: the root and every `packages/*`), so `tsc` writes its output whatever errors it
reports. A process that treats "the build ran" as "`dist` is the source" is wrong after a failed
build.

## Reproduction

Not yet written. The shape: break a kernel source file so `tsc` reports an error the emitter does not
stop at, run the package's `build`, see it exit non-zero, and read `dist` holding the broken code.

## Fix

Not designed. Two shapes: set `noEmitOnError: true` in the build tsconfigs (a failed build then
leaves the previous `dist`, which is stale rather than wrong, so a reader still needs the exit
code), or have the processes that read `dist` check the build's exit code. Which gates read `dist`
after a build they did not check is unmeasured.

## Verification

- [ ] Red first: a failed build leaves `dist` unchanged, or every reader of `dist` refuses after one
