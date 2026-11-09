---
'@nielspeter/eess-md': minor
---

`mentions(corpus, { pattern, keepBackticks: true })` reads inline code with its backticks kept, as a
link's `text` already does, and gives each mention `codeGroups`: the names of the pattern's groups
whose whole capture lies inside one inline-code span (plan 0647). A rule can then require a name to
be written as code by checking `codeGroups`: a backtick escaped in prose can still make a pattern
match a prose word, and `codeGroups` is what tells the two apart. Text the reading cannot see is
searched with the backticks kept too, so a mention there is still reported as unread.
`collectMentions(root, pattern, { keepBackticks: true })` takes the same opt-in, and the type
`MentionReading` names it. Off by default: every existing rule reads as before.
