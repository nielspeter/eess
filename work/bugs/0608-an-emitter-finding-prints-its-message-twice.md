# Bug 0608: an emitter finding prints its message twice

## Status

- **State:** Draft — measured 2026-11-03 on `main` at 1a2c1817 against `packages/core/dist`; no red
  test yet.
- **Severity:** Low — noise, not a wrong verdict. But an `emitter/*` finding exists to tell an author
  something they did not expect, and repeating its paragraph makes it harder to read.
- **Origin:** self-found · measuring a consuming project's question about [bug 0607](./0607-mergecollectresults-says-a-bare-member-leaves-no-evidence.md), 2026-11-03.
- **Reported:** 2026-11-03

## Symptom

`reportViolations` on a bare array prints `emitter/no-receipt` in the terminal format with its whole
message (79 words), then a `Fix:` line that repeats the same paragraph and appends the
unsuppressable sentence.

The plain and GitHub formats print it twice as well (measured): both render `message`, then the
suggestion that starts with it.

## Root cause

Every `emitter/*` finding is built by `emitterFinding` with `suggestion: \`${message} ${UNSUPPRESSABLE}\``
(`packages/core/src/emitter-findings.ts:142`). The formatters skip a `Fix:` line only when the
suggestion equals the message (`remedyRepeatsMessage`, `packages/core/src/violation.ts:189-191`).
A suggestion that starts with the message is not caught. The docstring above it
(`packages/core/src/violation.ts:185-187`) is also out of date: it says the rich terminal format shows
`message` only for a finding with no location, and it now shows it for every finding.

## Fix

Not designed. Either the suggestion carries only the unsuppressable sentence, or the formatters
print only the part of the suggestion the message has not already said. The fix measures each
format (terminal, plain, JSON, GitHub), since the JSON `suggestion` field is read by agents on its own.

## Verification

- [ ] Red first: the terminal, plain and GitHub outputs of `emitter/no-receipt` each contain its
      message once.
- [ ] The unsuppressable sentence is still shown in every format.
- [ ] The JSON `suggestion` is measured and its shape stated.
- [ ] `remedyRepeatsMessage`'s docstring states what each renderer prints.
- [ ] A changeset naming `@nielspeter/eess`.
- [ ] `npm run validate` green.

Deferred: none
