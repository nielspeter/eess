# Plan 0346: a finding is identified by the code it matched

## Status

- **State:** Draft — Phase 2's direction is taken (**E**: the matcher checks the file,
  2026-10-06, after [spike 0390](../spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md));
  the rest of its design is open and laid out by its own time-boxed spike for a decision. What remains is the
  split into six records; this plan then closes as their parent (see "The split"). Phase 1's ruling is settled
  and measured; the migration is unbuilt, and it decides whether this fix is honest. Refreshed 2026-10-05 against `main`. Review of that
  refresh found that Phase 2's producer list was the symptom: the cause is one kernel
  derivation.
- **Priority:** High — a baseline that forgives a finding nobody reviewed is a false
  green. 0338 reaches the default floor through `identifyMatches`. 0388 was probed on
  `no-empty-bodies`, which ships at `warn`. (An earlier
  version said this closes "the last known way" eess lies about green from its floor.
  0388 was found the same day, so the plan no longer claims that.)
- **Effort:** Large — not one PR. Phase 1 changes eess-ts's match identity and needs a
  migration; Phase 2 adds a file check to both baselines' matchers, with its grouping and
  the consumers it re-keys laid out first by the Phase 2 spike for a decision, a record of its own (spike 0390
  measured the options but did not settle them); an ADR is written. **It is split into plans of about one PR each** — see
  "The split" below. The cost to adopters is unmeasured.
- **Created:** 2026-09-28
- **Receives:** [bug 0338](../bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md),
  whose `## Fix` carries the derivation and the spike. This plan builds it — **and
  does not close it.** 0338 keeps its own box for the `PropertyAssignment`
  sub-problem, which none of these phases addresses, so the record stays open after
  this plan ships. Said explicitly because a reader would otherwise assume the
  opposite, and two Out-of-scope items below are homed on boxes in a record that
  must therefore not be frozen.
- **Receives also:** [bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md),
  which Phase 2 fixes and closes. It also receives **collision 3** of
  [bug 0159](../bugs/0159-violation-identities-collide-across-distinct-findings.md),
  the `beImported` orphans, which is one row of 0388. Its KNOWN-GAP test,
  `packages/ts/tests/core/a-baselined-orphan-forgives-the-next-one.test.ts`, flips.
  **This plan does not close 0159.** Collisions 1 (`dependency.ts`) and 2 (duplicate
  bodies) across runs, and the question whether sibling-dialect producers collide, stay
  in 0159. Phase 1 does not touch `dependency.ts`, so 0159's pointer at this plan for
  them is narrowed in the same PR.

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
- **The surface is smaller than it sounds.** Measured over 400 files of this repo
  (by an earlier review round; the instrument was not kept, so the figure cannot be
  re-run as stated and the builder re-measures it),
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

## Phase 2 — a baseline entry matches only the file it was written for

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
was this section's whole fix. **Superseded below:** the same fault is in the kernel's
fallback, so a per-producer identity treats one instance of it.

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

### The cause is the kernel's fallback, not a list of producers

The paragraphs above were written about module absence alone. The 2026-10-05 refresh
probed five more producers with the same shape as module absence, and found that
all six collide. It
proposed to patch them one by one. Enforcement review then showed that the shape was
not the cause. The measurements and their method are in
[bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md).
In short:

- A baseline entry hashes `rule::subjectOf(v)`, and with no `identity` the subject is
  `element::message`. **The file is never in it.**
- Twelve conditions were measured forgiving the same finding in a different file. They
  include `classes().should().extend()` and `functions().should().beExported()`,
  which repeat on a shared declaration name rather than a basename.
- A list of producers is the ADR-009 Rule 5 enumeration this plan rejects for kind
  names (above): it is built from what was in front of the reviewer, and the next
  producer reopens it. The first version of the list also left out
  `moduleUseInsteadOf`'s absence half, in a file it already named.

**Measured in [spike 0390](../spikes/0390-a-or-e-where-the-file-enters-a-findings-identity.md):**
A (the file in the hash) and E (the matcher checks the file) both close all 12 cases. On 400
findings from this repo, A moves 315 of 315 identity-less entries; the E variants move few or none.

**Decided 2026-10-06 by the maintainer: E — the baseline matcher checks the file each entry
records**, in both the kernel and eess-ts baselines, for a finding whose `file` is not empty.

**The rest of Phase 2's design is open, on purpose.** Three review rounds each found another
path where the variant then specified forgives something today's code reports (spike 0390,
"Edits, and E+" and "Where this leaves the decision"). On 2026-10-06 the maintainer chose to
record what is proven here and settle the rest in a time-boxed spike at the start of the Phase 2
plan, rather than in this record. The same day, method review applied the working rule that a
task needing a decision before it can be built is split into a spike and a build, so that spike
is now its own record (see "The split").

**Proven (each with the variants it was measured under):**

- Checking the file closes the 12 cases.
- **`accepted` lists need the file.** A list of subjects records no file, so it forgives a
  fixed-and-replaced finding in another file (measured under today's code, E and E0). Comparing
  `file::subject` closes it, measured under E+ **with absolute paths** — that is bug 0389's
  defect, not its fix. Bug 0389 landed the root-scrubbed subject on 2026-10-06; the scrubbed `file::subject` form Phase 2 needs is still unmeasured. Existing `accepted` strings stop matching and escalate to error, which fails
  closed.
- **Under per-file grouping, an entry with no recorded `file` must not match** a finding that
  has one: letting it through was measured greener than today there. Under E0, letting it
  through behaves as today, and failing closed also reports the unchanged finding; which rule
  applies is part of question 1.
- **The diagnosis must name the file, not blame the rule.** Measured under E0 in the 0388 case,
  on a rename and on a new duplicate in another file, and under E+ on the new duplicate (its
  0388 and rename rows are inferred, not measured): `filterNew` adds the
  description-change meta-finding ("the rule was edited", `was` and `now` identical) and its Fix
  is "regenerate the baseline", which forgives the new finding again. The cause is
  in `renamedRuleFor` (`packages/ts/src/helpers/baseline-diagnostics.ts:54-64`): once the matcher
  checks the file, `hasEntry` is false for a hash match in another file, and the lookup
  `knownSubjects.get(hashSubject(…))` that follows has no file in its key, so the match reads as
  "the rule was renamed". eess-ts cannot accept a single entry, so no
  remedy may be an unqualified regenerate.
- **Every red test drives `filterNew` or `check({ baseline })`**, not `isKnown`: the spike's first
  probes called `isKnown` and missed the line above.
- **A renamed file is reported again** under every E variant, measured for findings without an
  identity (question 5 covers the rest). Today a rename is silently still accepted.

**Open — the Phase 2 spike lays these out for a decision before any Phase 2 code:**

1. **Grouping.** Leaving it unchanged (E0) only adds a condition, so it cannot be greener than
   today, but it falsely reports a reviewed finding when a duplicate across files is edited
   (fix `a` and the reviewed `b` is reported; add an earlier-sorted duplicate and every later
   sibling is reported). Grouping per file reports the right files on those edits, and removes a
   false green today's code has, but still emits the misattributed description-change finding on
   a new duplicate (until the diagnosis fix), and lets the same hash legitimately appear more
   than once.
2. **Every consumer keyed by hash alone.** Under per-file grouping each must be keyed by
   (hash, file), or it changes meaning. Found by review so far, not by a census: the
   accepted-measurement map (a metric ceiling that worsened was forgiven, measured), the
   regenerate summary (`+0` where today prints `+1`, measured), findings with an empty `file`
   (forgiven, measured), the `hasEntry` readers behind the diagnoses, and the Phase 3 migration
   join. **The spike's first output is the census**, from the code, before any comparison.
3. **A baseline with no recorded root.** Turning the check off was measured greener than today
   under per-file grouping. The other options — match nothing, or compare against the
   rediscovered root and fail closed only where that cannot be done — were not measured. The
   severity, and what the remedy re-forgives, are the maintainer's to decide.
4. **The attribution's discriminator.** "Is the recorded file still in the run" mislabels a
   mistake copied into a new file. Candidate: whether the recorded entry still matched a finding
   in this run.
5. **Identity-bearing and metric findings that move file.** The check applies to them too; their
   rename rows were not measured.

**Candidate break classes**, which the spike confirms per variant: the file check (once per
baseline, separate code), the `accepted` file comparison, the missing-file rule, the
recorded-root comparison, separator normalisation (a baseline written with `\` still matches on
POSIX), the file-naming attribution (the 0388 fixture reports `b`, no description-change finding,
and a Fix that is not "regenerate"), and, if grouping is per file, the edit rows (each asserting no description-change finding too)
and one row per re-keyed consumer, including the escalation text at
`deferredWarningMessage` (`packages/ts/src/core/terminal-builder.ts:149`), which explains a cross-file collision
per-file grouping removes. They are Tier-2 suite rows; the replacement case below is also a
`check:nonvacuity` row. This repo keeps no baseline, so its own gates never exercise the matcher.

**Preconditions (recorded while A and E were both open; updated 2026-10-06 where marked):**

- [bug 0389](../bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md),
  fixed 2026-10-06 as spike 0392's C5: `accepted` matches a raw subject or a portable form that
  names the repository (`<root:NAME>/path`, whole path tokens). It is an input to the
  Phase 2 spike, not its answer: spike 0392 measured it for `accepted` only, and the spike decides
  the key. The substring scrub `portableSubjectOf` keeps for the hashes is bug 0391's. For builders that name no project, `accepted` still compares raw subjects.
- The grouping key equals the hash key only if every copy uses one definition. Kernel
  `hashViolation` used to inline its own fallback; since bug 0389 both hashes go through
  `portableSubjectOf` (`packages/core/src/baseline.ts:129`). Still open:
  `packages/ts/src/core/terminal-builder.ts:97` re-spells `groupKeyOf`, and moves to the shared
  function.
- A finding with an empty `file` keeps today's `element::message` form; nothing
  discriminates better, and it should not move for nothing.
- Within one file the sibling dialects still merge collisions: the kernel `applyFilters`
  never runs `disambiguateIdentities`. That is
  [plan 0188](./0188-unify-the-duplicated-engine-modules.md)'s, not this phase's; neither option
  closes it, and the ADR says so.

**The guard is structural, not a fixture per condition.** A suite cannot write a
violating fixture for a condition it has never seen, so "every exported condition over
two files" was a list after all. Instead: a property test that two findings differing
only in `file` are distinct to the matcher **across runs**: baseline one, present only the
other, and require it reported. A within-run version is vacuous: a baseline written
from both findings accepts both whether or not the file check exists. Plus a check that a
producer-set identity for a finding about a file names it. That is what covers a new producer
on arrival.

**`element` stays as it is.** `reverse-dependency.ts` already records why:
`.excluding()` matches on `element`, so promoting it to a path would silently break
every `.excluding('index.ts')` in the wild. That is
[bug 0387](../bugs/0387-a-basename-exclusion-waives-every-file-with-that-name.md)'s
problem, and it stays there. This phase changes the identity, not what an exclusion
sees.

**Where a producer does set an identity, it is built from data, not message text.**
`dependency.ts` records why: the message is prose and may be reworded. Each pin also
asserts zero `identityCollisions()` for its rule, with Phase 1's three conditions.

**Files:** `packages/core/src/violation.ts`, `packages/core/src/baseline.ts`
(including its comment at `:11`), `packages/ts/src/helpers/baseline.ts` (including its
comment at `:86`; both document a "rule + file" identity the hash does not implement),
`packages/ts/src/core/terminal-builder.ts` (`accepted`, and the re-spelled group key at
`:94`). The kernel is public API (ADR-011), so the changeset names every dialect that
depends on it (bug 0185).

## Phase 3 — the migration must not become the lie

**Every existing entry for an unnamed match changes identity.** The naive
instruction — "regenerate your baseline" — makes the upgrade itself the deception
this plan exists to remove: an adopter regenerates, every finding is re-forgiven,
and the ones that were already inheriting are forgiven permanently and silently.

So the upgrade ships a **migration that carries forward exactly what is forgiven
today**: read the old baseline, re-run, and for every finding compute **both** its
old-scheme and new-scheme identity. Match each baseline entry by its **old-scheme
hash and its recorded file**, which is what "matched" means once Phase 2 ships, and write
the new-scheme one. Nothing new is forgiven, because every new entry is derived from an
entry that already matched. A join on the hash alone would bring 0388 back: the entry
written for `a` would be carried onto `b`. What the migration does with a baseline that records
no root follows Phase 2's no-root rule, which is open; it must not be a hash-only join, which
would carry exactly this inheritance forward. Break class: the 0388
fixture, then `--migrate`, then `b` is still reported.

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

**`HASH_VERSION` is bumped.** Without it no baseline can be identified as unmigrated,
and `--migrate` cannot tell which scheme a file is in. The v5 precedent bumped it when
an input moved, which is what happens here.

**Regeneration is a door, and it has to be shut or named.** A plain `baseline` run on
an old-scheme file writes new-scheme entries for everything it sees, and that
re-forgives every inheritance. Today it prints only an informational line
(`packages/ts/src/helpers/baseline.ts:589-597`). Generating over a baseline whose
version is older is refused unless `--migrate`, or an override named in the flag
itself, is passed. **The refusal lives in `generateBaseline`, not only in the CLI**, so
the programmatic door is shut too; that is a new throw in public API, and the changeset
says so. Both ends get a test, and a non-vacuity row that reds when the refusal is
deleted.

**`check` against an old baseline is one finding, not N "new" ones:** "baseline is
version 5; run `--migrate`". Under E this is eess-ts only: Phase 1 changes eess-ts's
identities, and E changes no kernel hash, so the kernel baseline (which has no version,
`packages/core/src/baseline.ts:85`) gains the file check and nothing to migrate.

**One door cannot be shut, and the release notes name it:** deleting the file and
generating afresh is indistinguishable from first use, and it re-forgives everything.

**Its shape is prescribed, not chosen.** ADR-009 Rule 1's migration corollary
rules out the obvious design: _"The obvious way to ship a gate that will fail
existing code is 'warn in release N, fail in release N+1,' and it does not work for
the same reason rule 1 exists: the release that only warns is the release nobody
reads."_ It names the honest version — **an explicitly invoked diagnostic the
consumer runs**, not a warning hoped to be read. So the migration is a command an
adopter runs deliberately, and the upgrade fails until they have.

**No carried entry is proven correct, and the command must not imply otherwise.** An
earlier draft said an old-scheme bucket with **one** finding is "provably exact".
Enforcement review showed that is false for the very defect this plan fixes.
Inheritance across runs needs no second member: the entry was written for
`a/index.ts`, and today the only member of its bucket is `b/index.ts`. The same holds
for one top-level `eval` that was fixed and replaced.

**What can be seen as wrong is not carried.** `BaselineEntry.file` is recorded, so an
entry whose matched finding is now in a **different file** was inherited, or the file
was renamed. Enforcement review showed that carrying it with a note re-keys the one
group the migration can see is wrong into an acceptance that looks reviewed, and erases
the evidence. So those K entries are **not carried**: their findings report as new,
and a renamed file costs a regenerate whose diff is reviewed. (Under option E the matcher already does this,
and K is always zero for a baseline that records its root.) The command exits non-zero
while K or J is above zero.

An entry in a slot that `disambiguateIdentities` suffixed (`subject#n`) is ambiguous:
to match it at all, the migration replays the **old** grouping and suffixing over each
whole batch, in production order, and names those J entries. It also rewrites each
entry's stored `subject`, not only its hash. An entry whose single match is in the
**same file** may still have been inherited, and nothing can detect that; the command
says so in a count and a sentence. The report reads: _"N carried; K moved files and are
reported as new; J were positional and are named; the remaining L cannot be shown
either way"_.

That is ADR-009 Rule 2 — every failure carries its own sanctioned remedy — and a
remedy an adopter can act on beats one they can only worry about. (Review cited a
clause "identities, never a bare total" for this; it does not exist in `adr/` or
`docs/`, so the justification here is Rule 2 and the argument above, not that
quote.)

**The honest limit that remains, which must be in the release notes and in the
command's own output:** for any entry it does not name, the migration cannot
distinguish one that was correctly forgiven from one that had already inherited a
different finding. It freezes the current
state, wrong entries included. The only way to be sure is to read them — and the
command must say so rather than implying the migration made the baseline correct.
That is ADR-009 Rule 2: every failure carries its own sanctioned remedy, and a
remedy that overstates what it achieved is not one.

**Files:** a `baseline --migrate` path in eess-ts (under E the kernel baseline has no
hash to migrate); the migration page for this plan's own release after 0.12; and the
changeset. The old derivation ships beside the
new one for one release, and a baseline older than that is refused by name.

## Phase 4 — the ruling gets an ADR, written last on purpose

Per [bug 0330](../bugs/0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md),
a binding rule the next change must follow does not belong in a bug record that is
about to be frozen. **A new ADR — a finding is identified by the code it matched.**
It takes the next free ADR number when this phase is written. On 2026-10-05 that
would be 019, but the number is not written anywhere else in this plan, because it
went stale once already: an earlier draft said ADR-016, which is now Bounded
Instruments.

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
- a finding about a file is matched by its file (Phase 2). Not "every finding": a
  slice cycle edge or a duplicate cluster belongs to no single file, and a finding with
  an empty `file` keeps today's key

Each needs a mechanism named before the ADR is written, so that "no `pending` rows"
cannot turn into "drop the clauses that can't be gated":

- the shape clause: the seven-edit table plus the `identityCollisions()` pin;
- the line clause: a Tier-1 arch rule over `packages/ts/src/conditions/`, which this
  repo's own gate runs;
- the file clause: Phase 2's structural property test (Tier 2).

**Authored through the prescribed route.** CLAUDE.md prescribes the
`eess-adr-author` skill for translating a clause into a mechanism and
`eess-adr-validate` for the adversarial check, or
`.claude/workflows/adr-enforce.mjs` to run both as separate agents on different
models. That separation matters more here than usually: the ADR's author is also
the builder of the mechanism it binds, so nobody would otherwise be checking the
translation who had not written it.

**Files:** `adr/NNN-…md`, the ADR index table in `CLAUDE.md`, `README.md`'s ADR
table if it lists them.

## The split

Six records, about one PR each, grouped by what each one closes:

1. **Bug 0389 — `accepted` compares a portable subject.** A live defect on its own, and the
   precondition for 3's `accepted` change.
2. **The Phase 2 spike**, its own record ([spike 0394](../spikes/0394-the-phase-2-design-for-a-file-aware-baseline.md)), time-boxed to one working day. It answers the five open
   questions above: first a census, from the code, of every consumer keyed by hash alone; then E0
   against per-file grouping across that whole census; then the options for a baseline with no
   recorded root, for the maintainer to decide. It ends in a design brought back for a decision,
   not in code. Its review found that its `accepted` decision contradicts its grouping decision,
   so that part moved to
   [spike 0395](../spikes/0395-what-an-accepted-entry-without-a-file-does-under-per-file-grouping.md),
   time-boxed to half a day, which the build plan waits for.
3. **The Phase 2 build**, a plan written from the spike's decision: the file check in both
   baselines, `accepted` comparing `file::subject`, the missing-file rule, and a diagnosis that
   names the file, in one change. Closes bug 0388 and 0159's collision 3. It merges **before 4**, because 4's migration joins on what it defines as a match, and both
   merge to an integration branch that reaches `main` once, because per-file grouping moves entries
   only the migration carries over (spike 0394's decision 3). Its own advice names `--migrate`,
   which 4 adds, so its ledger records that as `deferred→` 4.
4. **Phases 1 and 3 — the shape identity and its migration** (bug 0338's identity, `--migrate`,
   the `HASH_VERSION` bump, the refusal to regenerate over an older version; its ledger also
   re-checks the no-root remedy once regenerating over an older version is refused). Together because
   Phase 1 is what moves entries, and shipping it without the migration would leave regenerating
   as the only path.
5. **Phase 4 — the ADR**, last, once 3 and 4 have mechanisms to cite.

**How this plan closes.** The Phase 2 build plan can only be written from the spike's decision,
so this plan stays open, as a Draft, until then. Once all six records exist, every open box here is disposed
`deferred→<the record that now owns it>`, and this plan moves to `completed/` as the parent of
the split. It does not become one of the six.

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
  This plan is upstream of that decision and does not make it. Spike 0386 links back
  to this plan.

## Success

- Baseline two top-level `eval` calls, fix the first, add a different one — **the
  new one is reported.** Today it is accepted silently; this is the headline case
  and it fails before the fix.
- The seven-edit table from 0338's spike, as a test: identity survives reformatting,
  insertion above, comments, sibling renames and code movement; it breaks when the
  matched code changes and when one is fixed and another added.
- Two files sharing a basename, each missing the same thing: accepting one does not accept
  the other **across runs**. (Within one run they are separated today by the positional
  `#1`; how they are separated after Phase 2 depends on the grouping decision.)
- **The cross-run case, for every exported condition rather than a list:** baseline the
  finding in one file, fix it, make the same finding in another file, and the second is
  reported. 0388's table is its first rows. 0159's KNOWN-GAP test is one of them, and
  it flips.
- An adopter's existing baseline migrates without forgiving anything new, and the
  command says what it cannot promise.
- Every finding added here **fails** (except, possibly, the no-root finding, whose severity is the
  open decision above), and by ADR-009 Rule 1's discriminator rather
  than by blanket rule: each one has a single correct answer, so none of them is a
  finding the reader is expected to judge. (An earlier draft of this plan said
  "nothing added here warns" as an absolute, which contradicts Rule 1's own
  carve-out and ADR-003's first-class `.warn()`.)
- **The baseline gets a non-vacuity fixture, the way every gate has one.** It must be
  the **replacement** case, not just a new finding. A finding with its own message is
  reported today and would still be reported with the identity work deleted, which
  proves nothing. So: baseline finding X, remove X, plant a different finding Y that
  falls in X's old bucket (same file and kind for Phase 1; the same finding in another
  file for Phase 2), and require Y reported. It is a new row in `scripts/check-nonvacuity.mjs`,
  the first for the baseline **filter** (the existing baseline rows probe the floor and
  the emitter door), so `check:nonvacuity` runs it. Delete the
  identity work and the fixture reds. A baseline that cannot be shown to still
  fail is exactly the green-that-tests-nothing this repo spent ADR-010 and
  `check:nonvacuity` removing — and it is the one filter that never got the
  treatment.

## Progress ledger

- [x] Phase 2 — the maintainer's decision recorded here before any Phase 2 code: **E**,
      2026-10-06, measured in spike 0390. Phase 4's ADR carries it
- [ ] Phase 4 — the ADR, authored via `adr-enforce.mjs` so author ≠ validator
- [ ] Phase 4 — **no `pending` rows** when it closes, which is why it is last
      (plan 0263 is the precedent for what a `pending` row costs later)
- [ ] Phase 1 — shape composed **into** the identity, pinned by the seven-edit
      table AND by the cross-declaration case review measured
- [ ] Phase 3 — the migration joins on the old-scheme hash and the recorded file, never on
      the line
- [ ] Phase 3 — the report names the ambiguous buckets, not a blanket disclaimer
- [ ] Phase 1 — the ts-morph version recorded beside `hashVersion`, and
      `unmatchedBaselineFinding` able to name it as a cause once something moved
- [ ] Phase 1 — retire or re-measure `match-identity.ts`'s _"Measured over 596
      matched nodes in a real 808-file project, this is 1:1"_, and rewrite its
      opening line, which claims an identity "that is not a coordinate" for a
      population where it is one. Whoever builds this reads that file.
- [ ] Phase 2 — the spike: a census of every consumer keyed by hash alone, E0 against
      per-file grouping across it, and the no-root options laid out for the maintainer
- [ ] Phase 2 — the matcher checks the recorded file in both baselines, `accepted` compares
      `file::subject`, missing data fails closed; guarded by the cross-run structural
      property test
- [ ] Phase 2 — the diagnosis names the file: no description-change finding on a hash
      match in another file, and a remedy per cause, never a blanket regenerate
- [ ] Phase 2 — if grouping is per file, the `taken.add` guard and the bug-0065 pins
      re-homed to same-file fixtures
- [ ] Phase 2 — the identity-bearing and metric rename rows measured before the Phase 2 build
      plan is Ready
- [x] Phase 2 — bug 0389 fixed first: one `portableSubjectOf`, used by every hash and
      by `accepted` (fixed 2026-10-06, the first record of the split)
- [ ] Phase 2 — both "rule + file" comments say what the matcher covers
- [ ] Phase 3 — the refusal and `--migrate` are eess-ts's; the kernel baseline gets the
      file check only, unless the grouping decision moves kernel hashes
- [ ] the plan split into the six records in "The split", and every open box here disposed
      `deferred→` its owner
- [ ] Phase 1 — re-measure the "400 files" kind-name figure, or stop resting on it
- [ ] 0388 closed in the PR that ships Phase 2, with the no-root rule's residual named
      in it; 0159's collision 3 recorded as fixed
      and its KNOWN-GAP test flipped, not deleted; 0159's pointer at this plan narrowed to that
      collision
- [ ] 0338's own boxes for what this plan built ticked in the same PR — the record
      stays open for `PropertyAssignment`
- [ ] Phase 3 — `HASH_VERSION` bumped, and regeneration over an older baseline refused
      without `--migrate` or a named override
- [ ] Phase 3 — the migration, and what it cannot promise
- [ ] a `check:nonvacuity` row for the baseline filter itself — the replacement case,
      not a new finding
- [ ] `validation-owed` — the cost measured: how many entries move, on a real
      adopter baseline. **This plan cannot discharge this box.** Measured: this
      repository keeps no baseline at all (`check:baseline` runs the floor live at
      0 violations), so the input is a third party's tree. Named here rather than
      left to look tickable — and it must not gate the freeze, because nothing
      this plan does can produce it.
- [x] the `.excluding()` / `eess-exclude` question gets a record, or a recorded
      reason it dissolves — homed 2026-10-05 in spike 0386 and Proposed ADR-018
- [ ] a changeset — breaking: Phase 1 moves every unnamed-match entry; Phase 2 adds
      reports for entries matched across files, and `accepted` strings change form
- [ ] `npm run validate` green

Deferred: the three Out-of-scope items, each with a home — two on bug 0338's
`PropertyAssignment` box, one on spike 0386 and Proposed ADR-018. One box is
`validation-owed` and says so — the migration's cost can only be measured on an
adopter's baseline, and this repository has none.
