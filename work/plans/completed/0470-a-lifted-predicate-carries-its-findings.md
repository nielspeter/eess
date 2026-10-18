# Plan 0470: a spike — how a predicate lifted through `inDocuments` carries its findings

## Status

- **State:** Done — the spike ran 2026-10-18 as a throwaway prototype in two revisions (the first
  reviewed by three lenses, the second in PR #243's review), with the three adopters' answers measured: [spike 0485](../../spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md).
  Decided the same day: [ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md).
  The build is [plan 0486](./0486-a-predicate-that-cannot-judge-says-so.md).
- **Implements:** proposal 017
- **Priority:** Medium. Block 12's own example, "documents whose Status is done hold no open box", needs
  it. So do adopter 1's most-wanted rule and the rebuild of `honestyAtClose` from public blocks
  (proposal 017, the second Review, decision 3).
- **Effort:** Planned as a time-boxed spike of about an hour. It took two prototype revisions, a
  round of questions to the three adopters, and two review rounds, most of a day.
- **Created:** 2026-10-18
- **Builds after:** [plan 0457](../0457-a-rule-limited-to-the-documents-the-caller-chooses.md)
  (`inDocuments`) and [plan 0469](./0469-havefield-a-document-has-a-value.md) (`haveField`).

## Problem

`haveField` reports three causes that make a document's value unreadable: a conflict, an unnamed form,
and disagreeing prose. It reports them through `docs()`'s `collectViolations` (plan 0469). Plan
0457's `inDocuments(p)` takes a bare `Predicate<MdDocument>` and has no way to pass a predicate's
findings on. So `haveField` lifted onto `taskItems()` would drop an unreadable document without a word
(ADR-009). For that reason plan 0469 exports no predicate form.

## What the spike decides

- **Where the diagnosis lives.** One candidate is a per-predicate diagnosis registered beside plan
  0457's scope registry, which the lifting builder consults on every run, not only when nothing was
  examined.
- **How `.select()` and `correspondence()` behave**, since neither goes through `collectViolations`.
- **Which public predicate `haveField` then exports.**
- **Taken over from plan 0469:** a dogfood rule that uses `haveField` in selector position, and one
  verdict per document and use (each use recomputes it, and a lift recomputes it per element). The
  build plan this spike files owns both.

## Out of scope

- `haveField` itself (plan 0469) and `inDocuments` itself (plan 0457).

## Progress ledger

- [x] Spike: the questions above measured, recorded under `work/spikes/`
      ([spike 0485](../../spikes/0485-what-a-predicate-that-cannot-judge-does-to-a-rule.md): two
      prototype revisions, two review rounds, the three adopters' answers, the cost measured)
- [x] A design brought back for a decision, and the build plan filed after the ruling
      ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md);
      [plan 0486](./0486-a-predicate-that-cannot-judge-says-so.md), which also owns the two items
      taken over from plan 0469: Phase 3's memoized verdict and Phase 4's selector-position dogfood)
- [x] Close: this plan → `completed/`; boards

Deferred: none
