# Bug 0107: `/bug` and `/plan` allocate numbers by scanning their own lane, but the sequence is shared across lanes — collisions are the guaranteed outcome

## Status

- **State:** Draft — confirmed against the skill sources and demonstrated by two
  real collisions on 2026-08-12. No red test written yet.
- **Severity:** Medium — an honesty gap between a stated claim and its
  mechanism. The instruction says "take the next free number" and "guard against
  a collision"; the procedure it gives cannot do either.
- **Origin:** self-found · two number collisions in one working session
- **Reported:** 2026-08-12

## Symptom

Two work items were authored with numbers already in use:

- An agent filing bugs took `0100`, `0101`, `0102`. **`0100` and `0101` are
  plans** (`work/plans/0100-publish-the-fold-retire-ts-archunit.md`,
  `work/plans/0101-sibling-gates-go-fail-closed.md`). All three had to be
  renumbered to 0104–0106 on intake.
- Independently, a bug filed the same day took `0102`, colliding with the third
  of those.

Neither author was careless. Both followed the documented procedure exactly.

## Reproduction

The arithmetic, as of the morning of 2026-08-12:

```
highest number in work/bugs/   → 0099     ⇒ /bug allocates 0100
highest number in work/plans/  → 0101     ⇒ 0100 and 0101 are already taken
```

Follow `/bug` literally and you get a colliding number. No guard in the
instruction detects it, because the instruction never looks at the other lane.

## Root cause

eess runs **one shared number sequence across plans and bugs**. That is stated
in the corpus — `work/plans/0090-adopt-ts-archunit-work-corpus.md:132` speaks of
"the next free number in the shared plan/bug sequence, read from the two
boards" — and it is visible in the numbering itself: plans hold 0051, 0058–0062,
0066–0073, 0075–0082, 0088–0091, 0096, 0100–0101, while bugs hold 0074,
0083–0087, 0092–0095, 0097–0099, 0103–0106. One sequence, two lanes.

Every allocation instruction scans **one** lane:

```
kit/skills/bug/SKILL.md:25   Scan `work/bugs/` **and** `BUGS.md` for the
                             highest `NNN`; use `NNN+1`. Guard against a collision.

kit/skills/plan/SKILL.md:29  Scan `work/plans/` **and** the board for the
                             highest `NNN`; use `NNN+1`. Guard against a collision
                             with an existing or board-listed number.

kit/skills/case/SKILL.md:23  Take the next free number
                             — no scope given at all.
```

"Guard against a collision" is present in both, and unactionable: the reader has
been told to look only where a collision cannot be seen. The `/plan` wording is
the more misleading of the two — "an existing or board-listed number" sounds
exhaustive while still meaning _this lane's_ board.

The failure is asymmetric and therefore intermittent: allocating from the lane
that currently holds the highest number happens to be correct, so the procedure
appears to work until the other lane pulls ahead. That is why this survived
until two agents worked the corpus in parallel.

**The defect ships.** `.claude/skills/{bug,plan,case}/SKILL.md` carry the same
text verbatim (`.claude/skills/bug/SKILL.md:25`,
`.claude/skills/plan/SKILL.md:29`), and `kit/` is the portable working-method
kit offered to other projects — so any corpus that adopts the kit and runs more
than one lane inherits it.

## Why it matters

A collision is cheap to fix and expensive to miss. Renumbering on intake means
rewriting the record's own H1, its board row, and every cross-reference in other
records — three files per collision today. Miss one and the corpus has two
documents claiming the same identity, which every `path:line` pointer, board
row, and `[NNN](…)` link in the repo then resolves ambiguously.

It also scales exactly the wrong way. This corpus is being worked by more than
one agent at a time, which is the condition the collision needs; the safeguard
is a sentence telling each of them to look only at their own half.

## Fix

**1 — Correct the instruction in all six files** (three in `kit/skills/`, three
in `.claude/skills/`): allocate from the **union of every numbered lane**, not
one. Concretely, scan `work/plans/` (including `completed/` and `wont-do/`),
`work/bugs/` (including `fixed/`), and any other lane the project runs, plus
their boards; take `max + 1`. State the shared-sequence rule as the reason, so a
reader who adds a fourth lane knows it joins the same sequence.

**2 — Make it mechanical rather than remembered.** The scan is four lines of
shell and does not need a human:

```bash
ls work/plans/*.md work/plans/*/*.md work/bugs/*.md work/bugs/*/*.md 2>/dev/null \
  | sed 's#.*/##' | grep -oE '^[0-9]{4}' | sort -n | tail -1
```

The honest home is a `next-number` helper the skills call, so the rule has one
definition instead of six copies that can drift apart again.

**3 — Gate the invariant.** A duplicate number across lanes is a mechanical
claim about the repo, which is what `scripts/check-workspace-integrity.mjs`
already exists for: fail when any `NNNN` prefix appears in more than one work
item. That catches the collision at the commit, not at the next reviewer.

No changeset — `kit/` and `.claude/` are not published packages.

## Verification

- [ ] Red test written first: a fixture corpus with `plans/0100-a.md` and
      `bugs/0100-b.md` fails the new duplicate-number check; removing one turns
      it green.
- [ ] The allocator helper returns `max+1` across all lanes and their terminal
      folders. Regression fixture reproducing the 2026-08-12 state (bugs highest
      `0099`, plans highest `0101`): the helper returns **0102**, where the
      per-lane bug scan returned `0100` and collided.
- [ ] All six SKILL.md files state the shared-sequence rule and scan the union.
- [ ] `npm run validate` green.

Deferred:

- **Whether `work/support/` and any future lane join the same sequence** —
  `kit/skills/case/SKILL.md:23` gives no scope at all, so it is being corrected
  to the union here on the assumption that one corpus means one sequence. If a
  project wants per-lane sequences, that is a kit-configuration question and
  belongs with the kit's tailoring notes (`docs/working-method.md:276`), not
  with this fix.
