# eess skills — the AI Integration Layer

Two agent skills (Claude Code / Agent SDK format) that make the human/AI half of
eess concrete: turning a decision into an enforceable rule, and checking that the
rule actually says what the decision says.

eess's deterministic gates (`check:arch`, `check:corpus`, `check:crossval`, …)
prove two things about an enforced ADR clause: the cited rule **exists**, and the
code **satisfies** it. They cannot prove the third — that the rule **means what
the clause says**. A reworded clause paired with an unchanged rule, or a rule
neutered by a broad exclusion, stays green while intent and enforcement silently
diverge. That gap is **Tier 4** in the [manifesto](../docs/manifesto.md): a
judgment with no deterministic checker. These skills are that judgment (and its
authoring counterpart) — done by an agent, flagging softly, never blocking.

| Skill               | Half of the loop | What it does                                                                                                                                                                             |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eess-adr-author`   | author           | Translate an ADR clause into the right mechanism (routed by tier), write the eess-ts rule, and record an honest Enforcement row (`gated` vs `pending`). Guards against vacuous rules.    |
| `eess-adr-validate` | validate         | Adversarially audit whether a rule faithfully enforces its clause — `FAITHFUL` / `PARTIAL` / `DRIFTED` with cited evidence. Hunts vacuity, under-enforcement, scope mismatch. Soft flag. |

The loop: **author** a rule for a clause → **validate** the translation before
marking the row `gated`. The author skill hands off to the validator; the
validator is also useful standalone when reviewing any ADR Enforcement table.

## When they help most

Testing these against unaided agents was honest about their ceiling. A capable
agent working **inside this repo** got little lift from them — the manifesto,
`CLAUDE.md`, and the existing ADRs already teach the tier model, the
`pending`/`gated` discipline, and the vacuity traps, so a strong model rediscovers
the same guidance by reading. The skills earn their keep where that context is
**absent or unread**:

- **Consuming repos** — an application governed by its own ADRs that just depends
  on `eess-ts` and has none of eess's own docs. There the skills inject the whole
  mental model the repo lacks.
- **Weaker or context-starved models** — where the discipline needs to be handed
  over explicitly rather than inferred.
- **Consistency** — they make the tier-routing, honesty, and vacuity checks happen
  _every_ time, instead of depending on the agent thinking of them.

So treat them as portable, guaranteed guidance for other repos and models — not as
a lift for an already-well-grounded agent in this one.

## Activating them

They are plain skills — no build step. Make them available to an agent by placing
them where it looks for skills:

```bash
# per-repo (this or a consuming project):
cp -R skills/eess-adr-author skills/eess-adr-validate .claude/skills/

# or globally for all your projects:
cp -R skills/eess-adr-author skills/eess-adr-validate ~/.claude/skills/
```

(Symlinking instead of copying keeps them in sync with this repo as the source of
truth.) A consuming repo like an app governed by its own ADRs gets the same
author→validate loop by copying these two directories in.

## Provenance

These were tested with-skill against naive baselines, and testing did its job —
it caught a factual bug. An early validator modeled `.excluding()` as a file
selector, so it wrongly called a dead string-exclusion "vacuous"; a baseline
agent that read `packages/core/src/execute-rule.ts` corrected it (`.excluding()`
is a post-hoc violation _suppressor_ — string = exact match, regex = test — so a
glob string suppresses nothing). The skill was fixed to the real semantics and
re-tested: it now rules the dead-exclusion case FAITHFUL and a genuine
empty-selection rule DRIFTED, both with cited evidence. It also surfaced a real
`notImportFrom` re-export blind spot in eess-ts (imports only, not
`export … from`). The corrected worked cases are embedded in the validator skill.

That episode is the thesis in miniature: the early skill was a spec that had
drifted from the code, and grounding against the code caught it — read the
source, don't trust prose.
