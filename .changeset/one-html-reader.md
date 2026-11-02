---
'@nielspeter/eess-md': minor
---

**Breaking (@nielspeter/eess-md):** eess-md reads HTML tags and attributes in one place now (plan
0580, Phase 1). Three fixes, each of which can change a rule's verdict:

- **`mentions()` decides which `<a>` is a link the way HTML does** (bug 0593). An `<a data-href>` or
  `<a title="see href=…">` is no link, so a mention in it is plain text and is judged linked or not,
  as any text is. An `<a title="a>b" href="…">` is a link, so a mention in it is reported as unread
  (`md/unread-mention`) instead of being called "not a link". `<a :href>` is not a link either,
  because GitHub removes the attribute.
- **A rule over only unread mentions reports them and nothing beside** (bug 0602). Before,
  `.should().beLinked()` added the generic "this rule examined zero units" finding next to them, and
  `.should().notExist()` marked its receipt `declaredEmpty`.
- **A block of only HTML comments is invisible to `mentions()` and to `sections().haveContent()`**,
  including two comments on one line and the `<!…>` and `<?…>` forms HTML treats as comments, such as
  `<!DOCTYPE html>`. Text between two comments is seen: before, `haveContent()` called
  `<!-- a --> text <!-- b -->` empty.

To migrate: a section that holds only a doctype or a processing instruction now fails
`.should().haveContent()`, as a section of only comments did; text written between two comments now
counts. A mention inside `<a data-href>` is now judged as plain text.

eess-md now depends directly on `decode-named-character-reference`, which micromark already
installed, to decode a reference in an attribute's value.
