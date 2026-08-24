# Proposal 004 — eess-md / eess-gherkin: A Corpus-Content `explain` Equivalent

**State:** Promoted — → [bug 0219](../../bugs/fixed/0219-corpus-listing-surface-is-undocumented.md), which declares `**Implements:** proposal 004` and owns the documentation this ruling called for. Promoted 2026-08-23. **The ask was never dispatched until then**: the `Docs-only` ruling named a remedy and created no owner, and measured on that date the listing surface appeared in 0 files under `docs/` and 0 package READMEs — ten days after the ruling. Reviewed 2026-08-13 (architect · product · enforcement, plus
survey). Problem **accepted**; primitive **declined** — the capability already
ships in the public API of both dialects and was undocumented. Ruling is
**docs-only**. See _Review_ below — it is the operative section, and everything
after it is preserved as submitted, not as agreed.
**Priority:** ~~Medium~~ → **Low** (review). Not a correctness gap; one incident,
one project, cause a bad `find`, capability already shipped. The submitted
rationale — eess's own stated audience is agents consuming its output in-loop
([`docs/agent-integration.md`](../../../docs/agent-integration.md)) — is why the
_documentation_ gap is worth closing, not why a new primitive is.
**Origin:** **inbound** — authored by an agent working in another project
(a consuming project, not this repo), triggered by a real mistake that project's
human caught, not by this repo's own use.
**Affects:** `eess-md` (`corpus()` / `docs()`), `eess-gherkin` (`features()`);
possibly a shared kernel-level `describe()` shape both dialects implement, so
it composes with `eess-ts explain` rather than becoming a third, differently-shaped
command.

## Problem

`eess-ts` ships `npx eess-ts explain` — a documented, first-class command that
dumps every active rule as structured JSON or markdown, explicitly for "team
onboarding, AI system prompts, and CI auditing" ([`docs/explain.md`](../../../docs/explain.md)).
`eess-md` and `eess-gherkin` have no equivalent for **corpus content** — there
is no documented, stable way to ask "what markdown documents / ADRs / feature
files / scenarios already exist in this corpus," short of hand-rolling shell
commands or reaching for a project-specific check script's incidental
`--verbose` output (not a documented API, not guaranteed to exist on any given
consumer project).

`explain` answers "what rules are configured." Nothing answers "what's actually
in the corpus" — a different, and for an agent about to add content, more
urgent question: before writing a new ADR/plan/feature file, does one like it
already exist? Get this wrong and an agent either duplicates content or makes
a false claim about the corpus's current state.

## Evidence

Concrete incident, 2026-08-13. Needed to answer: does a
`.feature` file already exist anywhere in this repo, before writing one. Reached
for `find . -maxdepth 3 -iname "*.feature"` — returned nothing. Reported to the
human: _"this would be the first `.feature` file in the project."_ Wrong — one
already existed, at `specs/behaviors/features/email-log.feature`, four path
segments deep, one past the `-maxdepth 3` cutoff. The human caught it; the
agent's confident claim about corpus state was false, and the cause was a
generic shell tool with no awareness of eess-md/eess-gherkin's actual root
configuration, not any information genuinely missing from the repo.

The correct answer was one command away — `pnpm gherkin:check --verbose`
prints exactly the feature/scenario inventory (`tools/gherkin-check.ts`'s own
`--verbose` branch) — but finding it required already knowing that flag existed
on that specific project's wrapper script. Nothing in `eess-gherkin`'s own
package surface (checked its README: `diagram()`, `classes()`, fluent
assertions — no listing/explain primitive) offers this generically, so it isn't
portable to a project that hasn't happened to add the same `--verbose` branch
to its own wrapper.

## Acceptance criteria

Added 2026-08-23 by [plan 0218](../../plans/completed/0218-gate-proposal-acceptance-criteria.md).
This proposal was ruled `Docs-only` — the survey found the capability already shipped — so
its one capability is the **documentation**, and stating a break class for it is what would
have stopped the remedy evaporating. It did evaporate: ten days passed with none of it
written and every gate green, which is [bug 0219](../../bugs/fixed/0219-corpus-listing-surface-is-undocumented.md).

| capability                                                                                                                                               | break class — what must go red                                                                                                                                                       | non-vacuity                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| the corpus listing surface is documented — `corpus().documents()`, `.root`, `.fileIndex` in `eess-md`, and `features()`'s `FeatureSet` in `eess-gherkin` | measured before the fix: all three md symbols appeared in **0** files under `docs/` and **0** package READMEs. The standing check is the inverse — a grep for them returning nothing | the added examples are import-bearing TS fences, so `check:docs-code` compiles them and they cannot rot into something that does not typecheck |

**What this does not prove, stated because a `Docs-only` ruling invites exactly this
mistake:** `check:docs-code` compiles the fences that exist and requires none, so deleting
the section is silent. That gap is [bug 0220](../../bugs/0220-nothing-requires-a-public-symbol-to-be-documented.md),
not this proposal's to close — but a proposal whose entire deliverable is documentation
should say which half of it is mechanised.

## Review — 2026-08-13

**Ruling: Docs-only**

Adopt the problem, decline the primitive. The capability
already ships in the public API of the package the incident was about; what was
missing is any documentation pointing at it.

Everything below this section is the submission as received. It is preserved,
not endorsed — where the review falsified a claim, the claim is annotated here
rather than edited away, so the record shows what was argued and what survived.

### What the review accepted

The distinction at _Problem_ — `explain` answers "what rules are configured",
nothing answers "what's actually in the corpus" — is real and useful, and it is
the sentence that correctly locates the gap even while misdiagnosing it as an
API gap. The portability judgement is right too: an answer that lives in one
project's wrapper-script `--verbose` branch is not an answer. And the evidence
is dated, falsifiable, and names its root cause precisely, which is what made
this reviewable at all.

The submission also surfaced a live shipping defect nothing in the gate set
catches — see _The defect this proposal surfaced_ below.

### Why the primitive is rejected as specified

1. **The capability already exists, publicly, in both dialects.**
   `packages/md/src/corpus.ts:36-40` exposes `documents()`, `root`, and
   `fileIndex`; `packages/gherkin/src/load.ts:18-20` exposes `features()` and
   `scenarios()`, with `title`/`keyword`/`relPath`/`line`/`tags` per scenario at
   `packages/gherkin/src/model.ts:12-27`. Both are re-exported
   (`packages/md/src/index.ts:8-9`, `packages/gherkin/src/index.ts:11-13`). The
   proposed `.describe()` is a rename, not new capability.
2. **The CLI half is two new CLIs, not two new subcommands.** Neither package
   has a `bin` key. `eess-ts` and `eess-mermaid` ship seven CLI files apiece,
   and their `load-rules.ts` are already near-duplicates — two more makes four
   copies of this repo's #1 failure mode. The submission costs this as mirroring
   an existing contract.
3. **It relocates the failure rather than closing it.** An agent that picks
   `-maxdepth 3` picks `--roots "docs/**"` and misses `specs/`. Worse, it is
   more dangerous: an agent trusts a tool's output more than its own `find`, so
   a misconfigured inventory yields a _more_ confident false claim than the
   incident it is meant to prevent. The walkers make this concrete — md silently
   drops symlinked files from both `documents` and `fileIndex` and swallows
   unreadable directories (`packages/md/src/corpus.ts:50-65`), gherkin does the
   opposite and throws (`packages/gherkin/src/load.ts:29-36`), and
   `BUILTIN_IGNORE` is invisible to callers in both.
4. **`--roots` breaks the invariant that makes `explain` trustworthy.** Both
   existing implementations load exactly what `check` loads and describe instead
   of executing (`docs/explain.md`: "loads your rule files the same way `check`
   does"), so `explain` cannot disagree with the gate. `--roots` supplies one of
   `CorpusOptions`' four fields (`packages/md/src/corpus.ts:12-28`), so it would
   report frozen documents as live and ignore the project's `ignore` list — the
   `-maxdepth 3` failure class rebuilt inside the tool.
5. **It adds zero new ways to fail a build, and does not say so.** `explain`
   prints; it cannot go red. Delete every `.feature` file and it prints an empty
   list and exits 0. That is legitimate as DX, but _Priority_ argues from
   `docs/agent-integration.md` — a drift-prevention doc — and never states that
   this is not an enforcement mechanism. Tier: none. Proposal
   [001](../001-md-corpus-rule-coverage.md)'s recorded correction is the
   precedent.

### Corrections to specific claims in the text below

- **_Evidence_ commits the error the proposal is about.** "Nothing in
  `eess-gherkin`'s own package surface (checked its README: `diagram()`,
  `classes()`, fluent assertions — no listing/explain primitive)" describes the
  **Mermaid** README (`packages/mermaid/README.md`). `packages/gherkin/README.md`
  is 27 lines, contains neither name, and ships the listing primitive on line 13:
  `features({ roots: ['specs/behaviors/features/**'] })` — the exact directory of
  the file the incident missed. A proposal about agents making confident false
  claims about corpus state contains a confident false claim about corpus state,
  and correcting it falsifies the remedy: the cause was not "no discoverable
  primitive", it was not reading a 27-line README. Recorded rather than fixed,
  so the template learns.
- **_Problem_ frames `explain` as an `eess-ts` command.** It also ships in
  eess-mermaid (`packages/mermaid/src/cli/commands/explain.ts`). So `explain` is
  already a two-dialect convention that generalized once, cleanly, with **zero**
  kernel change — because `describeRule()` lives on the base builder
  (`packages/core/src/rule-builder.ts:176`). A dialect gets `explain` free the
  moment it has a CLI to host it. This partly answers Open Question 1 from the
  tree: `explain` is not the one-off the proposal takes it for.
- **_Proposed shape_'s `--roots "docs/** work/**"` is unsound as an argument
  shape.** Both CLIs use `strict: true` `parseArgs`; no option in either splits a
  string on whitespace or uses `multiple: true`. Whitespace-splitting breaks on
  any path containing a space, and both APIs take `readonly string[]`. If a flag
  survives at all it must be repeatable (`--root a --root b`), never split.
- **_Proposed shape_ puts formatting on the library terminal** ("JSON by
  default, `--markdown` for humans"). ADR-008's principle is that detection
  returns data and the caller owns emission; `.describe()` must return a value,
  with formatting and stdout in the CLI command — which is the side of the line
  both existing `explain` commands are already on.

### Placement

**Docs, not code.** `docs/agent-integration.md` plus the two package READMEs.

Nothing here goes to `packages/core`. The kernel already owns the
element-inventory shape — `Selection<T>` (`packages/core/src/correspondence.ts:16`),
produced by `select()` on the base builder and therefore inherited by every
dialect. A kernel `describe()` for corpus content would be a second inventory
hierarchy beside it, and the first thing pulling dialect concepts inward.
Specifically kept out: `Corpus`/`CorpusOptions`/`MdDocument`,
`FeatureSet`/`GherkinFeature`/`GherkinScenario`, any `roots`/`frozen` notion, and
any widening of `RuleDescription` to carry element inventories.

"Do md/gherkin ship CLIs at all" is a **binding decision** and belongs in an ADR,
not a bullet under a subcommand proposal — with the shared-skeleton question
answered in it, under the constraint that `@nielspeter/eess` has zero runtime
dependencies and a shared rule-file loader needs `jiti`. Sequence it after plan
[0089](../../plans/completed/0089-family-standalone-sufficiency.md), whose Phase 2 wording
("the dialect's CLI/gate works with nothing but the single package installed")
currently reads _gate_ for md and gherkin.

### The defect this proposal surfaced (filed separately)

`explain --format agent` emits its sentinel-wrapped block containing
`_No rules found._` and exits 0 when zero rules load
(`packages/ts/src/cli/commands/explain.ts:69-73`), and
`packages/ts/tests/cli/explain-command.test.ts:237` ratifies that. The recipe at
`docs/agent-integration.md:92` guards with `[ -s … ]`, which tests only for
non-empty — the ~11-line empty block passes it, and the `awk` then replaces the
real rules block in `AGENTS.md` with "No rules found", in the step whose selling
point is that standing instructions "cannot drift from what CI enforces".
`packages/mermaid/src/cli/commands/explain.ts:36-41` has no empty branch at all,
so the two implementations do not agree on the empty case. Filed as bug
[0134](../../bugs/0134-explain-empty-green-wipes-the-agents-block.md); independent
of any ruling here.

### Unresolved, carried forward

- **Open Question 1 (kernel `describe()`) is declined as posed, but a different
  kernel extraction is live and unruled:** a `scanned()` denominator shape —
  roots as given and as resolved, found/matched/unowned counts, the ignore set's
  per-pattern drops, symlink and unreadable-dir skips — which every gate in this
  repo currently hand-rolls (`scripts/check-corpus.mjs:89-130`,
  `scripts/check-crossval.mjs:62-67`). Extract that and an inventory printer is a
  fifteen-line consumer of it in every dialect, and every gate gets a
  non-vacuity denominator for free. Author's call.
- **Open Question 2 (`--list`/`--verbose` convention) is downstream of the ADR
  above** — both shapes require md and gherkin to have CLIs first, so neither
  can be chosen until that decision lands.
- **Open Question 3 (no measurement) stands, and sharpens the priority.** By the
  ROADMAP's scale this is **Low**, not Medium: one incident, one project, cause
  a bad `find`, capability already shipped. Revisit if a second independent
  adopter asks with a use case `git ls-files` does not serve.
- **The break class the incident actually shows is unowned files + dead roots,
  and this proposal does not argue for it.** A `.feature` existed that no
  declared root owned, so no gate ever saw it. Tier 1, statically decidable, and
  smaller than two CLIs: a file with the dialect's extension outside every
  declared root goes red naming the file and the roots that missed it; a root
  glob matching zero paths goes red naming the glob (precedent:
  `packages/core/src/silent-exclusion.ts:19-24`). The denominator is free —
  both dialects already walk the whole tree before filtering. That is a
  **separate proposal**, not a revision of this one.
- **Non-vacuity is structurally impossible for the thing as specified.**
  `gateNode` (`scripts/check-nonvacuity.mjs:252-286`) requires exit 1, and
  `gateCoverage` (`:430-452`) enumerates only `check:*` package scripts, so a CLI
  subcommand is invisible to it — `eess-ts explain` and `eess-mermaid explain`
  already sit in that blind spot. Anything shipped here needs either a failing
  mode or a stated `NO_GATE_NEEDED` waiver so the hole is recorded rather than
  rediscovered.
- **Naming, if the concept is ever revived:** `explain` takes a rule file and
  describes rules; `explain --roots` takes globs and describes content — same
  verb, different object, different argument type. The name is `list`. And
  `describe()` sits confusingly beside the existing `describeRule()`.

## Proposed shape (rough, not a design)

Mirror `explain`'s contract for the two corpus-shaped dialects:

```bash
npx eess-md explain --roots "docs/** work/**"      # documents, sections, tables, ADR index
npx eess-gherkin explain --roots "specs/**"        # feature files + scenario titles
```

or, at the JS level, a `.describe()` terminal on `corpus()`/`features()`
returning the same shape `explain` already returns for rules (JSON by default,
`--markdown` for humans) — so an agent (or a Claude Code hook, per the existing
agent-integration recipes) has one call that answers "what's here" before
deciding whether to add to it.

## Open questions / honest caveats

- Is this actually `eess-md`/`eess-gherkin` scope, or does it belong one level
  up — a kernel-level `describe()` any dialect implements, so `eess-ts explain`
  becomes the first consumer of a shared shape rather than the one-off it is
  today? Not surveyed against ADR-006's dialect boundary.
- Cheaper fix worth ruling out first: is a documented, stable `--list`/`--verbose`
  convention on every dialect's CLI (not a new `explain` concept) sufficient? The
  incident above would have been prevented by _either_ shape — this proposal
  doesn't yet argue one over the other, only that _something_ discoverable and
  documented needs to exist, because the current state (hand-rolled `find`, or
  an incidental flag on someone's wrapper script) demonstrably produces false
  claims about corpus state.
- No measurement of how often this would actually get used vs. `grep`/`find`
  remaining good enough for a human. The evidence here is one agent incident,
  not a survey.
