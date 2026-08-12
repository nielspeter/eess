# Bug 0095: `examples/README.md`'s run step names a file that exists nowhere — in this repo or the adopter's

## Status

- **State:** Draft — confirmed against the folder and the README's own framing;
  no red test written yet (a doc-clarity bug; verification is that the
  instruction names something real).
- **Reported:** 2026-08-12 — self-found during the [plan 0091](../plans/0091-cross-dialect-examples-checked.md)
  review, when the product persona checked the examples folder's discovery
  surface. **Reframed 2026-08-12** after review: the first filing called this a
  stale pointer to a repo file and proposed substituting a real example
  filename. Both were wrong — see _Root cause_.

## Symptom

`examples/README.md:19` — step 3 of the "Running" section — says:

> 3. Run with your test runner: `npx vitest run arch.test.ts`

`arch.test.ts` names nothing. It is not a file in `examples/` (the five examples
are `rest-api`, `clean-architecture`, `custom-rules`, `type-safety`,
`archunit-inspired`), and it is not a name the reader was ever told to create —
step 1 says "Copy an example to your project's test directory" without naming
the destination. So the one concrete filename in the instructions is unanchored
at both ends.

## Reproduction

```bash
ls examples/*.test.ts
# archunit-inspired.test.ts  clean-architecture.test.ts  custom-rules.test.ts
# rest-api.test.ts  type-safety.test.ts
# (no arch.test.ts)
```

Then read the three steps around it (`examples/README.md:15-19`) and try to
answer "which file does step 3 run?" — neither reading resolves.

## Root cause

Line 15 states the frame plainly: **"These examples are templates, not runnable
tests"**, followed by copy → adjust → run. So step 3 runs a file in the
_adopter's_ project, and `arch.test.ts` is a placeholder for the adopter's copy,
not a pointer into `examples/`.

The defect is that nothing says so. Because lines 7–11 list five real example
filenames immediately above, a concrete-looking `arch.test.ts` in the same
document reads as a sixth one. The pointer never drifted from a file — it was
always a placeholder wearing a filename's clothes.

This is why the obvious fix is wrong: substituting `archunit-inspired.test.ts`
would tell an adopter to run an example from this repo, contradicting line 15
four lines above, and would make the contradiction _harder_ to spot by dressing
it in a filename that does exist.

## Fix

Make the placeholder look like one, and give step 1 a destination it can refer
back to:

```markdown
1. Copy an example to your project's test directory (e.g. `tests/arch.test.ts`)
2. Adjust folder paths to match your project structure
3. Run it with your test runner: `npx vitest run tests/arch.test.ts`
```

Step 3 now names the file step 1 created, so both ends are anchored and neither
reads as a file in `examples/`.

## Verification

- [ ] Every filename in the "Running" section either exists in `examples/` or is
      visibly the adopter's own copy, introduced by an earlier step.
- [ ] The section no longer contradicts line 15 ("templates, not runnable
      tests") — nothing instructs the reader to run a file from this repo.
- [ ] `npm run validate` green.

Deferred: none — but note that no gate covers this. `check:corpus` resolves
links and `path:line` pointers, and a backticked bare filename in prose is
neither, so an unanchored filename in adopter-facing docs is currently caught
only by review. Whether that is worth a mechanism is
[0091](../plans/0091-cross-dialect-examples-checked.md)'s lane, not this bug's.
