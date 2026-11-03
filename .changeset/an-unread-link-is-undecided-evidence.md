---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** an HTML link eess-md cannot read (`md/unread-link`) is undecided
evidence, not missing evidence (plan 0580, Phase 3). Where such a link is the only one that could
answer:

- `sections().should().haveLink()` reports the link as `md/unread-link` at its line, which nothing can
  suppress, instead of "section … holds no link";
- `sections().that().haveLink()` reports it and neither selects nor drops the section, and its
  `.select()` refuses, as a configuration error naming the site;
- `links().should().beLinkedBack()` reports the target's unread link instead of "… does not link
  back";
- `areLabelled()` no longer calls a label "empty" when its list holds only an unread link.

Each site is reported once per rule. To migrate: write the HTML link so eess-md can read it (the
finding's remedy says how), or in Markdown. A rule that suppressed a "holds no link" or "does not link
back" finding for such a section will now see an unsuppressable one.
