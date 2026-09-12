# Bug 0285: bootstrap installs a document that fails the adopter's first gate, in a file they did not write

## Status

- **State:** Draft — reproduced end to end in a throwaway project; no red test yet.
- **Severity:** Medium — a **false red on day one**, before the adopter has
  authored anything, in a file the kit itself installed. It is the first thing the
  exported method does, and the first thing it does is fail.
- **Origin:** self-found · six-lens review of 0283/0284, by a reviewer who
  bootstrapped the kit rather than reading it
- **Reported:** 2026-09-12

## Symptom

`kit/bootstrap.mjs:74-77` copies this repo's `docs/working-method.md` verbatim
into the adopter's `docs/`. Line 7 of that document carries two links written
relative to **this** repository:

```markdown
[eess as a harness](./eess-as-a-harness.md) and the [manifesto](./manifesto.md).)\_
```

`docs/eess-as-a-harness.md` and `docs/manifesto.md` exist here and nowhere else.
`bootstrap.mjs` installs neither, and the file it installs is the **only** file it
puts in `docs/`.

The bootstrap's own closing line then says: "Next: review the seed templates, wire
the gates (`check:corpus`, `check:ledger`) into `package.json` + CI".

## Reproduction

Measured, in an empty git repository:

```bash
node kit/bootstrap.mjs --apply
```

then the canonical corpus snippet from `packages/md/README.md:18-26`, verbatim and
unmodified:

```js
const c = corpus({ roots: ['docs/**'], frozen: ['**/completed/**', '**/archived/**'] })
links(c).that().areInternal().should().resolve().check()
```

Output:

```
Architecture Violation [1 of 2]
  Rule: that are internal should resolve to an existing file
  broken link: "./eess-as-a-harness.md" does not resolve to a file in the repo
  docs/working-method.md:7 — docs/working-method.md → ./eess-as-a-harness.md
```

Two violations. Zero work items authored. The adopter's first interaction with the
gate is a failure they did not cause and cannot diagnose without reading this
repository.

## Root cause

`docs/working-method.md` is written to be read **in place**, inside eess, where
both siblings sit beside it. `kit/bootstrap.mjs` exports it by file copy, which
carries the prose and not the neighbours.

The kit already knows the answer and uses it one directory away.
`kit/templates/work/README.md:46` links out with an absolute URL —
`https://github.com/nielspeter/eess` — precisely because that template is destined
for someone else's tree. The method doc is destined for the same tree and did not
get the same treatment.

This is the distribution asymmetry
[0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) is
about, on a different artifact: the file is correct where it is measured and wrong
where it is used, and nothing here measures it where it is used.

## The corruption that must produce a violation

**A document `kit/bootstrap.mjs` installs must not contain a relative link whose
target the bootstrap does not also install.**

The red is mechanical: take the bootstrap's own install manifest, resolve every
relative markdown link in every file it copies against that manifest, and fail on
a target the manifest does not contain. It needs no new corpus root and no
heuristic — the manifest is data `bootstrap.mjs` already has.

That is narrower and cheaper than the question
[0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) and
[0260](./0260-three-lane-declarations-and-nothing-compares-them.md) are blocked on
(whether `kit/` joins a content gate's roots), and it does not depend on the
answer. It checks the **shipped set**, not the kit's prose.

## Fix

1. Rewrite the two links in `docs/working-method.md:7` as absolute URLs, matching
   `kit/templates/work/README.md:46`'s existing form.
2. Add the manifest check above, so the next document the bootstrap learns to ship
   cannot reintroduce it.

Option 2 is what stops this recurring. Without it, the fix is a one-line edit with
nothing holding it.

## Non-vacuity

A new `scripts/check-nonvacuity.mjs` registry row with a fixture: a document in
the bootstrap's install set carrying a relative link to a file outside that set.
The gate must red on it and the fixture must print a token only this check emits.

## Verification ledger

- [x] Reproduced: `kit/bootstrap.mjs --apply` into an empty repo installs
      `docs/working-method.md` as the only file in `docs/`.
- [x] Confirmed both link targets exist in this repo and neither is installed.
- [x] Ran the `packages/md/README.md` snippet verbatim on the fresh tree; two
      violations, quoted above.
- [x] Confirmed the bootstrap then instructs the adopter to wire `check:corpus`.
- [x] Confirmed the absolute-URL precedent already exists in a sibling kit
      template.
- [ ] Red first: the manifest check fails on the shipped tree today.
- [ ] The non-vacuity row and fixture.

Deferred: none.

## Related

- [0252](./0252-the-kit-names-a-reviewer-it-does-not-ship.md) — the same class:
  the kit references something it does not ship.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) ·
  [0260](./0260-three-lane-declarations-and-nothing-compares-them.md) — both
  blocked on whether `kit/` enters a gate's roots. This record deliberately is not.
- [0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) — why
  a defect that only exists in someone else's tree has no channel back here.
