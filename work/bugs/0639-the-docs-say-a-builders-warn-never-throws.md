# Bug 0639: the docs say a builder's `.warn()` never throws

## Status

- **State:** Draft — found 2026-11-07 by the method review of [bug 0577](./fixed/0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md)'s fix; no change yet.
- **Severity:** Low — documentation: no check passes because of it, but an author reading it expects a
  `.warn()` rule never to fail the run, and one with a configuration finding does.
- **Origin:** self-found · the build review of [bug 0577](./fixed/0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md), [bug 0586](./fixed/0586-the-kernels-collect-violations-swallows-a-configuration-error.md) and [bug 0595](./fixed/0595-generate-baseline-drops-a-configuration-finding-without-a-word.md), 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

`docs/cross-layer.md:183` and `docs/smell-detection.md:61` say a builder's `.warn()` logs "without
throwing". `executeWarn` (`packages/core/src/execute-rule.ts`) throws every finding that carries
`bypassFilters`, and has for some time; [bug 0577](./fixed/0577-a-preset-under-report-warn-exits-0-on-a-configuration-finding.md) made a preset's `report: 'warn'` do the same.
The three docs that said so of a preset's `warn` were corrected with that fix; these two, about the
builder, were outside it.

## Fix

Say what `docs/presets.md` now says: `.warn()` reports without failing the run, except a
configuration finding, which fails it.

## Verification

- [ ] Both lines corrected; `check:docs-code` green.
