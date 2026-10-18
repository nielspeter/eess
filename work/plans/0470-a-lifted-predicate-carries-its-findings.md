# Plan 0470: a predicate lifted through `inDocuments` carries its findings

## Status

- **State:** Draft — filed 2026-10-18 as the home that plan 0469's review asked for; not designed yet.
- **Implements:** proposal 017
- **Priority:** Medium. Block 12's own example, "documents whose Status is done hold no open box", needs
  it. So do adopter 1's most-wanted rule and the rebuild of `honestyAtClose` from public blocks
  (proposal 017, the second Review, decision 3).
- **Effort:** Unknown until designed. It starts as a spike that brings a design back.
- **Created:** 2026-10-18
- **Builds after:** [plan 0457](./0457-a-rule-limited-to-the-documents-the-caller-chooses.md)
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

## Out of scope

- `haveField` itself (plan 0469) and `inDocuments` itself (plan 0457).

## Progress ledger

- [ ] Spike: a design for the diagnosis door, brought back for a decision
- [ ] Build, per the decided design
- [ ] Close: this plan → `completed/`; boards

Deferred: none
