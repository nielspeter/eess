# Bug 0589: a zero-examined rule names `.expectEmpty()` but not a link form the rule does not read

## Status

- **State:** Fixed — the zero-examined message names a form the rule does not read as a cause, with
  its own remedy, and offers `.expectEmpty()` only for a legitimately empty source (2026-11-04).
  The false green itself remains for wikilinks until [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md) reports them (see Built).
  Reproduced 2026-11-01 on `bd78b962`.
- **Severity:** High — a false green reached by following the finding's own remedy. A corpus whose
  links are all written as wikilinks reds with a message that offers `.expectEmpty()`. Declaring
  it turns the rule green with 0 findings, and no link in the corpus is checked.
- **Origin:** self-found · [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)'s
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
clears the finding and leaves every link unchecked. [ADR-009](../../../adr/009-agent-first-failure-surfaces.md)
rule 2: "The remedy must be **real**", and "if a check can fire for several causes, the message
must not name one cause's remedy as if it were universal." [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md)
§4 says the same of this finding: each cause names its own remedy.

The corpus that reaches this is the one [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)
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
([bug 0460](./0460-the-kernel-exempts-a-cardinality-rule-before-it-looks-for-a-dead-glob.md),
`packages/core/src/terminal-builder.ts:338`). No such hook carries "this corpus holds text in a
link form this rule does not read".

## Fix

Not designed. The direction, within
[ADR-013](../../../adr/013-the-kernel-takes-the-fact-not-the-project.md) (the kernel takes the fact a
dialect materialises, not the project):

- When a rule examined zero units, the message must not offer `.expectEmpty()` as the remedy for
  every case. It names the unread-form cause as well, with a remedy that clears it without silencing
  the links: write them as Markdown links, or use a rule that reads that form.
- Where the dialect knows the corpus holds an unread link form, it says so, and that fact outranks
  `.expectEmpty()` as an empty source and a selector fault already do, so the declaration cannot
  turn the corpus green. Which forms eess-md recognises as unread, and how, is
  [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)'s question for wikilinks and
  [bug 0558](./0558-a-reference-style-or-raw-html-link-is-never-examined.md) Fix 2's for raw HTML.
  This bug must not decide either. It owns the kernel's message and the precedence slot both can use.

**Built 2026-11-04.** `zeroExaminedViolation` (`packages/core/src/vacuity-findings.ts:62`) names
its causes, each with its own remedy: a dead selector or an empty project, subjects written in a
form the rule does not read (write them in a form it reads), a rule that never reaches its examining
seam, and a source that is legitimately empty, which alone is offered `.expectEmpty()`, last. The
`configFinding` comment names them too. eess-ts gives its own zero-subject advice and is unchanged;
mermaid, gherkin and crossvalidate show this message, and none of its causes misleads there (PR
review, measured). The bug's reproduction above quotes the old message, as history.

**What is not fixed, and who owns it.** Measured on this branch: a corpus of wikilinks only with
`.expectEmpty()` still passes, nothing examined. The message no longer offers `.expectEmpty()` as
that cause's remedy ([ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2), but nothing stops the declaration. The Fix's second half
proposed a kernel slot for a dialect fact that outranks it. That is dropped: eess-md already keeps
an unread form out of `.expectEmpty()`'s reach by reporting each such link as an unsuppressable
finding (an unread HTML link, `md/unread-link`, pinned below), and a wikilink reported the same way
needs no kernel change. Recognising and reporting wikilinks is
[proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md)'s, which now says so. An
undefined reference (`[x][nope]`) also examines nothing and passes under `.expectEmpty()`; it is
documented as not a link, and the opt-in `mentions()` rule reports it.

Residual: the remedy "fix the rule" for an unreached seam is not one an author can always act on;
it is unchanged by this bug.

## Verification

- [x] Red test written first: over a corpus holding only wikilinks, the zero-examined finding's
      message names a link form this rule does not read as a cause, and does not present
      `.expectEmpty()` as the remedy for it: `packages/md/tests/zero-examined-unread-form.test.ts` ·
      `it('over wikilinks only, the message names the unread form and does not offer .expectEmpty() for it')`,
      and the kernel's own `packages/core/tests/zero-examined-message.test.ts`; both red on main.
- [x] Remedy-remediates test ([ADR-009](../../../adr/009-agent-first-failure-surfaces.md) rule 2's
      corollary): applying the remedy the message names for that cause clears the finding by
      examining the links, not by declaring them away. Pinned:
      `it('the remedy for that cause clears the finding by examining the links, not by declaring them away')`.
- [x] Where a dialect reports an unread link form, `.expectEmpty()` on that rule still reds:
      `it('a link this rule reports unread keeps the rule red under .expectEmpty()')`. It held before
      this change ([plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md)'s unread links are unsuppressable); the row pins it.
- [x] A legitimately empty corpus (no links in any form) with `.expectEmpty()` stays green:
      `it('a corpus with no link in any form, declared empty, stays green')`.
- [x] A changeset naming `@nielspeter/eess`, and `@nielspeter/eess-md` if it supplies the fact:
      `.changeset/zero-examined-names-each-cause.md`, a patch to the kernel; eess-md supplies no
      fact (see Built) and declares `none`.
- [x] `npm run validate` green.

Deferred: [proposal 015](../../proposals/015-md-wikilinks-are-read-or-reported.md) (reporting a wikilink unread, which keeps `.expectEmpty()` from passing a wikilink corpus; see Built)
