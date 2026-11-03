# Bug 0605: Promoted means a plan owns the ask, but the lane promotes when it ships

## Status

- **State:** Draft — read 2026-11-02; no red test yet.
- **Severity:** Low — the corpus says two things about one state, and a reader cannot tell from a
  proposal whether its plan is going ahead. No gate verdict is affected.
- **Origin:** self-found · the method review of PR #299, which held
  [plan 0581](../plans/0581-md-a-field-written-empty-can-mean-absent.md) for demand: the first plan
  that owns an ask and is not going ahead.
- **Reported:** 2026-11-02

## Symptom

`work/proposals/PROPOSALS.md:54` defines `Promoted` as "dispatched — a plan or bug owns it, **and
the header names it**". Four proposals meet that definition and are `Draft`:
[proposal 014](../proposals/014-crossvalidate-tests-in-any-language.md),
[proposal 022](../proposals/promoted/022-md-a-raw-html-link-is-resolved.md),
[proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md) and
[proposal 026](../proposals/026-md-a-document-has-a-section-that-satisfies-a-predicate.md), each owned
by a plan that declares `**Implements:**`. _2026-11-03: [proposal 022](../proposals/promoted/022-md-a-raw-html-link-is-resolved.md) was promoted at its plan's close (PR #300). It is `Promoted` under either reading, its plan both owning the ask and shipped, so it has left this bug's scope; three remain._ The lane's practice is to promote when the plan ships:
[proposal 013](../proposals/promoted/013-md-a-declared-relation-is-reciprocated.md) was promoted
when every ask was built. [Proposal 025](../proposals/025-md-a-field-written-empty-can-mean-absent.md)'s own text says both: its Review says the plan "is being
written now" (`work/proposals/025-md-a-field-written-empty-can-mean-absent.md:149`), and its Next
step says "This proposal stays Draft until then; whoever files the plan sets `Promoted`" (`:368`),
though the plan was filed and the proposal stayed Draft.

The two readings came apart only when a plan owning an ask was held for demand: under the written
definition 025 is `Promoted` with a plan that may never be built; under the practice it is `Draft`.

## Fix

Not designed. The direction: decide which reading `Promoted` means and say it once in
`PROPOSALS.md`'s Vocabulary, then make the four proposals and 025's text agree. If it means "a plan
owns it", a held plan needs a word of its own; if it means "the ask shipped", the definition and
`corpus/promoted-proposal-*`'s wording follow.

## Verification

- [ ] `PROPOSALS.md` states one meaning of `Promoted`.
- [ ] 014, 025 and 026 carry the state that meaning gives them (022 left the scope, 2026-11-03), and 025's Review and Next step
      agree with its State line.
- [ ] `npm run check:corpus` green.

Deferred: none
