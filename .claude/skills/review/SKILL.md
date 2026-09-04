---
name: reviewer
description: 'Review code or plans with expert personas. Runs individual or multiple reviewers in parallel. Personas: architect, customer, devops, product, testing, enforcement, method.'
argument-hint: '[all | architect | customer | devops | product | testing | enforcement | method ...] [--diff | --branch | --plan]'
---

# Expert Review

Spawn reviewer agents to evaluate code changes or plans from different expert perspectives.

## 0. Outcome-blindness — the coordinator must not game the review

The reviewers exist to find the truth about the change, not to confirm the
coordinator's (or the author's) hopes. A review whose outcome was steered is
worse than no review: it manufactures the "we looked" the author needs to ship
untested. This is eess's own author ≠ verifier rule (the `adr-enforce` workflow
runs author and validator as **separate agents on different models** so neither
blesses its own work) applied to the review loop. Binding on the coordinator:

1. **Never state a wanted verdict.** The prompt each reviewer receives states
   _what changed_ and _what to review_ — never the author's stance, the desired
   outcome, the plan's claims as premises, or "we think this works." If the truth
   is "this is broken," that is the answer the coordinator wants.
2. **Never coach toward a conclusion.** No "focus on why this is good," no "don't
   worry about X," no corrective nudges during the run that push a persona one way.
   The reviewers judge the artifact against this repo and the binding ADRs —
   nothing else.
3. **Never pre-select personas to get a friendly verdict.** Running `product
testing` but omitting `enforcement` because its findings would block the ship is
   gaming. For gate/plan/ADR reviews the enforcement persona is mandatory (see §1).
4. **Never argue a finding away because it is inconvenient** in the synthesis, and
   never cherry-pick personas' findings to force a `Ship` verdict. A critical that
   blocks stays a blocker; if the coordinator believes it is wrong, the resolution
   is to verify it against the code and say so with the evidence — not to demote it
   quietly.
5. **A review that returns exactly the hoped verdict is not a pass.** If a persona
   comes back confirming the coordinator's prior with zero dissent, treat that as a
   reason to re-run that persona blind, not as confirmation. Same-derivation praise
   is not evidence (ADR-008 review rule 5).

Tell each reviewer in its prompt, verbatim: _"The coordinator has no opinion on
the outcome. Judge the artifact against this repo and its binding ADRs — and if
the truth is 'this is broken', that is the answer. Do not shape findings to what
you think is wanted."_

## 1. Parse Arguments

From `$ARGUMENTS`, extract:

**Personas** (default: `all`; note `all` runs every persona in the table below):

| Keyword        | Agent                  | Short alias  |
| -------------- | ---------------------- | ------------ |
| `architect`    | `reviewer-architect`   | `arch`       |
| `customer`     | `reviewer-customer`    | `cust`       |
| `devops`       | `reviewer-devops`      | `ops`        |
| `product`      | `reviewer-product`     | `pm`         |
| `testing`      | `reviewer-testing`     | `qa`, `test` |
| `enforcement`  | `reviewer-enforcement` | `enf`        |
| `method`       | `reviewer-method`      | `meth`       |
| `all` or empty | (every option above)   |              |

This is an **eess repo**, and two personas are not optional for reviews of its
own work:

- **`reviewer-enforcement`** — the fail-closed lens from the manifesto +
  ADR-008/009. A review of a gate, rule, ADR, or plan that ships a way to fail a
  build must have it.
- **`reviewer-method`** — the lens over the RECORD rather than the code: was a
  stated number measured or asserted, does a comment claim a mechanism that
  exists, does the board agree with the record, did the close ride the PR that
  fixed it. **Mandatory whenever the change touches `work/`, `adr/` or `docs/`**,
  which for this repo is nearly always.

  Added for [bug 0250](../../../work/bugs/fixed/0250-the-review-roster-has-no-working-method-lens.md).
  Before it, a grep of all six personas for that vocabulary returned three
  incidental hits and zero owners — while findings of exactly this class kept
  arriving, caught by whichever reviewer happened to look outside its brief. The
  roster is gated in both directions, so an unowned lens is a hole in a contract,
  not a gap in a convention.

When reviewing this repo's own plans or gate code, run `all` (or at minimum
`architect enforcement method`).

**Review mode** (default: `--diff`):

| Flag                  | What to review                                                                          |
| --------------------- | --------------------------------------------------------------------------------------- |
| `--diff` or (default) | Uncommitted changes (`git diff` + `git diff --cached`)                                  |
| `--branch`            | All commits on current branch vs `main` (`git log main..HEAD` + `git diff main...HEAD`) |
| `--plan`              | The active plan file (from `work/plans/` — this repo's plan lane)                       |

## 2. Gather Context

Run the appropriate git/read commands to collect the review material:

- **`--diff`**: Run `git diff` and `git diff --cached`. If both empty, tell the user there's nothing to review.
- **`--branch`**: Run `git log --oneline main..HEAD` and `git diff main...HEAD`. If empty, tell the user the branch has no changes vs main.
- **`--plan`**: Find the plan file. Check for a `<system-reminder>` referencing a
  plan path, or glob `work/plans/*.md` and pick the most recent / the one named in
  the argument. Read it in full — an eess plan is a Draft with phases, a test
  inventory, an Out-of-scope section, and a progress ledger.

Keep the context summary **brief** — file names changed + a high-level description. Each agent will read the actual files themselves.

## 3. Spawn Reviewers

For **each selected persona**, spawn an Agent using the corresponding `subagent_type`:

```
Agent(
  subagent_type: "<agent-name>",   // e.g. "reviewer-architect"
  description: "<Persona> review",
  prompt: "<review task prompt with context>"
)
```

The prompt to each agent should include:

1. The review mode and what changed (file list, commit summary, or plan reference)
2. Instructions to read the relevant files/diffs themselves
3. Request to structure findings as: **Critical** / **Important** / **Minor** / **Praise**
4. **Abstain instruction**: If the changes are outside the persona's domain and they have nothing meaningful to contribute, they should abstain with a single line (e.g., "No architecture concerns — abstaining.") rather than forcing low-value findings
5. **Outcome-blindness line** (verbatim, every prompt): _"The coordinator has no opinion on the outcome. Judge the artifact against this repo and its binding ADRs — and if the truth is 'this is broken', that is the answer. Do not shape findings to what you think is wanted."_ (This is §0 rule 5; the reviewer must not be able to infer the coordinator's hoped verdict from any hint.)
6. **eess repo note** (only when reviewing this repo's own code/plans): remind the agent this is the eess monorepo — the binding ADRs in `adr/`, the manifesto in `docs/manifesto.md`, and the plan lane in `work/plans/`. Personas already carry eess grounding; the extra reminder is so they actually read the ADR/plan before judging.

7. **Deliverable instruction** (verbatim, every prompt):

> "**How to deliver.** Only your FINAL message reaches the coordinator. Nothing you write mid-run is
> delivered — not a review you emit and then keep working past, not a summary inside your reasoning.
>
> So: the moment your findings are ready, write the complete review as one message and **STOP**. Do not
> call another tool after writing it. Do not verify one more thing, tidy a worktree, or re-read a file
> — a tool call after the review means the review was not your final message and the coordinator
> receives nothing.
>
> Budget your run so this always happens. If you are running long or approaching a limit, stop
> investigating immediately and emit what you have, marking unfinished threads as such. **A partial
> review that arrives beats a thorough one that does not.** Returning nothing is the single worst
> outcome — worse than a shallow review, worse than an abstention.
>
> Your final message is the review itself: the complete findings, not a status note, not a promise, not
> a file path pointing at them."

**IMPORTANT**: If multiple personas are selected, spawn ALL agents in a single message (parallel execution). Do NOT spawn them one at a time.

**Isolation**: reviewers run concurrently against one checkout and several will want to run gates or sabotage patches. Tell each: _"Do not modify the shared working tree. If you need to patch, build or run a sabotage matrix, use `git worktree add` on a temp path and work there; clean it up before you write your review."_ Without this, one reviewer's probe files and sabotage edits land in another's gate run — and in the user's `git status`.

### The response contract (why nobody goes silent)

Both sides agree to this before spawning. It exists because a reviewer that
returns nothing is the single worst outcome — worse than a shallow review, worse
than an abstention — and the recovery must be procedural, not hopeful.

**The reviewer commits:**

- I will always emit _something_. A partial review with unfinished threads marked
  beats a thorough one that never arrives.
- My final message is the complete review, or an explicit one-line abstention. A
  "done"/"review complete"/empty stub is NOT a response — it is a failure I owe the
  coordinator to recover.
- If I approach a limit, I stop investigating and emit what I have.

**The coordinator commits:**

- Every selected persona gets a row in the Review Summary — its verdict, its
  abstention, or **"no report received"** (never omitted, never silently dropped).
- Before concluding "no report received," I attempt the JSONL recover below, in
  order, and only then do I mark the persona unrecoverable. I never fabricate or
  soften a finding to make the outcome convenient, and I never file my own
  analysis under a persona's heading without saying so (§0).
- What counts as "responded": a structured review (Critical/Important/Minor/
  Praise) OR one line of abstention. Anything else is a stub and is handled by
  stub recovery.

### Recovering a reviewer that returned nothing

A reviewer that goes idle without delivering has usually **already written the review** as an intermediate message and then kept working past it. Do not re-run the review and do not report "no findings" — go read what it wrote:

```
~/.claude/projects/<project-slug>/<session-id>/subagents/agent-<name>-<hash>.jsonl
```

Extract the assistant text blocks (`message.role === 'assistant'`, `content[].type === 'text'`) and take the last substantial one — that is the review. Only if the transcript genuinely contains no findings (the agent was still mid-investigation when it stopped) is the persona "no report received".

**Stub returns**: if a reviewer comes back with a stub — a bare "done"/"review complete", an empty result, or output missing the Critical/Important structure (an explicit one-line abstention is fine) — recover it the same way: read the transcript first, then message the agent asking for the findings verbatim, and only respawn if both fail. Never synthesize around a missing report, and never silently drop the persona: if it stays unrecoverable, the synthesis lists it as "no report received".

## 4. Synthesize

You are the **gatekeeper**, not a relay. Reviewers supply findings; you decide what is real. Before
promoting any finding to Critical or acting on it, verify it against the code yourself — reviewers
report plausible-but-wrong findings, and a persona's confidence is not evidence. Equally, do not demote
a finding because you did not find it first — and never demote one because it is inconvenient (§0).

Never present a synthesis as though reports arrived when they did not. If you did the analysis yourself
because a persona returned nothing, say so plainly and up front, rather than filing your own work under
a heading that implies a panel agreed.

After all agents return, write a synthesis:

### Review Summary

For each persona, show a one-line verdict (e.g. "Architect: 0 critical, 2 important, 1 minor"). If a persona abstained, show "Abstained — no relevant concerns". If a persona's report was unrecoverable, show "no report received" — never omit the row. The **enforcement** row is mandatory for reviews of this repo's own gates/plans (a review of a gate without the enforcement lens is incomplete), and the **method** row is mandatory whenever the change touches `work/`, `adr/` or `docs/` (a review that read the code and not the record it ships with is incomplete the other way).

### Critical Issues (must address)

Deduplicated list of critical findings across all reviewers.

### Important Concerns (should address)

Deduplicated list of important findings.

### Minor Suggestions

Brief list, grouped if overlapping.

### Praise

What the reviewers liked — important for morale and reinforcing good patterns.

Keep the synthesis concise. Don't repeat the full agent outputs — the user already saw them.
