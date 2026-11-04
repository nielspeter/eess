---
'@nielspeter/eess': patch
'@nielspeter/eess-md': none
---

The zero-examined finding names each cause with its own remedy (bug 0589): a dead selector or an empty project, subjects written in a form the rule does not read (write them in a form it reads), a rule that never reaches its examining seam, and a source that is legitimately empty, which alone is offered `.expectEmpty()`. It used to offer `.expectEmpty()` first, as the one concrete remedy, and declaring it over a corpus of wikilinks turned a link rule green with no link checked. The finding's first sentence, "this rule examined zero units", is unchanged; a caller that matches the message past it must update its pattern. A corpus of wikilinks declared empty still passes until eess-md reports wikilinks (proposal 015).
