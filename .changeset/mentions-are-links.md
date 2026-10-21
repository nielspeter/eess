---
'@nielspeter/eess-md': minor
---

`mentions(corpus, { pattern })`: every match of your pattern in a document's text, with `beLinked()` to say each one sits in a link (plan 0539). Inline code is read, so backticks do not hide a mention; a mention split by emphasis or a soft line break is found when your pattern allows it; a mention in a raw HTML block, a reference-style link, image alt text or a link title is reported as unread (`md/unread-mention`) where the rule reaches it. `areSelfMentions({ mention, document })` lets a record name itself. The pattern and the keys are yours: nothing about records is built in. Presence only: which file a link points at is not judged.
