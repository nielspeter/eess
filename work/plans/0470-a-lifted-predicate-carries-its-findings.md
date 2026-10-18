# Plan 0470: a spike — how a predicate lifted through `inDocuments` carries its findings

## Status

- **State:** Draft — filed 2026-10-18 as the home that plan 0469's review asked for. The spike ran
  2026-10-18 against plan 0457's written design (0457 is not built yet) and brings back candidate B,
  with C until B lands, for the maintainer's ruling:
  [spike 0470](../spikes/0470-how-a-lifted-predicate-carries-its-findings.md).
- **Implements:** proposal 017
- **Priority:** Medium. Block 12's own example, "documents whose Status is done hold no open box", needs
  it. So do adopter 1's most-wanted rule and the rebuild of `honestyAtClose` from public blocks
  (proposal 017, the second Review, decision 3).
- **Effort:** Small. A time-boxed spike of about an hour that brings a design back for a decision. The
  build is filed as its own plan after the ruling, not here.
- **Created:** 2026-10-18
- **Builds after:** [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md)
  (`inDocuments`) and [plan 0469](./completed/0469-havefield-a-document-has-a-value.md) (`haveField`).

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

## Out of scope

- `haveField` itself (plan 0469) and `inDocuments` itself (plan 0457).

## Progress ledger

- [x] Spike: the questions above measured, recorded under `work/spikes/`
      ([spike 0470](../spikes/0470-how-a-lifted-predicate-carries-its-findings.md); read from the code,
      no prototype, since plan 0457 is not built)
- [ ] A design brought back for a decision, and the build plan filed after the ruling
- [ ] Close: this plan → `completed/`; boards

Deferred: none
