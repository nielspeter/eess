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

| Skill                        | Half of the loop | What it does                                                                                                                                                                             |
| ---------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eess-author-rule`           | author           | Translate an ADR clause into the right mechanism (routed by tier), write the eess-ts rule, and record an honest Enforcement row (`gated` vs `pending`). Guards against vacuous rules.    |
| `eess-validate-faithfulness` | validate         | Adversarially audit whether a rule faithfully enforces its clause — `FAITHFUL` / `PARTIAL` / `DRIFTED` with cited evidence. Hunts vacuity, under-enforcement, scope mismatch. Soft flag. |

The loop: **author** a rule for a clause → **validate** the translation before
marking the row `gated`. The author skill hands off to the validator; the
validator is also useful standalone when reviewing any ADR Enforcement table.

## Activating them

They are plain skills — no build step. Make them available to an agent by placing
them where it looks for skills:

```bash
# per-repo (this or a consuming project):
cp -R skills/eess-author-rule skills/eess-validate-faithfulness .claude/skills/

# or globally for all your projects:
cp -R skills/eess-author-rule skills/eess-validate-faithfulness ~/.claude/skills/
```

(Symlinking instead of copying keeps them in sync with this repo as the source of
truth.) A consuming repo like an app governed by its own ADRs gets the same
author→validate loop by copying these two directories in.

## Provenance

The validator's judgment prompt was evaluated 4/4 on a controlled set (two
faithful clause↔rule pairs, two with injected drift — a vacuous rule and an
under-enforcing one), catching each correctly with cited evidence, and it
surfaced a real escape-hatch gap in this repo's own ADR-002 rule. The worked
cases are embedded in the validator skill as examples.
