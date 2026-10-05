# Plan 0346: a finding is identified by the code it matched

## Status

- **State:** Draft — the ruling is settled and the mechanism is measured; what is
  unbuilt is the migration, and it is the part that decides whether this fix is
  honest. Refreshed 2026-10-05 against `main`: Phase 2 widened from one producer to
  the six a probe measured colliding, the ADR renumbered, the exclusions question
  homed.
- **Priority:** High — it closes the last known way eess lies about green from its
  own default floor, and the 0.8.0 release widened the population it reaches.
- **Effort:** Medium — one derivation changed, one ADR written, one migration
  command. The cost is unmeasured: every existing baseline entry for an unnamed
  match moves.
- **Created:** 2026-09-28
- **Receives:** [bug 0338](../bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md),
  whose `## Fix` carries the derivation and the spike. This plan builds it — **and
  does not close it.** 0338 keeps its own box for the `PropertyAssignment`
  sub-problem, which none of these phases addresses, so the record stays open after
  this plan ships. Said explicitly because a reader would otherwise assume the
  opposite, and two Out-of-scope items below are homed on boxes in a record that
  must therefore not be frozen.
- **Receives also:** [bug 0159](../bugs/0159-violation-identities-collide-across-distinct-findings.md)'s
  open half — `beImported` orphan findings. Phase 2 is the fix, and **this plan closes
  0159** when it ships: the record's KNOWN-GAP test,
  `packages/ts/tests/core/a-baselined-orphan-forgives-the-next-one.test.ts`, flips.

## Problem

A baseline entry identifies a finding so eess can tell "the one you forgave" from
"a new one". For a match with nothing named around it — a bare `eval` at file
scope, a `catch` in module scope — `getElementName` answers with the node's
**kind**, so every such match in a file shares one bucket and is separated only by
its **position** in it.

Forgive two, fix the first, add a different one: the new one takes the freed slot
and the build stays green. **Nobody ever reviewed it.**

**The consumer is what makes this the modal case, not an edge case.** eess's
audience is AI coding agents, and "fix the flagged thing, add a new thing" is
ordinary agent behaviour rather than an unlucky sequence.

How it must be reported is already settled, and not by this plan.
[ADR-009](../../adr/009-agent-first-failure-surfaces.md) Rule 1: **"A finding
whose remedy is not optional must fail the build."** The discriminator it names is
whether the remedy is optional — a finding the reader is expected to judge _should_
warn, and `recommended` ships two rules at warn deliberately for that reason. A
finding with one correct answer must fail. "Your baseline forgave a thing nobody
reviewed" has one correct answer.

### This is the vacuity problem, one organ over

The non-vacuity work — ADR-010, `examined`, the vacuity findings,
`check:nonvacuity`'s planted violations, the sabotage matrices — exists because
**a green test that tested nothing is a lie**. A rule that examined 0 subjects
used to report a pass, and the answer was that a pass must be _constructed from
evidence_ rather than defaulted to.

A baseline-filtered green is the same lie with the evidence one step further
away. The rule did examine subjects. It did find a violation. Then a filter
removed it — and nothing checks that the filter removed **the finding it was
written for**. The run reports green and the evidence for that green belongs to a
different piece of code.

So the machinery already exists and the gap is that it stops at the filter:

|                           | a rule                                | a baseline                                     |
| ------------------------- | ------------------------------------- | ---------------------------------------------- |
| what must be evidenced    | it examined something                 | it forgave the thing it was written to forgive |
| what carries the evidence | `{ violations, examined }` (ADR-010)  | nothing                                        |
| what proves it can fail   | `check:nonvacuity` plants a violation | nothing                                        |

**Both rows on the right are this plan's work.** Phase 1 makes the identity strong
enough for the second column to mean anything; the fixture in `## Success` is the
planted violation the baseline has never had.

### The ruling is derived, not chosen

Recorded in full in 0338's `## Fix`. Three clauses in the binding documents select
it:

1. `docs/manifesto.md` on baseline mode — "record the gap, don't fake the gate,
   ratchet it closed". A positional entry records gap A, forgives gap B, and keeps
   the count flat while the problems rotate.
2. [ADR-009](../../adr/009-agent-first-failure-surfaces.md) Rule 3's corollary —
   "a marker an agent can stamp on any file to go green is **worse** than no
   marker… Prefer exclusion **by construction**." A positional entry is that
   marker, and the agent does not even have to stamp it.
3. [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md) — a pass
   inherited from a different finding's evidence is a default wearing evidence's
   clothes.

**Identity comes from the matched code's AST shape.** Never position, never line.

A spike scored four candidates over seven edits — five a baseline must tolerate,
two where it must break. Node shape is the only one that is **7/7** (position 5/7,
raw text 6/7, line 3/7). The table is in 0338.

## Phase 1 — identity gains the node's shape; it does not trade the scope away

`identifyMatches` (`packages/ts/src/conditions/match-identity.ts`) composes
`kind::filePath::getElementName(node)::matcherDescription#ordinal`.

**Compose the shape in; do not replace the scope term.** An earlier draft of this
plan said "replace", and architecture review measured what that costs. The scope
term does two jobs and the draft had evaluated one — its own docstring says so:
_"Bucketing by declaration is what keeps that blast radius local, so it is
load-bearing rather than cosmetic — a single per-file counter would renumber
everything downstream of any edit."_

Dropping it collapses byte-identical matches in **different** declarations into one
per-file positional sequence, which is this bug's own headline symptom relocated:

|                  | baselined                          | after "fix `runEval`, add `added`" | reported new                 |
| ---------------- | ---------------------------------- | ---------------------------------- | ---------------------------- |
| today            | `runEval::eval#1`, `other::eval#1` | `other::eval#1`, `added::eval#1`   | `added::eval#1`              |
| replace-the-term | `shape#1`, `shape#2`               | `shape#1`, `shape#2`               | **none — silently accepted** |

So the terms are complementary, not alternatives: **scope** discriminates across
declarations and keeps a renumbering local to the declaration that changed;
**shape** discriminates within a bucket. Composed —
`kind::file::scope::shape::matcher#ordinal` — every row of the spike's 7/7 holds
and the row above stays green. For a match with nothing named around it the scope
term degenerates to the node's kind exactly as today, and shape carries the whole
discrimination, which is precisely the population this bug is about.

**The trade this keeps, stated rather than made silently:** renaming the enclosing
declaration still moves the entry. That is today's behaviour and buying
rename-stability by dropping scope costs the table above, so it is not bought here.

The ordinal survives, **and that is not a compromise**: two byte-identical matches
in the same declaration are genuinely interchangeable, so there is no fact to tell
them apart and forgiving one for the other is not a lie. The defect is a
_different_ problem inheriting a forgiveness, and shape closes exactly that.

**Hash the shape before composing it in** — `scope::sha256(shape).slice(0,16)` —
which settles three things at once, and architecture review supplied the reason I
had not seen:

- **Delimiter safety.** The shape is the first component that can contain the `::`
  separator: a string literal does it (`eval('a::b')` → `StringLiteral('a::b')`).
  Scope cannot — it is identifiers joined by dots. Today no collision is reachable
  only because `matcherDescription` is constant within one `identifyMatches` call,
  so the ambiguous `shape::matcher` boundary never has two values to confuse. That
  is incidental, not designed.
- **Ordering stops mattering**, so `scope` before `shape` becomes a readability
  choice rather than a correctness one.
- **Length.** An earlier draft of this paragraph listed the key's length as an open
  question "because baselines are committed files". **That premise is false and is
  removed:** the identity string never reaches the file — `hashViolation` composes
  it and stores a 16-character digest — and it is rendered nowhere, not in
  `format-json.ts`'s payload nor in any emitter. Verified.

**What remains open — reframed by architecture review, and the reframe is better
than the question.** Embedding ts-morph's kind names does couple an adopter's
baseline to a ts-morph upgrade, and hashing does not fix that. But:

- **The "hides it" cost is zero at the artifact level.** `hashViolation` already
  digests the whole identity before anything reaches the baseline file, so the
  cause was never readable at the moment it bites. Detection had to come from
  elsewhere regardless.
- **A stable kind→string map is the wrong answer**, and for an ADR-009 Rule 5
  reason: it is an enumeration derived from what is in front of you. Every kind not
  in the map needs a fallback, the only fallback is the raw kind name, and that
  reintroduces the coupling for exactly the new and renamed kinds the map exists to
  protect against. The map is then a second artifact to keep in sync — the coupling
  wearing a hat.
- **The surface is smaller than it sounds.** Measured over 400 files of this repo,
  the shapes for the four matched root kinds embed **4 root kind names** and **51
  leaf-token kind names**, and the leaves are almost all punctuation and keywords
  plus `Identifier`/`StringLiteral`/`NumericLiteral`. TypeScript renames node kinds
  occasionally; it does not rename those.
- **No release gate of ours can catch it.** `packages/ts/package.json` pins
  `"ts-morph": "^27.0.2"` — a caret on a runtime dependency, so a 27.x bump lands in
  an adopter's lockfile without eess releasing anything. That is _why_ detection
  belongs in the baseline file.

**So the question is not "prevent the coupling with a vocabulary" but "name it as a
cause when it fires".** Record the resolved ts-morph version beside `hashVersion`,
and let `unmatchedBaselineFinding` offer it as a candidate cause **once the
measurement says something moved** — the pattern already in
`packages/ts/src/helpers/baseline.ts`, which keys on the overlap first and refuses
to name a version when nothing actually did move. It needs no enumeration and it
cannot rot. **Not blocking Phase 1 either way.**

**The pin cannot be `new Set(ids).size`.** `disambiguateIdentities` guarantees a
rule's findings have distinct identities, which — measured and recorded in
`packages/core/src/violation.ts` — _"silently turned every
`new Set(hashes).size === findings.length` assertion in the suite into a tautology.
Measured: collapsing `duplicate-bodies.ts`'s identity to a literal constant — the
worst producer defect available — left all 234 files and 3178 tests green."_

So the suite provably cannot see a producer-identity collapse, and
`tests/conditions/match-identity.test.ts` · `it('keeps two different declarations
with an identical match distinct')` would stay green through the regression above:
the ordinal supplies the distinctness its title claims for the scope term.

**The instrument is `identityCollisions()`** (`packages/core/src/violation.ts`,
exported from `packages/core/src/internal.ts`) — the channel built for this, per its
own docstring: _"the guards must keep measuring the producer, and after this
mechanism the only way to do that is to ask what the mechanism had to repair."_
An earlier draft of this plan named `disambiguatedSubjects`, which **does not
exist**; enforcement review caught the invented name.

Three conditions, or the pin becomes the thing it guards against:

1. **It needs its own denominator.** The collection is module-global and
   reset-based, so `expect(identityCollisions()).toHaveLength(0)` passes trivially
   when read before the rule ran, or when the run produced no findings. Assert zero
   collisions **and** the expected finding count, in one test.
2. **Zero globally is too strict — zero for the rule under test is right.**
   Legitimate disambiguation exists today in the edge and metric families, whose
   durable per-finding identity is still open work. Entries carry
   `{ rule, subject, findings }`; filter on `rule`.
3. **It proves within-run distinctness, not stability across edits.**
   `disambiguateIdentities` groups per `applyFilters` call, so this and the
   seven-edit table are two halves and neither substitutes for the other. Both are
   required, and the greener pin must not quietly replace the harder one.

**Call sites worth naming, because they differ.** `body-analysis-module.ts` calls
`identifyMatches` once **per file**, so its ordinal spans the file;
`body-analysis-function.ts` calls it once **per function**. Under a
replace-the-term change the second produces byte-identical identities across
functions that `disambiguateIdentities` then repairs into whole-file positional
slots — a wider blast radius than the module case, and the reason composing is not
optional.

**Files:** `packages/ts/src/conditions/match-identity.ts`, its callers.

## Phase 2 — give the file-level absence findings the identity they already hold

**This phase said the opposite until enforcement review measured it, and the
inversion matters: the first version would have hurt adopters to fix nothing.**

It read: these findings have no matched node, so Phase 1 cannot reach them,
therefore `baseline` should refuse them under ADR-009 Rule 3. Both halves are
wrong.

**"No matched node" is not "no identity available."** An absence finding is about a
**file**, and a file path is a producer identity in this plan's own vocabulary: it
survives every tolerate-row of [spike 0350](../spikes/0350-which-baseline-identity-survives-the-right-edits.md)
— reformatting, insertion above, comments, unrelated renames, code movement — and
breaks only when the file or the requirement changes. It is a reference, not a
coordinate.

**And the code already holds it, then throws it away.**
`packages/ts/src/conditions/body-analysis-module.ts` sets
`file: sf.getFilePath()` on the very object whose `element` is `sf.getBaseName()`
and whose message is built from the basename. `subjectOf` falls back to
`element::message` when no `identity` is set, so **every `index.ts` in a project
shares one subject** and `disambiguateIdentities` repairs the collision into
positional slots — this plan's own defect, in the one path it proposed to make
unbaselineable rather than fix.

Setting `identity` to `module-absence::${sf.getFilePath()}::${matcher.description}`
is the whole fix.

**The precedent is this defect, already fixed once this way.** Bug 0063 was a
dependency identity colliding across files sharing a basename, and it was closed by
putting the path into the identity — not by refusing. Its pin is
`packages/ts/tests/conditions/dependency-identity-collision.test.ts` ·
`it('the identity names the file, and does not name a line')`.

**What refusing would have cost.** An adopter with a legitimately accepted absence
finding gets a hard failure they cannot baseline. The predictable response is to
turn the rule off — the whole rule goes dark, which is strictly worse than one
positional entry. The first draft also never named the "sanctioned alternative" its
own ADR-009 Rule 3 citation promises, and under Rule 2 that remedy must be real and
behaviourally proven to clear the finding, which cannot be written for an
alternative that does not exist.

**On refusal in general.** ADR-009 Rule 3's shape still holds for a producer that
genuinely cannot identify a finding — but this plan will not build a mechanism for
a population it cannot name. If such a population is found while building, it earns
its own record.

**If a refusal is ever built, it must be two-ended.** Enforcement review measured
that a writer-side refusal alone is one JSON edit from being bypassed:
`Baseline.isKnown`/`filterNew` would still honour a hand-written entry, or one
generated by 0.8 and carried across the upgrade. The repo's own pattern for "never
forgiven" does both ends — `generateBaseline` filters `bypassFilters` so it is
never written, **and** `filterNew` re-keeps it so an older or hand-edited file
cannot resurrect the suppression.

### Six producers, measured — not one

The paragraphs above were written about module absence alone. Re-checked on
2026-10-05, the same shape — basename `element`, basename message, no `identity` —
is in more producers than that one, so the question was which of them **collide**
rather than which look alike. A probe ran each condition twice over
`src/a/index.ts` and `src/b/index.ts`: run 1 has `a` violating, the baseline is
written, and run 2 has `a` fixed and `b` violating. Then it asked whether `b` is
reported.

| condition                    | site                      | `b` reported? |
| ---------------------------- | ------------------------- | ------------- |
| `notHaveDefaultExport`       | `exports.ts`              | **no**        |
| `haveDefaultExport`          | `exports.ts`              | **no**        |
| `moduleContain` (absence)    | `body-analysis-module.ts` | **no**        |
| `haveNoUnusedExports`        | `reverse-dependency.ts`   | **no**        |
| `beImported` (bug 0159)      | `reverse-dependency.ts`   | **no**        |
| `onlyBeImportedVia`          | `reverse-dependency.ts`   | **no**        |
| `moduleNotContain` — control | carries a node identity   | yes           |
| `haveMaxExports` — control   | carries a path identity   | yes           |

The controls show the probe can tell the two apart. `onlyBeImportedVia` is the
least obvious: its message names the importer's path, so it is safe for two
importers of one file. But the **target** appears only by basename, so the same
importer moving from `a/index.ts` to `b/index.ts` inherits the entry.

**Bundled because they share the root cause and one change closes them.** Every one of
them is fixed by setting `identity` to a kind tag plus `sf.getFilePath()` plus
whatever already discriminates within the file, which is the message's non-basename
part. All six also move baseline entries, so they go through Phase 3's single
migration. Shipping them separately would mean shipping two migrations. Said here
so the grouping can be overruled.

**`element` stays the basename.** `reverse-dependency.ts` already records why: `.excluding()`
matches on `element`, so promoting it to a path would silently break every
`.excluding('index.ts')` in the wild. That is [bug 0387](../bugs/0387-a-basename-exclusion-waives-every-file-with-that-name.md)'s
problem, and it stays there. This phase changes the identity, not what an
exclusion sees.

**Not probed:** `cross-layer.ts`'s two file-level findings (`haveMatchingCounterpart`,
`haveConsistentExports`). By construction their messages name files by basename too,
but two files with the same basename inside one layer is a narrower case and has
not been run. Whoever builds this probes them first. They join this phase only if
they collide, and otherwise the record says why not.

**Files:** `packages/ts/src/conditions/body-analysis-module.ts`,
`packages/ts/src/conditions/exports.ts`,
`packages/ts/src/conditions/reverse-dependency.ts` (and `cross-layer.ts` if its
probe says so).

## Phase 3 — the migration must not become the lie

**Every existing entry for an unnamed match changes identity.** The naive
instruction — "regenerate your baseline" — makes the upgrade itself the deception
this plan exists to remove: an adopter regenerates, every finding is re-forgiven,
and the ones that were already inheriting are forgiven permanently and silently.

So the upgrade ships a **migration that carries forward exactly what is forgiven
today**: read the old baseline, re-run, and for every finding compute **both** its
old-scheme and new-scheme identity. Match each baseline entry by its **old-scheme
hash**, and write the new-scheme one. Nothing new is forgiven, because every new
entry is derived from an entry that already matched.

**Not by line.** An earlier draft said "match each old entry to the finding at its
recorded position", which architecture review caught: `BaselineEntry.line` is
documented as _"informational, not used for matching — they drift as code moves"_.
It records where a finding was when the baseline was last **generated**, so joining
on it would carry entries onto the wrong findings for any adopter whose code has
moved — that is, every adopter. It would also make the migration's join key the
positional identity this plan exists to abolish, at the one moment a wrong join is
invisible and permanent.

**An entry that matches no old-scheme identity is reported, not dropped.** It is
either a finding that has been fixed since the baseline was written, or one whose
code changed — and both are things the adopter should see rather than have silently
discarded.

**Its shape is prescribed, not chosen.** ADR-009 Rule 1's migration corollary
rules out the obvious design: _"The obvious way to ship a gate that will fail
existing code is 'warn in release N, fail in release N+1,' and it does not work for
the same reason rule 1 exists: the release that only warns is the release nobody
reads."_ It names the honest version — **an explicitly invoked diagnostic the
consumer runs**, not a warning hoped to be read. So the migration is a command an
adopter runs deliberately, and the upgrade fails until they have.

**The limit can be narrowed from the whole file to a named list**, and the data is
already in the same run — architecture review's improvement on the first draft. An
old-scheme bucket holding exactly **one** finding is provably exact: there was
nothing for it to inherit from. Only buckets with two or more members could have
mis-forgiven. So the command reports _"N of M entries carried forward exactly;
these K sit in ambiguous buckets"_ **and names the K**, rather than printing a
blanket warning over everything.

That is ADR-009 Rule 2 — every failure carries its own sanctioned remedy — and a
remedy an adopter can act on beats one they can only worry about. (Review cited a
clause "identities, never a bare total" for this; it does not exist in `adr/` or
`docs/`, so the justification here is Rule 2 and the argument above, not that
quote.)

**The honest limit that remains, which must be in the release notes and in the
command's own output:** for entries in an ambiguous bucket, the migration cannot
distinguish one that was correctly forgiven from one that had already inherited a
different finding. It freezes the current
state, wrong entries included. The only way to be sure is to read them — and the
command must say so rather than implying the migration made the baseline correct.
That is ADR-009 Rule 2: every failure carries its own sanctioned remedy, and a
remedy that overstates what it achieved is not one.

**Files:** a `baseline --migrate` path or a one-shot script, the migration page
for the release this ships in (`docs/migrating-to-0.12.md` while 0.12.0 is still
unreleased, otherwise a new page for the next release), and the changeset.

## Phase 4 — the ruling gets an ADR, written last on purpose

Per [bug 0330](../bugs/0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md),
a binding rule the next change must follow does not belong in a bug record that is
about to be frozen. **ADR-019 — a finding is identified by the code it matched.** (The
number is the next free one on 2026-10-05: 016 and 017 are taken and 018 is held in Proposed.
Re-take it when this phase is written.)

**It is last, not first, and an earlier draft had it first.** Method review named
the cost: an ADR written before its mechanisms exist lands every row of its
Enforcement table at `pending` by construction — and this repo has already paid
that bill once. `work/plans/completed/0263-adr-014s-residual-enforcement-rows.md`
is a five-phase plan across four PRs whose entire job was clearing ADR-014's
`pending` rows, closing on "ADR-014 ends with **no `pending` rows**". Writing
the ADR after Phases 1–3 means each row cites a mechanism that exists and lands
`gated`.

Clauses to enforce, at minimum:

- identity is derived from the matched node's shape; position appears only to
  separate byte-identical shapes within one scope
- no condition may mint an identity from a line number
- a producer with a path available puts it in the identity, rather than leaving
  the subject a basename (Phase 2)

**Authored through the prescribed route.** CLAUDE.md prescribes the
`eess-adr-author` skill for translating a clause into a mechanism and
`eess-adr-validate` for the adversarial check, or
`.claude/workflows/adr-enforce.mjs` to run both as separate agents on different
models. That separation matters more here than usually: the ADR's author is also
the builder of the mechanism it binds, so nobody would otherwise be checking the
translation who had not written it.

**Files:** `adr/019-…md`, the ADR index table in `CLAUDE.md`, `README.md`'s ADR
table if it lists them.

## Out of scope

- **The element _name_ for an object-literal match.** A throw in
  `const routes = { objectHandler: () => … }` is _displayed_ against the file
  because `enclosingScopeName` cannot name an arrow held in a `PropertyAssignment`.
  Phase 1 fixes its **identity**; what remains is the displayed name and what
  `.excluding()` matches on. Separable, and it stays on 0338 as its own box.
- **Sharing the name derivation with `arch-function.ts`.** The good name exists
  (`owningBindingName` plus the collected key path) and is module-private. This is
  **already the second candidate inside that same 0338 box**, not a new deferral —
  the box lists teaching `getStructuralName` and sharing this derivation as its two
  options.
- **Whether `.excluding()` and `// eess-exclude` should key on identity too.**
  Now homed in [spike 0386](../spikes/0386-strings-that-name-code.md), which asks
  whether a waiver should identify a **container** or a **violation**. It finds the
  second choice depends on this plan: violation identity has to be trustworthy first.
  The decision is held in Proposed
  [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md)
  and [bug 0233](../bugs/0233-an-exclusion-that-suppresses-every-violation-is-silent.md).
  This plan is upstream of that decision and does not make it.

## Success

- Baseline two top-level `eval` calls, fix the first, add a different one — **the
  new one is reported.** Today it is accepted silently; this is the headline case
  and it fails before the fix.
- The seven-edit table from 0338's spike, as a test: identity survives reformatting,
  insertion above, comments, sibling renames and code movement; it breaks when the
  matched code changes and when one is fixed and another added.
- Two files sharing a basename, each missing the same thing, produce **distinct**
  baseline entries — accepting one does not accept the other. Today they collide
  and are separated by position.
- **The cross-run case, for each of Phase 2's six producers:** baseline `a/index.ts`,
  fix it, break `b/index.ts`, and `b` is reported. This is the probe's table turned
  into tests. 0159's KNOWN-GAP test is one row of it, and it flips.
- An adopter's existing baseline migrates without forgiving anything new, and the
  command says what it cannot promise.
- Every finding added here **fails**, and by ADR-009 Rule 1's discriminator rather
  than by blanket rule: each one has a single correct answer, so none of them is a
  finding the reader is expected to judge. (An earlier draft of this plan said
  "nothing added here warns" as an absolute, which contradicts Rule 1's own
  carve-out and ADR-003's first-class `.warn()`.)
- **The baseline gets a non-vacuity fixture, the way every gate has one.** Plant a
  new finding in a baselined file and require the run to report it; delete the
  identity work and the fixture reds. A baseline that cannot be shown to still
  fail is exactly the green-that-tests-nothing this repo spent ADR-010 and
  `check:nonvacuity` removing — and it is the one filter that never got the
  treatment.

## Progress ledger

- [ ] Phase 4 — ADR-019, authored via `adr-enforce.mjs` so author ≠ validator
- [ ] Phase 4 — **no `pending` rows** when it closes, which is why it is last
      (plan 0263 is the precedent for what a `pending` row costs later)
- [ ] Phase 1 — shape composed **into** the identity, pinned by the seven-edit
      table AND by the cross-declaration case review measured
- [ ] Phase 3 — the migration joins on the old-scheme hash, never on the line
- [ ] Phase 3 — the report names the ambiguous buckets, not a blanket disclaimer
- [ ] Phase 1 — the ts-morph version recorded beside `hashVersion`, and
      `unmatchedBaselineFinding` able to name it as a cause once something moved
- [ ] Phase 1 — retire or re-measure `match-identity.ts`'s _"Measured over 596
      matched nodes in a real 808-file project, this is 1:1"_, and rewrite its
      opening line, which claims an identity "that is not a coordinate" for a
      population where it is one. Whoever builds this reads that file.
- [ ] Phase 2 — the six measured producers carry a path-based identity, each pinned
      cross-run (fix `a`, break `b`, `b` reported) and the way bug 0063's was
- [ ] Phase 2 — `cross-layer.ts`'s two file-level findings probed: joined if they
      collide, recorded why not if they don't
- [ ] 0159 closed in the PR that ships Phase 2 — its KNOWN-GAP test flipped, not
      deleted
- [ ] Phase 3 — the migration, and what it cannot promise
- [ ] a `check:nonvacuity` row for the baseline filter itself — plant a finding
      behind a baseline and require it reported
- [ ] `validation-owed` — the cost measured: how many entries move, on a real
      adopter baseline. **This plan cannot discharge this box.** Measured: this
      repository keeps no baseline at all (`check:baseline` runs the floor live at
      0 violations), so the input is a third party's tree. Named here rather than
      left to look tickable — and it must not gate the freeze, because nothing
      this plan does can produce it.
- [x] the `.excluding()` / `eess-exclude` question gets a record, or a recorded
      reason it dissolves — homed 2026-10-05 in spike 0386 and Proposed ADR-018
- [ ] a changeset — breaking; every baseline moves
- [ ] `npm run validate` green

Deferred: none. One box is `validation-owed` and says so — the migration's cost can
only be measured on an adopter's baseline, and this repository has none.
