# Bug 0593: the HTML link recogniser matches `data-href` and misses a quoted `>`

## Status

- **State:** Fixed — `mentions()` reads an inline `<a>` through the one HTML reader,
  `model/html-attributes.ts`, built by [plan 0580](../../plans/0580-md-a-raw-html-link-is-resolved.md)'s Phase 1 (PR #296).
- **Severity:** Medium — no false green: every case measured is red. One is a false red: a linked
  mention is called "not a link", and the fix offered writes a Markdown link inside the HTML link.
  Two are red under the wrong finding, with a remedy for a link that is not there and no fix.
- **Origin:** self-found · [proposal 022](../../proposals/022-md-a-raw-html-link-is-resolved.md)'s
  review, 2026-11-01.
  (That review's ruling is recorded with [proposal 022](../../proposals/022-md-a-raw-html-link-is-resolved.md)'s amended text and plan, in their own PR;
  until then it lives in this record's reproduction.)
- **Reported:** 2026-11-01

## Symptom

`mentions()` decides whether text sits inside an HTML `<a>` with `OPENS_A`
(`packages/md/src/model/phrasing.ts:64`). Text inside such a link is reported as unread, cause
`'html-link'`, since the rule cannot judge it. `OPENS_A` gets two shapes wrong:

1. **It matches an `<a>` that is no link.** `<a data-href="…">` and `<a title="see href=./x.md">`
   are read as links. A mention inside is reported as "sits in a link written in HTML", with the
   remedy "Write the link in Markdown, `[text](url)`, instead of an HTML `<a>`"
   (`packages/md/src/builders/mentions.ts:61`). A reader sees plain text there, so the right
   finding is "not a link", with its fix.
2. **It misses an `<a href>` with a `>` inside a quoted value.** `<a title="a>b" href="…">` is not
   seen as a link, so the mention inside is judged as plain text and called "not a link". The fix
   offered wraps the mention in a Markdown link, which would put a link inside the HTML link.

## Reproduction

A throwaway script against `packages/md/dist`, over a fixture holding `work/bugs/0001-login.md`
and `work/notes.md`:

```markdown
# Notes

A: <a href="./bugs/0001-login.md">bug 0001</a> is an HTML link.

B: <a data-href="./bugs/0001-login.md">bug 0001</a> is no link at all.

C: <a title="see href=./x.md">bug 0001</a> is no link at all.

D: <a title="a>b" href="./bugs/0001-login.md">bug 0001</a> is an HTML link.

E: bug 0001 is plain text.
```

The rule is `mentions(c, { pattern: /\b(?<kind>bug)\s+(?<n>\d{4})\b/gi })` over `work/notes.md`,
`.should().beLinked({ fix })`, with one record holding the key `bug:0001`. First, the `html`
nodes mdast gives each paragraph, then the findings. Measured output (0.15 s):

```text
line 3 [ '<a href="./bugs/0001-login.md">', '</a>' ]
line 5 [ '<a data-href="./bugs/0001-login.md">', '</a>' ]
line 7 [ '<a title="see href=./x.md">', '</a>' ]
line 9 [ '<a title="a>b" href="./bugs/0001-login.md">', '</a>' ]
line 11 []
examined: 2
undefined  work/notes.md:9  "bug 0001" is not a link  [fix: [bug 0001](./bugs/0001-login.md)]
undefined  work/notes.md:11  "bug 0001" is not a link  [fix: [bug 0001](./bugs/0001-login.md)]
md/unread-mention  work/notes.md:3  "bug 0001" sits in a link written in HTML, which this rule does not read, so it can be judged neither linked nor not.
md/unread-mention  work/notes.md:5  "bug 0001" sits in a link written in HTML, which this rule does not read, so it can be judged neither linked nor not.
md/unread-mention  work/notes.md:7  "bug 0001" sits in a link written in HTML, which this rule does not read, so it can be judged neither linked nor not.
```

Lines 3 and 11 are right. Line 9 should be unread, and lines 5 and 7 should be "not a link" with a
fix. mdast keeps line 9's whole tag, quoted `>` and all, as one `html` node, so the miss is the
regex's, not the parser's. (The `undefined` is the rule's id: the script gave the rule none.)

## Root cause

`OPENS_A = /^<a\s[^>]*\bhref\s*=/i` (`packages/md/src/model/phrasing.ts:64`) answers yes or no
from the tag's raw text, not from its attributes. It is used at
`packages/md/src/model/phrasing.ts:203`.

- `\bhref` matches after any non-word character, so `data-href` matches, `-` before `h`.
- `[^>]*` runs into quoted values, so `href=` inside `title="…"` matches.
- `[^>]*` stops at the first `>`, quoted or not, so a `>` inside a quoted value ends the scan
  before the real `href`.

## Fix

Read the `<a>` tag's attributes as CommonMark's open tag defines them: an attribute name, then an
optional value, unquoted, single-quoted or double-quoted. The tag is a link when one attribute's
name is `href`, in any letter case. `data-href` is another name, a quoted value is skipped whole,
and a `>` inside one does not end the tag.

`:href` and `v-bind:href` (Vue bindings, as in VitePress pages) are matched today and stay
matched: the text a reader sees there is in a link this rule cannot read. Decided here, to be
overruled.

[Proposal 022](../../proposals/022-md-a-raw-html-link-is-resolved.md) needs an attribute reader that
pulls out the `href` value. If it lands first, this bug is closed by reusing it.

## Verification

- [x] Red test written first: the reproduction's line 9 is unread, and lines 5 and 7 are "not a
      link" (`packages/md/tests/builders/mentions-html-reader.test.ts`; red with `OPENS_A` restored).
- [x] Lines 3 and 11 keep today's findings.
- [ ] `<A HREF="…">`, `<a href='…'>` and `<a href=./x.md>` are links; `<a name="x">` is not —
      deferred→[bug 0601](../0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md):
      the first two and `<a name>` are as written and tested; `<a href=./x.md>` is text to micromark
      (an unquoted `/`), and judging a mention in it needs the inline scan, which that bug's fix uses.
- [ ] `<a :href="x">` stays a link — done-otherwise: it is not a link, by
      [plan 0580](../../plans/0580-md-a-raw-html-link-is-resolved.md)'s R2 (GitHub removes the
      attribute, measured), so a mention in it is plain text; tested.
- [x] A changeset naming `@nielspeter/eess-md` (`.changeset/one-html-reader.md`).
- [x] `npm run validate` green.

Deferred: [bug 0601](../0601-a-mention-inside-an-html-link-is-reported-unread-though-the-link-is-read.md)
