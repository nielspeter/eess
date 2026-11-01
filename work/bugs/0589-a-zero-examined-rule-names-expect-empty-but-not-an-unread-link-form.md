# Bug 0589: a zero-examined rule names `.expectEmpty()` but not a link form the rule does not read

## Status

- **State:** Draft — reproduced 2026-11-01 on `bd78b962`; no red test yet.
- **Severity:** High — a false green reached by following the finding's own remedy. A corpus whose
  links are all written as wikilinks reds with a message that offers `.expectEmpty()`. Declaring
  it turns the rule green with 0 findings, and no link in the corpus is checked.
- **Origin:** self-found · [proposal 015](../proposals/015-md-wikilinks-are-read-or-reported.md)'s
  review (synthesis C3, enforcement C2), which measured it and asked for a bug of its own: the
  kernel's message is not the proposal's to change.
- **Reported:** 2026-11-01

## Symptom

`links().should().resolve()` over a corpus that holds only `[[Missing Page]]`-style links examines
0 units, because eess-md reads none of them as links. The kernel then reports its zero-examined
finding (`packages/core/src/vacuity-findings.ts:55`). Its message, which is also its suggestion,
names four causes: a corpus that is legitimately empty (remedy: `.expectEmpty()`), a dead selector,
an empty project, and a rule that never reaches its own examining seam. The true cause is not among
them: the corpus holds links, written in a form this rule does not read.

So the one remedy the message makes concrete, `.expectEmpty()`, is the one an agent applies. It
clears the finding and leaves every link unchecked. [ADR-009](../../adr/009-agent-first-failure-surfaces.md)
rule 2: "The remedy must be **real**", and "if a check can fire for several causes, the message
must not name one cause's remedy as if it were universal." [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)
§4 says the same of this finding: each cause names its own remedy.

The corpus that reaches this is the one [proposal 015](../proposals/015-md-wikilinks-are-read-or-reported.md)
exists for, a wiki or a notes vault written in wikilinks. A corpus that mixes wikilinks with
ordinary links is not affected by this bug: its ordinary links are examined, so the zero-examined
finding never fires (the wikilinks there are unread, which is the proposal's subject).

## Reproduction

Measured 2026-11-01 against `packages/md/dist`, built 08:56 the same day; the last commit touching
`packages/md/src` is `7ba8bbe3` (2026-10-31), so the build is current.

```js
const vault = md.corpusFromText({
  'a.md': '# A\n\nSee [[Missing Page]] and [[Other|label]].\n',
  'b.md': '# B\n\nBack to [[A]].\n',
})
show('wikilinks only, links().should().resolve()', md.links(vault).should().resolve().violations())
show(
  'same, after the remedy the message names: .expectEmpty()',
  md.links(vault).should().resolve().expectEmpty().violations(),
)
const mixed = md.corpusFromText({ 'a.md': '# A\n\nSee [[Missing Page]] and [gone](./gone.md).\n' })
show(
  'control: one ordinary broken link beside the wikilink',
  md.links(mixed).should().resolve().violations(),
)
```

Output (0.15 s wall time):

```text
-- wikilinks only, links().should().resolve(): examined 0, 1 finding(s) -> RED
   ruleId=undefined bypassFilters=true
   message: this rule examined zero units. If this is expected (the corpus is legitimately empty right now), declare it explicitly with .expectEmpty() — otherwise this is a dead selector, an empty project, or a rule that never reaches its own examining seam, and the fix is to widen the selection, not to suppress this finding.
   suggestion===message: true
-- same, after the remedy the message names: .expectEmpty(): examined 0, 0 finding(s) -> GREEN
-- control: one ordinary broken link beside the wikilink: examined 1, 1 finding(s) -> RED
   ruleId=undefined bypassFilters=undefined
   message: broken link: "./gone.md" does not resolve to a file in the repo
   suggestion===message: false
```

The same holds for a corpus whose only link is a raw HTML link, the other unread form
([bug 0558](./0558-a-reference-style-or-raw-html-link-is-never-examined.md), Fix 2, still open).
`<p align="center"><a href="./gone.md">Guide</a></p>` (0.13 s):

```text
-- raw HTML link only: examined 0, 1 finding(s) -> this rule examined zero units. If this is expected (the corp…
-- same + .expectEmpty(): examined 0, 0 finding(s) -> GREEN
```

## Root cause

The zero-examined message is one fixed string in the kernel
(`packages/core/src/vacuity-findings.ts:55`), returned last in the terminal's precedence
(`packages/core/src/terminal-builder.ts:343`). The kernel cannot tell an empty corpus from a corpus
full of links it was not built to read. eess-md knows the difference only in part: `collectLinks`
reads mdast `linkReference` and `link` nodes (`packages/md/src/model/links.ts:197`, `:216`), and a
wikilink is plain text to the parser, so nothing is collected and nothing is reported. Nothing
passes that fact to the kernel, so the kernel falls through to the generic message and its
`.expectEmpty()` remedy. The kernel already has a hook a dialect answers before `.expectEmpty()` is
read: `cardinalitySelectorFault()`, for a broken selector
([bug 0460](./fixed/0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md),
`packages/core/src/terminal-builder.ts:338`). No such hook carries "this corpus holds text in a
link form this rule does not read".

## Fix

Not designed. The direction, within
[ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md) (the kernel takes the fact a
dialect materialises, not the project):

- When a rule examined zero units, the message must not offer `.expectEmpty()` as the remedy for
  every case. It names the unread-form cause as well, with a remedy that clears it without silencing
  the links: write them as Markdown links, or use a rule that reads that form.
- Where the dialect knows the corpus holds an unread link form, it says so, and that fact outranks
  `.expectEmpty()` as an empty source and a selector fault already do, so the declaration cannot
  turn the corpus green. Which forms eess-md recognises as unread, and how, is
  [proposal 015](../proposals/015-md-wikilinks-are-read-or-reported.md)'s question for wikilinks and
  [bug 0558](./0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2's for raw HTML.
  This bug must not decide either. It owns the kernel's message and the precedence slot both can use.

## Verification

- [ ] Red test written first: over a corpus holding only wikilinks, the zero-examined finding's
      message names a link form this rule does not read as a cause, and does not present
      `.expectEmpty()` as the remedy for it.
- [ ] Remedy-remediates test ([ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2's
      corollary): applying the remedy the message names for that cause clears the finding by
      examining the links, not by declaring them away.
- [ ] Where a dialect reports an unread link form, `.expectEmpty()` on that rule still reds.
- [ ] A legitimately empty corpus (no links in any form) with `.expectEmpty()` stays green.
- [ ] A changeset naming `@nielspeter/eess`, and `@nielspeter/eess-md` if it supplies the fact.
- [ ] `npm run validate` green.

Deferred: none
