---
'@nielspeter/eess': none
---

Nothing ships. A test and a non-vacuity fixture close bug 0238: ADR-012 changed a
reason-free exclusion from refused to applied-then-promoted, and the promotion —
the half that keeps it fail-closed — was asserted only against `eess-ts`'s forked
copy of the filter. The kernel's copy, which `eess-md`, `eess-mermaid`,
`eess-gherkin` and `eess-crossvalidate` all use, was covered by nothing: deleting
it left all 206 kernel tests green.

Behaviour is unchanged, which is why this is `none` rather than a patch. What
changed is that the behaviour can no longer disappear quietly.
