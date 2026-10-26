---
'@nielspeter/eess-md': minor
---

A mention's link says where it points (plan 0549): `link.text` is the link's whole text, `link.target` is where it resolves (`resolveLink`'s cases: external, self, document, not-in-corpus, directory, missing), and `link.offset` is where the mention starts in the text. `mentions(corpus, { pattern, resolve })` takes the resolve options a `links().resolve()` rule takes. `areLinked()` selects the mentions that sit in a link. With them, a `correspondence()` between your linked mentions and your records checks that a link opens the record it names; `areInTitleLinks({ linkPrefix, titlePrefix })` holds for a mention in a link whose text is its target's title, so a board row quoting another record can be left out of that join. `collectMentions` returns `MdMentionMatch`, with the link's URL only. None of this has been released before, so nothing that shipped changes.
