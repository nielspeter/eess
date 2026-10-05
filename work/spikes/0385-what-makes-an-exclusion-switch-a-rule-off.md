# Spike 0385: what makes an exclusion switch a rule off?

Measured 2026-10-05 for
[bug 0233](../bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md), after its
first fix failed review and was withdrawn before it was pushed.

## The question

0233 decided a clause before anyone built it:

> An exclusion that suppressed every violation a rule produced is a configuration finding,
> not a silence.

The first fix implemented exactly that — and fired on **10 of this repo's own rules**. Every
one was a legitimate allowlist: `eess/no-process-env` excluding the two files that are the
environment boundary, `eess/no-dead-modules` excluding the package entry points,
`eess/max-methods` excluding the builder classes. Each produced violations, every one of them
was excluded, and each still guards the code: a new `process.env` read anywhere else reds.

So "every violation was excluded" is not the property 0233 is about. The question for this
spike is which property is — before deciding, because the answer sets what eess treats as a
check that has been turned off, and that is close to the centre of what eess is for.

## What eess is for, as it bears on this

- **A green gate must mean something.** The manifesto's promise; ADR-009 rule 1: _"a check
  that cannot fail is worth less than no check."_
- **The primary consumer is an agent, and agents do not read warnings** (ADR-009, Context).
  Whatever the answer is, it cannot be a stderr line.
- **An agent under pressure takes the shortest path to green.** ADR-009 rule 3's corollary:
  _"A marker an agent can stamp on any file to go green is worse than no marker, because it is
  a silent, one-line diff. Prefer exclusion by construction … over any list, marker, or flag."_
- **A pass is constructed from evidence** (ADR-010). `.excluding()` runs after the evidence
  gate, so `{ violations, examined }` cannot see what it removed — the structural blindness
  0233 records.
- **Record the gap, don't fake the gate, ratchet it closed** (manifesto, on baselines). A
  declared, reviewable allowlist is that; a pattern that hides everything is faking the gate.

## Three ways an exclusion makes a red rule green

| shape                                | example                                         | can the rule still fail?            |
| ------------------------------------ | ----------------------------------------------- | ----------------------------------- |
| **universal** — matches anything     | `.excluding(/.*/)`, `/./`, `silent(/.*/)`       | **never**, whatever is written next |
| **scoped** — a folder, a file family | `.excluding(/\/parser\/generated\//)`           | yes, everywhere outside the scope   |
| **named** — the current violators    | `.excluding('OrderRepository')`, `ENTRY_POINTS` | yes, on any new violation           |

Only the first is a check that cannot fail. The other two are declarations of scope: they
waive what they name, in a line a reviewer reads, and the rule keeps guarding everything else.
They can also be abused — an agent can name exactly today's violators to go green — but the
rule still reds on the next one, and that is the ratchet shape the manifesto endorses, not a
switched-off check. Whether a named waiver should carry a reason is a real question; it is a
different one (below).

## What was measured

1. **The production case** ([proposal 007](../proposals/007-ts-expose-terminalbuilder-declared-state.md)):
   a consuming project's tracker records a catch-all exclusion turning a `tsconfig()` floor off
   while every other signal — requirement count, fingerprint, `arch` output — stayed unchanged.
   The shape that fired in practice is **universal**.
2. **This repo's own guidance already names it.** `skills/eess-adr-validate/SKILL.md` lists an
   over-broad `.excluding()` regex (`/./`, `/.*/`) as "the worst case" of vacuity and tells the
   reviewer to "confirm against the gate's count line" — the line 0233 shows cannot see it.
3. **Census of every `.excluding()` literal** in this repo's rule files, preset sources, docs,
   READMEs, skills and kit: 109 sites, 93 literal patterns (24 regex, 69 string). Tested
   against a probe naming nothing real — element, file and message each a sentinel no author
   could have targeted — **2 are universal, both in that skill, as the example of what not to
   do.** No rule file, preset or doc uses one.
4. **The universal trigger, run for real.** In a separate worktree, the withdrawn fix with only
   its trigger changed — fire when a pattern matches the probe, regardless of how many
   violations the rule produced:
   - `check:arch`, `check:spec`, `check:family`, `check:diagram`: **0 findings** (the
     "every violation excluded" trigger: 10).
   - Test suites: `eess-md`, `-mermaid`, `-gherkin`, `-crossvalidate` all green; 1 kernel and
     2 `eess-ts` tests change, and **each uses `.excluding(/.*/)` on purpose** — two to prove
     an unsuppressable finding survives a catch-all (it now also gets the catch-all finding),
     one being the withdrawn fix's own test.
   - String patterns can never be universal: a string matches by equality, so it names one
     target.

## Options

**A. A universal pattern is a configuration finding.** Decided from the pattern alone (Tier 1),
independent of what the rule found today — a catch-all on a currently clean rule is reported
too, because that rule cannot fail either. Unsuppressable; `silent()` does not exempt it.
Covers the measured production case and the skill's named case; fires on nothing this repo
writes. **Gap, stated:** a scoped pattern broad enough to cover nearly everything (`/src\//`)
passes, and a named allowlist is unexamined.

**B. Total suppression must be declared** (0233's original clause, plus an expiring
declaration). Fires on all 10 allowlists here and on every adopter's; each must add the
declaration. It catches broad-but-scoped patterns that happen to cover today's violations, but
the declaration is itself a one-line marker an agent can stamp — rule 3's corollary argues
against it — and it treats a reviewable allowlist as a switched-off check, which it is not.

**C. A, and make every exclusion carry a reason** — as exclusion comments already must (the
kernel reports an `eess-exclude` with no reason). That raises the cost of shapes 2 and 3 for
the reviewer, which ADR-009 rule 3 says is where the enforcement of a waiver really lives. It
is a public API change to `.excluding()` and a separate decision, and it belongs with
[0298](../bugs/0298-an-exclusion-that-absorbs-several-subjects-says-nothing.md), which owns the
partial case (one pattern silently absorbing several subjects).

## Recommendation

**A, now; C as its own decision with 0298.** A is the property ADR-009 rule 1 names — a check
that cannot fail — decided statically, measured to fire on nothing legitimate, and it closes
the case measured in production. B costs every allowlist a marker to defend against a shape
(universal) that A catches outright, and the marker is the thing rule 3 warns against.

The decision belongs in an ADR, not a bug record: it sets what eess treats as turning a check
off, it binds every dialect (both `applyFilters` copies, through one kernel helper), and 0233
and 0298 both need to point at it rather than each carry a version of it.

## What the withdrawn fix leaves

Kept for whichever option is chosen: one kernel helper, called from both `applyFilters` copies
(the direction plan 0188 is unifying them in), and red tests through `tsconfig()`, `classes()`
and eess-md's `docs()`. Only its trigger was wrong. The patch is not in the repo; it is
rebuilt from this record.
