# Bug 0436: a flowchart past Mermaid's edge limit is reported as the instrument

## Status

- **State:** Draft — recorded 2026-10-16 in [plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md)'s PR, from its architect and method reviews.
- **Severity:** Low — no false green: the run is red, naming the block. But one author's large
  diagram withholds every block's verdict.
- **Origin:** self-found · PR review of [plan 0413](../plans/completed/0413-eess-mermaid-ships-mermaids-own-parser.md), 2026-10-16.
- **Reported:** 2026-10-16

## Symptom

A flowchart of more than 500 edges is refused by Mermaid 11.17.2 with "Edge limit exceeded. 500
edges found, but the limit is 500. Initialize mermaid with maxEdges set to a higher number…"
(measured: 25,000 edges). The error has no `hash` or `result`, so `mermaidParser()` classifies it as
`other`, "Mermaid threw something eess-mermaid does not recognise as a syntax error", the
instrument.

## Root cause

The outcome table treats every unrecognised throw as the instrument, because an unknown throw means
the parser cannot be trusted for the batch. This one is known, and GitHub's renderer would refuse
the block too.

## Fix

Undecided: read the limit's error by a property (if it has one) as the author's `invalid`, with a
remedy naming `maxEdges`; or keep it the instrument. Measure what the error carries first.

## Verification

- [ ] What the error carries, measured
- [ ] Decided, and a red test for the decision

Deferred: none
