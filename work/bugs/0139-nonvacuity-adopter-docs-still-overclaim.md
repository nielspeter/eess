# Bug 0139: three adopter-facing docs still say "every gate above is proven to fail" — the harness itself now says otherwise

## Status

- **State:** Draft — measured against the live doc text and the corrected
  harness comment; no red test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its actual
  mechanism, the same class as [0130](./0130-cli-summary-counts-the-invocation.md).
  Not High: nothing here is a gate passing over drift it should catch —
  `check:nonvacuity` itself is more honest than it was, and no rule silently
  weakened. The gap is that the correction stopped at the mechanism and never
  reached the sentence an adopter actually reads.
- **Origin:** self-found · product + customer review of
  [0127](./fixed/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md)'s fix
  (PR #57), independently
- **Reported:** 2026-08-14

## Symptom

Bug 0127's fix corrected `scripts/check-nonvacuity.mjs`'s own summary line and
header doc comment from "every gate actually FAILS" / "N gates proven" to "N
fixtures fired... no fixture is silently green" — an accurate statement, since
most fixtures only prove their own condition fires or a shipped preset fires
over a hand-built corpus, not that the real `check:*` invocation invokes it.

Three other places make the uncorrected, stronger claim, verbatim or near-verbatim:

- `README.md:83` — "`check:nonvacuity` — every gate above is **proven to fail**
  on committed violating fixtures: no green-but-empty gates"
- `docs/dogfooding.md:15` — "Every gate above is proven to **fail** on a
  committed violating fixture — no green-but-empty gates"
- `work/dogfood-coverage.md:24` — "every gate above proven to FAIL on
  committed violating fixtures — no green-but-empty gates"

All three also carry a second, narrower inaccuracy since 0127's fix: "committed
violating fixtures" was true when the corpus/links and corpus/pointers
fixtures were tracked files (`scripts/nonvacuity/bad-links/broken.md`, etc.);
those two are now planted at runtime and deleted (`withProbe`), so nothing
about them is committed.

`docs/what-is-eess.md:59` sends a brand-new adopter to imitate
`check:nonvacuity`'s pattern for their own gates — a fine recommendation, but
anchored to a page whose model overstates what the pattern delivers.

## Root cause

The three docs and the harness's own comments describe the same mechanism from
different distances, and only the closest description — the code comment right
next to the code — got corrected. `README.md`, `docs/dogfooding.md`, and
`work/dogfood-coverage.md` are all hand-typed prose, not derived from the
harness's output or gated against it by any `check:*` — `check:corpus`'s
pointer/link resolution proves these files exist and their links resolve, not
that their claims match current mechanism (the exact gap
[0138](./0138-pointer-resolve-proves-existence-not-truth.md) describes, one
level up: three separate documents making an assertion about a fourth file's
behavior, with nothing that reads either side to compare them).

## Why it matters

This is the manifesto's own front door. `README.md:83` sits four lines under
"every gate must **prove it can fail**" — the pitch the whole family is sold
on. After 0127's fix, the mechanism that pitch rests on states in its own
source that it does not deliver what the pitch claims for most of its rows.
Three of the four descriptions of the same harness now disagree with the
fourth, and the fourth is the one actually accurate.

## Fix

1. `README.md:83`, `docs/dogfooding.md:15`, `work/dogfood-coverage.md:24` —
   soften "every gate above is proven to fail" to what's actually true, e.g.
   "every fixture below fires on its violating input — a handful drive the
   real `check:*` invocation directly (`arch`, `internal arch`, `baseline`,
   `corpus/links`, `corpus/pointers`); the rest prove their own condition or a
   shipped preset fires over a fixture corpus." Three files, one clause each.
2. Drop "committed" from the same sentences, or qualify it — two of the
   fixtures it now describes are planted at runtime.
3. Not proposed here: actually closing the gap so "every gate" becomes literally
   true (driving every fixture through its real `check:*` invocation, the way
   0127's fix now does for `corpus/links`/`corpus/pointers`) — that's the shape
   of `release/gate-fails-the-build` generalized to every gate, a real project,
   not a docs fix. Named so it isn't lost: the honest floor `check:nonvacuity`
   itself now documents (`scripts/check-nonvacuity.mjs`'s header, "Gate →
   violating input → rule that must fire" list) is the inventory of what such
   a project would need to close, row by row.

## Verification

- [ ] Red test written first: none — this is a docs correction with no
      behavioral change, matching 0127's own Fix item 1/2 (docs-only) shape.
- [ ] `npm run validate` green.

Deferred: none — item 3 above is intentionally out of scope, not deferred; it
names a future project rather than an obligation this record carries.
