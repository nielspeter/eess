# Bug 0645: the vacuity matrix probes no preset under `expectEmpty`

## Status

- **State:** Draft — found 2026-11-07 by the enforcement review of [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md)'s fix; no change yet.
- **Severity:** Medium — no false green of its own, but the gate that exists to catch a check that
  cannot fail does not see this class: removing `withEmptySource` from a preset is caught only by
  that preset's unit test.
- **Origin:** self-found · the build review of [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md)'s fix, 2026-11-07.
- **Reported:** 2026-11-07

## Symptom

`scripts/vacuity-matrix.mjs` probes each crossvalidate preset over empty inputs with no options, so
each was already red before [spike 0640](../spikes/0640-an-input-side-loaded-nothing.md) and [bug 0642](./fixed/0642-other-doors-pass-over-an-input-that-loaded-nothing.md) (by the evidence gate's pass-without-evidence
finding), and stays red after. The fail-open path those fixed was the `expectEmpty: true` form,
which the matrix never calls. `files()` is also still listed as a non-constructor ("selection
source") though it now carries evidence.

## Fix

A second probe per preset under `expectEmpty: true` over empty inputs, required to be a finding.

## Verification

- [ ] Red first: removing `withEmptySource` from one preset reds `check:vacuity`.
