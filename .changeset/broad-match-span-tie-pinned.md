---
'@nielspeter/eess-ts': none
---

Nothing ships. A KNOWN-GAP test file pins bug 0322: `expression()` drops every match
that shares its span with another, so a statement without a semicolon, a shorthand
property, a destructured binding, a variable declared without a value and a type
annotation pass `notContain`. Each test asserts today's behaviour, so the fix turns
it red.

Behaviour is unchanged, which is why this is `none`.
