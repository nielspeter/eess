# Bug 0587: the evidence gate adds a finding again on a second pass

## Status

- **State:** Draft — reproduced 2026-11-01 on `packages/core/dist` at `bd78b962`; no red test yet.
- **Severity:** Low — no false verdict: the receipt is red after one pass and after two. The number
  of findings depends on how many doors the receipt went through, and one pass can leave a wrong
  flag unnamed. Measured: no receipt that the two double-gating scripts can build reaches it, so
  their real output is unaffected today.
- **Origin:** self-found · [proposal 011](../proposals/011-core-name-the-evidence-gate.md)'s
  review, 2026-11-01 (architect lens); reproduced before filing.
- **Reported:** 2026-11-01

## Symptom

The evidence gate (`withEvidenceGate`, `packages/core/src/report.ts:101`) is not idempotent. A
receipt that examined something and carries two contradicted flags gets one finding on the first
pass and a second finding on the next pass. Its docstring says "a value that already carries a
finding passes through untouched" (`packages/core/src/report.ts:97`), and
[ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md) §4 says the emitter does
not stack a second cause on a value that already carries a finding.

Two scripts gate a receipt twice today. They call `finishPreset(…, { report: 'return' })` and pass
the result to `reportViolations`, which gates again:

- `scripts/check-corpus.mjs:1667` and `scripts/check-corpus.mjs:1668`, on the `--format json` and
  `--format github` path.
- `scripts/check-release.mjs:383` and `scripts/check-release.mjs:385`, on the same path.

## Reproduction

Throwaway scripts against `packages/core/dist` (built 2026-11-01 08:56; the last commit touching
`packages/core/src` is 2026-10-30, so the build matches the source), on Node 24.22.0.

**The gate, once, twice and three times** (`gate = r => finishPreset(r, { report: 'return' })`),
over hand-built receipts. 0.04 s.

```text
examined 3, declaredEmpty, sourceEmpty           | once: emitter/expired-declaration | twice: emitter/expired-declaration, emitter/contradictory-evidence | thrice: emitter/expired-declaration, emitter/contradictory-evidence
examined 3, notRun, sourceEmpty                  | once: emitter/contradictory-evidence | twice: emitter/contradictory-evidence, emitter/contradictory-evidence | thrice: emitter/contradictory-evidence, emitter/contradictory-evidence
examined 3, declaredEmpty, notRun                | once: emitter/expired-declaration | twice: emitter/expired-declaration | thrice: emitter/expired-declaration
examined 3, declaredEmpty, notRun, sourceEmpty   | once: emitter/expired-declaration | twice: emitter/expired-declaration, emitter/contradictory-evidence | thrice: emitter/expired-declaration, emitter/contradictory-evidence
examined 3, declaredEmpty                        | once: emitter/expired-declaration | twice: emitter/expired-declaration | thrice: emitter/expired-declaration
examined 0 (zero)                                | once: emitter/pass-without-evidence | twice: emitter/pass-without-evidence | thrice: emitter/pass-without-evidence
examined 4 (healthy)                             | once: - | twice: - | thrice: -
```

The first two rows stack on the second pass and are stable from the third. The third and fourth
rows show the other half of the same cause: a contradicted `notRun` beside an expired declaration
is never named, on any pass.

**Whether the two scripts' real output is affected.** Both build their receipt with
`mergeCollectResults` (`scripts/check-corpus.mjs:1627`, `scripts/release-gate.mjs:602`). A second
script merged every combination of one to three members, each member drawn from 32 shapes (examined
0 or 3, zero or one violation, each of `notRun`, `declaredEmpty` and `sourceEmpty` on or off), and
compared one gate pass with two. 0.11 s.

```text
merged receipts: 33824 | with two flags contradicted by examined > 0: 0 | gate(gate(x)) differs from gate(x): 0
```

A merged receipt never carries `notRun`, and it carries `declaredEmpty` only when nothing was
examined (`packages/core/src/collect-result.ts:217`, `:232`), so the two-flag case cannot reach
either script. `node scripts/check-release.mjs --format json` on this tree printed nothing and
exited 0 (0.10 s). `check-corpus.mjs` was not run here; its receipt is a merge, which the
measurement above covers. The defect is reachable from a hand-built receipt, which is the
population [ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)'s gate exists for, by any caller that finishes and then reports.

## Root cause

Each of the three contradiction branches reports the first contradiction it finds and returns. It
stamps a new receipt that drops the flag it reported and carries others forward:

- the expired-declaration branch (`packages/core/src/report.ts:113`) carries `sourceEmpty`
  (`packages/core/src/report.ts:116`) and drops `notRun` without reporting it;
- the `notRun` branch (`packages/core/src/report.ts:129`) carries `sourceEmpty`
  (`packages/core/src/report.ts:132`);
- the `sourceEmpty` branch (`packages/core/src/report.ts:148`) carries nothing.

The branches run before the `length > 0` pass-through (`packages/core/src/report.ts:157`), on
purpose, so a flag beside real violations is still caught. A second pass therefore finds the
`sourceEmpty` the first pass carried forward and reports it.

## Fix

Not designed. The direction: one pass reports every contradicted flag, and the receipt it stamps
carries no flag it has contradicted. Then a second pass finds nothing new, and a `notRun` beside an
expired declaration is named on the first pass.

## Verification

- [ ] Red test written first: `gate(gate(x))` equals `gate(x)` by rule ids for
      `{ examined: 3, declaredEmpty, sourceEmpty }` and `{ examined: 3, notRun, sourceEmpty }`.
- [ ] One pass over `{ examined: 3, declaredEmpty, notRun }` names both contradicted flags.
- [ ] The single-flag receipts keep their one finding.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
