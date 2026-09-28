# Bug 0338: a match with no enclosing declaration has a positional identity, and a baseline accepts the wrong one

## Status

- **State:** Draft — measured by two reviews of PR #149 and reproduced against the real
  `generateBaseline` / `filterNew`. The fix is a decision about what makes a finding identifiable.
- **Severity:** High — **false green with a baseline**, in the default floor. Baseline two top-level
  `eval` calls in one file, fix the first and add a different one below it: the **new** call is
  accepted silently. The same shape holds for the file-level absence findings, which carry no
  identity at all: baseline `index.ts` missing something, fix that file and break a different one,
  and the new breakage is accepted.
- **Origin:** the enforcement reviews of PR #149, 2026-09-20 — first as the weakest identity in the
  system, then confirmed on the delta after the silent-catch half was fixed.
- **Reported:** 2026-09-20

## Symptom

Measured on PR #149's build:

| what is baselined, then changed                                                     | reported as new |
| ----------------------------------------------------------------------------------- | --------------- |
| two top-level `eval`s in one file; fix the first, add another below                 | **none**        |
| a top-level `eval` in file A; delete it, add one in file B                          | one (correct)   |
| two silent catches in one file; fix the first, add another                          | **none**        |
| `moduleContain` absence findings in two files; fix one, break the other differently | **none**        |

The cross-file direction was fixed by PR #149 (each identity carries its file). The **within-file**
direction was not, and the absence findings were never in scope.

**A second, narrower instance, measured by bug 0337 (2026-09-26).** A match can have an enclosing
function that the module-scope namer still cannot name. `enclosingScopeName` names a class, an
interface, a function declaration, a member, and an arrow assigned to a **variable** — but not an
arrow held in a `PropertyAssignment`, which is the handler-map shape agents generate constantly.
Measured on `tests/fixtures/presets/handler-map`: a `throw new Error()` inside
`const routes = { objectHandler: () => … }` is `routes.objectHandler` under a function subject and
**`handlers.ts`** under a module subject. So widening a rule to module scope does not only expose
matches with no enclosing declaration — it **degrades** the identity of matches that had a perfectly
good one, because two namers disagree about the same node. `models/arch-function.ts` already derives
the good name (`owningBindingName` + the collected key path); `core/violation.ts` has no access to it,
and adding a second derivation of it is the failure this repository spends most of its guards on.

**0337 also measured how much widening a preset costs here**, which is the number this record lacked:

| the edit, through `agentGuardrails` after 0337                       | silently accepted | reported new |
| -------------------------------------------------------------------- | ----------------- | ------------ |
| baseline two **top-level** `eval`s; fix the first, add another below | **2**             | **0**        |
| the same edit with each `eval` in its own **named function**         | 1                 | **1**        |

Two presets now reach this, not one.

## The mechanism already documents this failure as the thing it exists to prevent

`packages/ts/src/conditions/match-identity.ts` opens: _"Assign each matched node a
baseline identity **that is not a coordinate**."_ It then states this bug exactly,
as its own reason for existing:

> _"add two lines at the top of a file with matches at lines 2 and 4, and the entry
> recorded for line 4 now matches the violation that used to be at line 2 — the
> baseline accepts the **wrong** finding, rather than merely missing one. That is
> worse than a miss, because it silently keeps a genuinely new violation green."_

And it names the defence: _"bucket by the enclosing declaration, then number the
matches inside each bucket."_ The defence fails for the population this record is
about, because when nothing named encloses the match `getElementName` answers with
the node's **kind**, so the bucket degenerates into the per-file counter the same
docstring says it was written to avoid.

The file carries a measured claim about that defence — _"Measured over 596 matched
nodes in a real 808-file project, this is 1:1"_ — which is false over this
population, and whose figures are unreachable for anyone wanting to recheck them.
Retiring or re-measuring it is a box on
[plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)
Phase 1.

## Root cause

`identifyMatches` (`packages/ts/src/conditions/match-identity.ts:44`) buckets by
`getElementName(node)` and appends an ordinal within the bucket. For a match with no enclosing named
declaration — a call at top level, a catch in module scope — `getElementName` answers with the
node's KIND (`CallExpression`, `CatchClause`), so every such match in a file shares one bucket and
is told apart only by position. That module's own docstring rejects a per-file counter; for these
matches it degenerates into one.

The file-level findings in `packages/ts/src/conditions/body-analysis-module.ts:44` and `:157` set no
`identity` at all, so their baseline subject is `element::message`, and the message names the file
without a line.

Before bug 0333 the floor read function bodies only, so none of these positions was reported and the
bucket did not exist. Widening what the floor reads is what made a weak identity reachable from the
default preset.

## Fix

**Ruled 2026-09-28. Half of it was already decided; the other half is measured —
and an earlier version of this section did not separate the two.**

- **Derived from the documents:** a positional entry is not an identity, and
  neither is a line. This is not a preference.
- **Measured, not derived:** that the _node's shape_ is the form of identity that
  survives the edits a baseline must tolerate. The documents require a producer
  identity rather than a coordinate; they do not name this one. **Any derivation
  scoring 7/7 on [spike 0350](../spikes/0350-which-baseline-identity-survives-the-right-edits.md)
  would satisfy them equally.**

Enforcement review caught the overclaim: the first version said three clauses
"select the answer", which is true of the exclusion and false of the selection.

### What the documents say

1. **The manifesto, on baseline mode** (`docs/manifesto.md`): "record the gap,
   don't fake the gate, ratchet it closed." A positional entry does the opposite
   of all three — it records gap A and forgives gap B, the gate is green for code
   nobody reviewed, and the count stays flat while the problems rotate.
2. **ADR-009 Rule 3's corollary**: "an escape hatch is not automatically safer
   than none. A marker an agent can stamp on any file to go green is **worse**
   than no marker, because it is a silent, one-line diff. Prefer exclusion **by
   construction** (structure the scope so the exception cannot arise) over any
   list, marker, or flag." A positional entry is that marker, and worse than the
   one the rule describes: the agent does not have to stamp it, it transfers on
   its own.

   **It proves less than the first version of this record claimed.** Read strictly,
   "over any list, marker, or flag" condemns a shape-keyed baseline entry as
   readily as a positional one — a baseline is a list either way. What the
   corollary establishes is the _ordering_: an entry that transfers without anyone
   touching it is worse than one that does not. It rules a positional entry out; it
   does not rule a shape-keyed entry in, and this record no longer says it does.
   (Enforcement review, which called the original framing proving-too-much.)

3. **ADR-010**: a pass is constructed from evidence. A pass inherited from a
   _different_ finding's evidence is a default wearing evidence's clothes.
4. **And the one this record first missed** — `packages/core/src/violation.ts`,
   which states the question directly and was cited nowhere:

   > _"a positional suffix makes an entry a **slot**, while a producer identity
   > makes it a **reference**, and only the latter survives a sibling being
   > deleted."_

   That is this bug in one sentence, written down before it was filed. It names the
   remedy's shape — a **producer** identity — without naming its form, which is
   exactly the derived/measured split above.

And the audience decides the weight. eess's consumer is an AI agent, and
"fix the flagged thing, add a new thing" is not an edge case for that audience —
it is the modal behaviour. This is the failure mode the tool exists to prevent,
reachable from its own default floor.

**So: identity must be a producer identity rather than a coordinate — never a
position, never a line.** Which producer identity is the measured half, and this
record's answer is the node's shape. Line-fallback is ruled out outright — a line number is a
property of the file's formatting, not of the code.

### The spike: which identity actually survives the right edits

A baseline identity has two duties, and they pull against each other: it must
**survive** edits that do not change the finding, and **break** when the finding
changes. Four candidates, seven edits — the run, its script and its caveats are
[spike 0350](../spikes/0350-which-baseline-identity-survives-the-right-edits.md).

_It was filed because of this record._ The table was cited as evidence in three
places while the script that produced it had been deleted, and method review
refused it on this repo's own standard: an unreproducible measurement is a claim,
whatever was actually run.

| edit                         | must survive? | position   | line        | matched text | node shape |
| ---------------------------- | ------------- | ---------- | ----------- | ------------ | ---------- |
| reformat (whitespace)        | yes           | kept       | kept        | **broke ✗**  | kept       |
| insert a line above          | yes           | kept       | **broke ✗** | kept         | kept       |
| add a comment above          | yes           | kept       | **broke ✗** | kept         | kept       |
| rename an unrelated binding  | yes           | kept       | kept        | kept         | kept       |
| move the match down          | yes           | kept       | **broke ✗** | kept         | kept       |
| **change the matched code**  | **no**        | **kept ✗** | **kept ✗**  | broke        | broke      |
| **fix the first, add a new** | **no**        | **kept ✗** | broke       | broke        | broke      |
| **score**                    |               | **5/7**    | **3/7**     | **6/7**      | **7/7**    |

**Node shape is 7 of 7.** It is the node's kind plus its leaf tokens' text —
`CallExpression|Identifier(eval)|OpenParenToken|…|StringLiteral('a')|…` — so
formatting outside a string cannot move it and whitespace _inside_ one is
preserved (`eval('a b')` and `eval('ab')` are correctly distinct).

Raw matched text scores 6/7 and fails only on reformatting, because normalising
whitespace by regex cannot tell code from string contents. That is the reason to
derive from the AST rather than the source text, and it is the whole difference
between the two columns.

### Position survives, in exactly one place, and that is not a compromise

Two **byte-identical** matches in one file still need separating, and the shape
identity gives them the same key. The spike measures this: `eval(x)` twice yields
`…#1` and `…#2`.

That residue is correct rather than tolerated. Two identical problems in one file
**are** interchangeable — forgiving one and having the other inherit it is not a
lie, because there is no fact that distinguishes them. The defect this record is
about is a _different_ problem inheriting a forgiveness, and shape identity
closes it: `eval('a')` and `eval('b')` no longer share a bucket, so fixing the
first and adding `eval('c')` reports the new one.

### What is still open

The ruling is settled and the mechanism is proven. What is not measured:

- **The cost.** Every existing baseline entry for an unnamed match changes
  identity, so they all unmatch on upgrade and their findings return as new. That
  is a breaking change on a scale nobody has counted.
- **The key's size and stability across TypeScript versions.** A shape string is
  long, and it embeds ts-morph's kind names.
- **The two sub-problems below**, neither of which this ruling touches.

### And a second sub-problem, which none of the candidates above touches

The instance bug 0337 added — an arrow held in a `PropertyAssignment`, whose module-scope name is the
FILE where the function-scope name was `routes.objectHandler` — has a different cause and a different
fix from the three candidates above. Those are about a match with **no** enclosing declaration; this is
a match **with** one that a second namer cannot see. Review of PR #151 flagged the risk plainly: settle
the three candidates, tick their boxes, and this survives with nothing pointing at it.

- **Teach `getStructuralName`** to name an arrow or function expression held in a `PropertyAssignment`
  (`packages/ts/src/core/violation.ts:56` names one only when the parent is a `VariableDeclaration`).
  Blast radius: `enclosingScopeName` feeds `getElementName`, so this moves element names for every
  condition, and element names are baseline keys.
- **Share the derivation instead.** `models/arch-function.ts` already computes the good name —
  `owningBindingName` (`:540`) plus the collected key path (`:414`) — and it is module-private. Exposing
  it is smaller than reimplementing it, and reimplementing it is the two-derivations-of-one-fact
  failure this repository spends most of its guards on.

Its own box is below, so this record cannot close over it.

## Related

- [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md) — the second preset to widen into
  this, which measured the cost above and the object-literal naming instance.
- [0333](./fixed/0333-the-recommended-floor-reads-functions-only.md) — the change that made these
  positions reachable from the floor, and fixed the cross-file half.
- [0336](./0336-a-rule-that-changes-subject-re-reports-accepted-findings-with-no-diagnostic.md) —
  the other baseline record from the same reviews: what the baseline cannot SAY, where this one is
  what it cannot distinguish.

## Verification

- [x] reproduced — the table above, against `generateBaseline` and `filterNew`, not by reasoning
      about the hash.
- [ ] a pin per row, each asserting the new finding IS reported
- [x] a ruling on what identifies a match with no enclosing declaration — **the
      exclusion is derived, the selection is measured**. The manifesto's baseline
      clause, ADR-009 Rule 3's corollary, ADR-010 and `violation.ts`'s
      slot-versus-reference paragraph each rule out a positional entry; which
      surviving form to use is [spike 0350](../spikes/0350-which-baseline-identity-survives-the-right-edits.md),
      where node shape is the only candidate tried that is 7/7.
- [ ] the cost measured — every existing entry for an unnamed match moves
- [ ] the `PropertyAssignment` sub-problem — a match that HAS an enclosing function the module-scope
      namer cannot name (added 2026-09-26 from [0337](./fixed/0337-agent-guardrails-reads-function-bodies-only.md)).
      **None of the three candidates above addresses it**, so it carries its own box: the record must
      not be able to close over it.
- [ ] the fix, with the pins inverted
- [ ] a changeset — any change here moves existing baseline entries
- [ ] `npm run validate` green.

Deferred: none.
