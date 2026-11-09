---
'@nielspeter/eess-md': minor
---

`mentions(corpus, { pattern, keepBackticks: true })` reads inline code with its backticks kept, as a
link's `text` already does, and gives each mention `codeGroups`: the names of the pattern's groups
whose whole capture lies inside one inline-code span (plan 0647). A pattern can then require a name
to be written as code, and a backtick escaped in prose cannot pass a prose word off as code.
`collectMentions(root, pattern, { keepBackticks: true })` takes the same opt-in, and the type
`MentionReading` names it. Off by default: every existing rule reads as before.
