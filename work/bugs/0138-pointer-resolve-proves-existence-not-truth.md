# Bug 0138: `corpus/pointers-resolve` proves a `path:line` citation exists — never that the line says what the prose next to it claims

## Status

- **State:** Draft — measured live, reproduced in isolation; no red test yet.
- **Severity:** Medium — an honesty gap between what a green `check:corpus` run
  is read as meaning and what `pointerResolves` actually mechanizes. Not High:
  the gate never documented itself as checking semantic accuracy, so this isn't
  a broken promise — it's an unstated ceiling on a Tier-1 mechanism that this
  session's own work leaned on as if it were stronger.
- **Origin:** self-found · surfaced three times over by an enforcement reviewer
  and a testing reviewer auditing successive citation fixes to
  [0127](./0127-nonvacuity-proves-a-condition-not-a-wired-rule.md) on
  2026-08-13 — every wrong `path:line` attribution in that round-trip still
  resolved, so `check:corpus` stayed green through all four revisions.
- **Reported:** 2026-08-13

## Symptom

`work/bugs/0127-nonvacuity-proves-a-condition-not-a-wired-rule.md` cites
`packages/md/src/rules/ledger.ts` by line number in several places, arguing that
`honestyAtClose` "constructs no builder — it imports `finishPreset` and iterates
directly." Refreshing that citation after two unrelated PRs moved the line went
through four revisions in one review round, each wrong in a different way:

1. `:297`, labelled "the `finishPreset` call" — wrong: `:297` was the
   `for (const doc of corpus.documents())` loop, not `finishPreset`.
2. `:320`, attributed to "bug 0121 added the `proposals` lane + `findUncoveredLanes`
   above it" — wrong on both counts: `:320` is `finishPreset` (the _other_ line,
   evidencing the weaker half of the claim), and `findUncoveredLanes` isn't in
   this file at all — it lives in `scripts/lib/lane-coverage.mjs`.
3. `:320` again, re-attributed to "PR #45 and PR #53 each inserted 12 lines
   above it" — wrong: PR #45 produced line 297 outright (182 insertions / 32
   deletions), it didn't shift into a pre-existing 297.
4. `:309` (the loop, correctly identified this time), attributed to "PR #45's
   bugs 0118/0119 … then PR #53's … guard added the same +12 lines above it
   again" — still wrong: only PR #53 was a clean +12; PR #45 is what produced
   line 297 in the first place.

`check:corpus` was green on **every one** of these four states, because each
cited line was a real line in a real file within range — `pointerResolves`
(`packages/md/src/conditions/pointer-resolve.ts:94-207`) never reads what the
line actually contains beyond counting total lines in the file. Three of the
four wrong states also passed a human review pass before the next one caught
it, for the same underlying reason a machine gate would miss it: nothing in the
toolchain compares a citation's prose to its target's content.

## Reproduction

Live, self-contained, no repo files left modified:

```bash
mkdir -p reports/__pointer_demo__
cat > reports/__pointer_demo__/claim.md <<'EOF'
The kernel exports `ArchRuleError` from `packages/core/src/index.ts:1`.
EOF
cat > ./__pointer_demo__.mjs <<'EOF'
import { corpus, pointers } from '@nielspeter/eess-md'
const c = corpus({ roots: ['reports/__pointer_demo__/*.md'] })
const v = pointers(c).that().areLive().should().resolve().violations()
console.log('violations:', v.length)
EOF
node ./__pointer_demo__.mjs
# violations: 0

sed -n '1p' packages/core/src/index.ts
# // @nielspeter/eess — the dialect-independent kernel.
# — not ArchRuleError, not an export statement, not remotely what the claim said.

rm -f ./__pointer_demo__.mjs && rm -rf reports/__pointer_demo__
```

`packages/core/src/index.ts:1` is a real, in-range line, so the pointer
"resolves" — 0 violations — no matter what the surrounding prose claims about
its content.

## Root cause

`pointerResolves` (`packages/md/src/conditions/pointer-resolve.ts`) classifies a
pointer as `broken` (no file matches), `stale` (file exists but is shorter than
the referenced line — `lines = lineCount(targetRel)` compared against
`Math.max(p.startLine, p.endLine)` at line 189-190), or `ok`. There is no fourth
state for "the file and line both check out, but the line's content doesn't
support the sentence citing it" — that dimension isn't represented in the
condition at all. The doc comment above the function (lines 54-56) is honest
about this scope: _"every code pointer resolves to a real file with the
referenced line in range"_ — "in range" is exactly and only what gets checked.
The gap isn't a broken promise; it's a promise nobody widened to match how the
mechanism gets used in practice, which this session's four-revision round-trip
demonstrated concretely.

The same shape almost certainly extends to `linkResolves()`
(`packages/md/src/conditions/resolve.ts`) — a link that resolves to a real file
says nothing about whether that file still contains what the linking prose
describes — but this record's Reproduction and root cause are scoped to
pointers, the case actually measured. Extending the claim to links without
measuring it would repeat the exact failure this bug is about.

## Why it matters

This is the manifesto's Tier boundary, crossed silently: pointer resolution is a
Tier-1 (static, structural) mechanism, but the record it grounds — an ADR
Enforcement row, a bug's root-cause citation, a plan's Files Changed pointer —
is implicitly read as a Tier-4 (semantic) claim: "this code does what I say it
does." `check:corpus`'s own summary line (`✓ corpus integrity — N checks across
M documents, 0 violations`) reads as "the corpus is trustworthy," and for the
one dimension it actually checks, it is. For the dimension a reader assumes —
does the citation still mean what it says — it proves nothing, and this
session spent one review round finding that out empirically, four times, on a
single line number.

## Fix

**Not proposed here.** Line-content verification is a real Tier-4 problem —
semantic drift between prose and code is exactly what
[0079](../plans/0079-tier-2-3-mechanization.md) (Tier 2/3 mechanization) is
scoped to, and this bug's own root cause states there's no mechanism for it
yet ("an 83-talk sweep found none"). What this record can responsibly close on
is narrower: **say the ceiling out loud** where an adopter would otherwise
over-trust it.

1. Tighten `pointerResolves`'s doc comment and `check:corpus`'s summary
   language so "resolves" doesn't read as "is accurate" — e.g. the corpus
   summary could name what it checked (existence + line range) rather than
   implying completeness.
2. Consider whether `docs/manifesto.md` or `CLAUDE.md`'s pointer-citation
   convention should say this ceiling explicitly, so an agent citing
   `path:line` evidence knows a green `check:corpus` is necessary, not
   sufficient, for the citation being true.
3. Out of scope here, named for a future record: actually mechanizing
   line-content verification (e.g. hashing the cited line/range and flagging
   drift) — that is new capability, not a fix to what exists, and belongs with
   0079 if it's ever built.

## Verification

- [ ] Red test written first: none yet — this record establishes the gap;
      fixing it is documentation-only per the Fix section above, which has no
      red-test shape (nothing behavioral changes). If (3) is ever built, that
      work gets its own bug/plan with its own red test.
- [ ] `npm run validate` green.

Deferred: none — (3) above is intentionally out of scope, not deferred; it
names a future record rather than an obligation this one carries.
