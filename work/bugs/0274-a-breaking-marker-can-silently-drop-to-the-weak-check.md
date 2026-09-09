# Bug 0274: a breaking marker can silently drop to the weak check

## Status

- **State:** Draft — a guarantee that weakens with nothing printed to say so.
- **Priority:** Medium
- **Found by:** release review of PR #122. Pre-existing, and load-bearing as of
  that release.

## Symptom

`check:release` reads a changeset's breaking marker two ways, and which one it
gets decides how strong a check runs:

- **Strong.** The marker names an owning package, so the gate can require _that
  package_ to bump past `patch`.
- **Weak.** No owner is found, so the gate can only ask that _at least one_ of
  the named packages bumps past `patch`. The package whose surface actually
  broke can ship a `patch` and nothing notices.

The gate reports the weak form as a count — `N checked loosely (several packages,
no owner named…)` — but it never says which changeset fell into it, and it does
not warn the author that their marker failed to parse.

## The corruption that must produce a violation

A marker whose owner the extractor cannot see, silently taking the weak path.

Measured shapes, against `scripts/release-gate.mjs:169`:

| marker                               | owner found                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `**Breaking (@nielspeter/eess): …**` | yes — whole sentence bolded, closing `**` is line-final                                      |
| `**Breaking (@nielspeter/eess):** …` | yes — the house spelling in `RELEASING.md:61`                                                |
| `**Breaking** — @nielspeter/eess …`  | **no** — the non-greedy run stops at the second `**`, the owner is outside the captured span |

The third is an ordinary way to write the line and it degrades in silence.

## Why it matters now

PR #122 depends on the strong form. Its first version used
`**Breaking: …**` with six packages named and no owner, and the gate passed while
the kernel could have been declared `patch` — measured: dropping
`@nielspeter/eess` to `patch` left the gate green. Naming the owner is what armed
it, and re-measured after: the same drop then fails, naming the package.

So the difference between a real guard and a decorative one is a punctuation
choice the author gets no feedback on.

## Fix sketch

Report it rather than count it: when a changeset declares a break and no owner is
extracted, print the changeset path and the marker line, so the author can see
that the strong check did not run. Optionally, refuse a marker that names a
package outside the captured span, which is the shape that most looks correct and
is not.

## Verification ledger

- [ ] Red test first: a changeset with `**Breaking** — @nielspeter/eess …` and
      the owning package at `patch`, passing before the fix.
- [ ] The gate names each loosely-checked changeset rather than counting them.
- [ ] A non-vacuity fixture asserting by rule id.
