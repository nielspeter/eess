# Bug 0285: bootstrap installs a document that fails the adopter's first gate, in a file they did not write

## Status

- **State:** Draft — reproduced end to end in a throwaway project; no red test yet.
- **Severity:** Medium — a **false red on day one**, before the adopter has
  authored anything, in a file the kit itself installed. **Not literally the first
  obstacle:** an adopter-lens reviewer who ran the kit reports that it names two
  gates to wire while shipping no runner, no install line and no pointer to the
  page carrying the snippets, and that after these two links are fixed the _next_
  rule in the same snippet reds on zero examined. The first of those is
  [0151](./0151-honesty-at-close-options-undiscoverable-past-source.md); the second
  is unfiled. This record is the first defect _in a file the kit itself wrote_.
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

**A tree this kit produces must pass the gates this kit tells the adopter to
wire.**

### The manifest check this record first proposed is vacuously green — do not build it

The first version said: resolve every relative link in every file the bootstrap
copies against the bootstrap's own install manifest, because "the manifest is data
`bootstrap.mjs` already has". **Measured, and false on three counts:**

1. **Nothing is exported.** `node -e "import('./kit/bootstrap.mjs')"` yields
   `exports: []`, and importing the file _runs_ it.
2. **Destinations only.** `plan(verb, absPath, run)` (`kit/bootstrap.mjs:27-29`)
   records the destination; the source lives inside the `run` closure. The check
   needs source content to extract links and destination position to resolve them.
3. **The manifest is a function of the destination tree — and at the repo root it
   omits this bug's subject.** `kit/bootstrap.mjs:76` is
   `if (existsSync(METHOD_DST)) skip(...)`. Run from this repository, where
   `docs/working-method.md` exists, the file lands on the **skip** list. A check
   written that way, run where CI runs it, examines zero installed documents and
   reports green.

A vacuously-green mechanism, proposed inside a record about a gate. Recorded
rather than edited away.

### The mechanism that works is this record's own reproduction

Bootstrap into a fresh temporary directory, run the gates the kit tells the
adopter to wire over the result, and assert clean. It reads no manifest, so all
three problems above are unreachable; it takes seconds; and it encodes the
property actually claimed — **the adopter's first gate run goes green** — rather
than a proxy for it.

It also catches what the manifest form would get wrong in both directions. The
kit's shipped skills link to _directories_ (`../../../work/bugs/`, `work/`) that
the bootstrap creates implicitly by placing files inside them; a manifest
membership test false-reds on all of those. And it catches the defects in files
this record's own symptom section does not count, because that section reasons
about `docs/` as though it were the whole install set.

This does not depend on whether `kit/` joins a content gate's roots. It runs over
a _produced tree_, not over `kit/` itself.

## Fix

1. Rewrite the two links in `docs/working-method.md:7` as absolute URLs, matching
   `kit/templates/work/README.md:46`'s existing form.
2. Add the bootstrap-into-temp harness above, so the next document the bootstrap
   learns to ship cannot reintroduce it.

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
- [x] **Falsified this record's own first mechanism** — the manifest is not
      exported, carries destinations only, and at the repo root places this bug's
      subject on the skip list, so the proposed check would have reported green.
- [ ] Red first: a bootstrap-into-temp harness, running the kit's own named gates,
      fails on the shipped tree today.
- [ ] Count the defects in the _whole_ install set, not only `docs/` — at least one
      further installed file carries an unresolvable link, and the shipped
      `next-number.mjs` prints a remedy path (`node kit/scripts/next-number.mjs`)
      that does not exist in an adopter's tree.
- [ ] The non-vacuity row and fixture.

Deferred: none.

## Related

- [0252](./0252-the-kit-names-a-reviewer-it-does-not-ship.md) — the same class:
  the kit references something it does not ship.
- [0251](./0251-the-corpus-map-teaches-a-close-vocabulary-the-gate-rejects.md) ·
  [0260](./0260-three-lane-declarations-and-nothing-compares-them.md) — adjacent
  kit records. **An earlier version of this record said both were "blocked on
  whether `kit/` enters a gate's roots" and that this one deliberately was not.
  That was invented.** 0251's two prerequisites are a corpus root (struck through,
  met 2026-09-04) and `LANES` not being importable; 0260 names no blocker at all.
  That no content gate reads `kit/` is true; attributing it to those records as
  their blocker was not.
- [0279](./0279-the-barrel-criterion-has-no-memory-and-no-adopter-signal.md) — why
  a defect that only exists in someone else's tree has no channel back here.
