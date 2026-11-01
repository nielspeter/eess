# Proposal 024 — md: an image's file exists

**State:** Draft — filed 2026-10-30 from reading the GFM spec and a GFM cheat sheet against
eess-md, at the maintainer's request; reviewed 2026-11-01, Split and sequence, both asks held (see
Review).
**Priority:** Medium — no shipped rule claims to check images, so nothing over-claims; but a README
whose logo or screenshot was renamed shows a broken image, and no gate notices.
**Origin:** self-found · the maintainer, 2026-10-30: "GitHub Flavored Markdown (GFM) is important",
with the GFM spec (Version 0.29-gfm, 2019-04-06) and a GFM cheat sheet as the reading list.
**Affects:** `@nielspeter/eess-md`.

## Problem

An image points at a file the same way a link does, in three forms: inline `![alt](./logo.png)`,
reference-style `![alt][logo]` with `[logo]: ./logo.png`, and raw HTML `<img src="./logo.png">`,
which READMEs use to set a width. A renamed or deleted image file leaves every one of them broken,
and eess-md reads none of them.

## Measured

On the v0.16.0 build (eess-md 0.13.0), Node 24.22.0, one document holding
`![alt](./gone-inline.png)`, `![alt][logo]` with `[logo]: ./gone-ref.png`, `<img src="./gone-html.png">`
and an inline link to a missing file: `links(c).should().resolve()` examines 1 element and reports
the inline link only. The three missing images produce nothing.

## Existing code survey

- **`links()` reads links, inline and (since [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s part (a)) reference-style, not images** (`packages/md/src/model/links.ts:197`); its docs scope it to
  `[text](url)` (`docs/markdown.md:232`), so images are not claimed.
- **Image nodes are known** elsewhere: the phrasing walk reads an `image` and an `imageReference`
  (`packages/md/src/model/phrasing.ts:191`), and the fix check compares images by URL
  (`packages/md/src/model/fix-check.ts:80`). No element type or rule resolves one.
- **Resolution is `resolveLink`** ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md)): an image's URL resolves the way a link's does, so
  no second resolver is needed.
- **The reference form** shares [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s definition lookup, and `<img src>`
  shares [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s HTML scan.

## Asks

- **A — an image's local file exists.** Inline and reference-style images whose URL is not
  external are resolved, and a missing file is reported at its line (a reference image's at its
  definition's line, as in [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)).
- **B — `<img src>`.** The same for an `src` in raw HTML, on [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s scan.

## Acceptance criteria

- **Break class:** `![alt](./gone.png)` reports a missing image at its line.
- **Break class:** `![alt][logo]` with a definition to a missing file reports at the definition's
  line.
- **Break class:** `<img src="./gone.png">` reports a missing image (B).
- **Break class:** a dangling `![alt][gone]`, with no definition, is plain text to the parser (as a
  dangling link reference is, [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)) and is reported.
- **Break class (B):** `<picture><source srcset="…">`, GitHub's dark-mode logo: `srcset` is a
  comma list with descriptors, read per entry; read as one path it is a false red, left unread a
  false green.
- **Break class (false red):** an external image (a badge, `https://…`), a `data:` URI and an image
  in a code span or fenced block, and an `<img>` inside an HTML comment, produce nothing; an image
  inside a link (`[![badge](…)](…)`) is judged as an image and its link as a link; and
  `./logo.svg#gh-dark-mode-only` resolves the file (it does today, as a link target).
- **Evidence:** `examined` counts each image read.
- **Non-vacuity:** a fixture row per break class.

## Dogfooding

This repository's Markdown holds six images, all external badges (PR #280's enforcement
re-check), so `check:corpus` would read nothing; the rows are the proof.

## Open questions

1. **Element type or a widened `links()`.** An `images()` element type of its own, or images as
   links of a kind (`links().that().areImages()`). `links()` users would see new findings from the
   second, a break marked as one; the first is additive.
2. **Alt text.** Whether an image without alt text is in scope, as an accessibility rule beside the
   file check, or a separate ask.

## Out of scope

- Whether an image renders (format, size) and remote images' reachability.

## Review — 2026-11-01

**Ruling: Split and sequence**

Reviewed by the architect, product and enforcement lenses, each on its own survey of the code at
`bd78b962`. The three agree on substance and differ only in the word: ship with changes after two
upstream rulings, split and sequence, and not ready for a plan. The capability is real, generic
and placed correctly, and almost every part it needs exists already. But the proposal bundles
separable things, and its central ask cannot ship in the form it is written. Ask A without ask B
is a measured false green on the image form READMEs mostly use. So both asks are `Held`, on one
condition: the shared reader of HTML attributes that
[proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s review (2026-11-01) calls for, which 022's
plan will build; 022's ruling is recorded with its amended text and its plan, in their own PR. All measurement was done with
throwaway scripts against `packages/md/dist`; each probe took 0.14–0.21 s, the README census 3.7 s
and 4.8 s, and the repository census 6.3 s. No suite, validate or nonvacuity run was needed.

### Existing code survey, corrected

- **Ask A is new as an element type, and every part it needs exists.** `definitionsOf`
  (`packages/md/src/model/definitions.ts:48`) and `resolveLink`
  (`packages/md/src/model/resolve-link.ts:203`, over `LinkToResolve` at `:56`) are reused as they
  are. Two pieces need a narrower input type and must not be copied: `movedLinkFix`
  (`packages/md/src/model/resolve-link.ts:273`) and the body of `linkResolves`
  (`packages/md/src/conditions/resolve.ts:31`). The precedent is `pointers()`, a separate element
  type with its own `resolve()` (`packages/md/src/builders/pointers.ts`).
- **The dangling `![alt][gone]` criterion is already met**, by a decided different design. The
  example's pattern, `mentions()` with `notExist()`
  (`examples/md/a-reference-with-no-definition-is-reported.test.ts:26`), reports `![alt][nodef]`
  and `![coll][]` today, measured.
  [Bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (b)
  decided that a dangling reference is text, and shipped it as an example, not a builder element.
- **Ask B is new.** No HTML scan exists. The only recogniser is the inline-only `OPENS_A`
  (`packages/md/src/model/phrasing.ts:64`), which reads `<a href>` and nothing else.
- **Alt text has a precedent in a sibling dialect**: eess-ts's
  `jsxElements(p).that().areHtmlElements('img').should().haveAttribute('alt')`
  (`packages/ts/src/builders/jsx-rule-builder.ts:50`).

### Placement

Everything goes in `@nielspeter/eess-md`, and nothing reaches `packages/core`. Path resolution is
a dialect fact ([ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md)). The
not-judged and zero-examined machinery the work needs is already in the kernel
([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md),
[ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)). There is one HTML
attribute reader in eess-md's model layer, for `href`, `src` and `srcset` alike:
[proposal 022](./022-md-a-raw-html-link-is-resolved.md), this proposal's ask B and
[bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2 are one
instrument with three consumers. The `srcset` split lives in the same module, never in a second
copy. Image handling must not be put inside the link walk's output or inside `linkResolves`'
accepted cases.

### Decisions taken in this review

Each of these is decided here so the work can move, and each can be overruled.

1. **Open question 1 is decided: a new `images()` element, not a widened `links()`.** The family
   has one element type per kind: links, pointers, mentions, task items, rows and sections, each
   in `packages/md/src/builders/`. Widening `links()` would make three other readers take an image
   for a link. `sections().haveLink` reads every link in a section
   (`packages/md/src/model/section-holds.ts:50`), so a section holding only a badge would "have a
   link". `beLinkedBack` walks the same links
   (`packages/md/src/conditions/linked-back.ts:18`), so `![x](./other.md)` would count as a link
   back. `areLabelled`'s scan does too
   (`packages/md/src/builders/declaration-findings.ts:49`). Some of those changes turn a red into a
   green, which no migration line can undo. That is the regression class that got
   [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md) part (b)'s
   first build reverted. All three lenses' evidence leans the same way. An additive `images()` is
   an eess-md minor.
2. **Raw HTML is resolved directly**, through one shared reader of HTML attributes: the decision recorded in
   [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2
   (2026-11-01), which [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s plan will build. So ask B does not wait
   on an "unread first" step, and ask A does not need a disclosure finding with no remedy. This
   settles, for images, the "unread, or resolve" choice that
   [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s Fix 2 left
   open. It also means no suppressible unread finding is proposed, so nothing here amends
   [ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5.
3. **The dangling `![alt][gone]` criterion is struck.** It is already met by
   [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s example. An
   image fixture and a line in that example's doc comment would show it; that is an example
   change with release `none`. The enforcement lens raised one argument, not settled here: a
   dangling image shortcut `![logo]` does not share the false-red shape (`[x]`, `[WIP]`,
   `> [!NOTE]`) that kept the shortcut out of that bug, and could join the pattern after a
   measurement over its README sample.
4. **Open question 2, alt text, is a separate ask and does not block.** All three lenses agree,
   provided the element carries `alt`, so `satisfy()` is enough today. Presence is Tier 1 and
   quality is Tier 4, and an empty alt is correct for a decorative image. A policy is a corpus
   shape and goes to `examples/`
   ([ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)). A named building block
   would reuse eess-ts's `haveAttribute('alt')` word, and
   [ADR-023](../../adr/023-a-predicate-and-a-condition-that-share-a-word.md) settles its kind.

### Critical (must be settled before a plan)

1. **Ask A without ask B is a false green.** The product lens counted 604 READMEs under
   `node_modules`: 66 of 73 local image URLs are `<img src>`, only 7 are Markdown images, and none
   is a local reference-style image. 12 of the 19 READMEs with a local image have one only in
   HTML. On the link analogue, a README holding an external badge and a missing, sized `<img>`
   logo is green with `examined 1`. Scoped with `.that().areInternal()`, it is the zero-examined
   finding, and that finding's documented remedy, `.expectEmpty()`, then holds green over every
   later broken `<img>`. The tool's own advice would steer an adopter into a permanent false
   green. Decision 2 closes this: A and B ship together, in one release, as
   [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) §6 paired
   [bug 0136](../bugs/0136-link-fragments-are-never-checked.md) and
   [bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md).
2. **The link door's idea of "resolved" gives four false greens the proposal does not name**
   (measured). The image door needs its own accepted cases over the `LinkTarget` kinds, built on
   the one resolver ([plan 0404](../plans/completed/0404-md-one-link-resolver-names-each-case.md);
   [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 3, "each door
   decides"):
   - `![a]()` and `![a](#)` resolve as `self`;
   - an image naming a directory resolves under `resolveDirectories`, which this repository's
     `work/` and `adr/` profile runs with (`scripts/lib/corpus-link-routing.mjs:23`);
   - `![m](./guide.md)` resolves as `document`, a Markdown file shown as an image;
   - an unquoted `<img src=./x.png>` is a `text` node to the parser, not `html`, so a scan that
     reads only `html` nodes never sees it.

### Important

- **The fragment criterion conflicts with a decided spike.**
  [Spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 4, to be built by
  [bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md), makes a fragment on a
  non-Markdown file an unsuppressable not-judged finding. This proposal wants
  `./logo.svg#gh-dark-mode-only` silent. An image's fragment is a renderer directive, not an
  anchor, so the image door ignores the fragment verdict, documented, as decision 3 allows. The fix
  must always carry an image's fragment, so decision 5's "carry it only if the target has it"
  check belongs in the link caller, not inside `movedLinkFix`. Whichever of this work and
  [bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md) is built second names
  the other.
- **The moved-file fix is the wrong remedy for a generic image name** (measured). A deleted
  `./logo.png` is "fixed" to an unrelated `../logos/logo.png`, and a VitePress `/logo.png` is
  rewritten to `./public/logo.png`. The fix clears the finding and shows the wrong picture, the
  same-derivation trap of [ADR-009](../../adr/009-agent-first-failure-surfaces.md) rule 2. The plan
  chooses: no autofix for images, the fix offered in the message only, or a stricter match.
- **Missing false-red classes** (measured):
  - a query string: `./x.png?raw=true` and `./a.md?plain=1` are "broken link" today, because
    `linkTargets` strips only `#` (`packages/md/src/model/resolve-link.ts:136`). That is a resolver
    defect of its own, now recorded as
    [bug 0583](../bugs/fixed/0583-a-local-link-with-a-query-string-never-resolves.md), and this work
    depends on it;
  - a file under the built-in ignore list (`packages/md/src/corpus.ts:78`): a committed
    `coverage/badge.svg` or `dist/logo.png` is reported as absent, so the message must name the
    cause;
  - a static-site asset root, such as VitePress's `docs/public/` or Docusaurus's `static/`. The
    lenses disagree on the remedy: a per-condition `rootDir` as a docs example, the objection that
    one `rootDir` cannot serve links and images in one corpus, and a measured false red with a
    wrong fix. The plan decides between a documented option and an explicit out-of-scope line;
  - `srcset` split by the HTML srcset grammar, not on every comma, or
    `data:image/png;base64,AAAA 1x` is a false red;
  - `<img srcset>` is in scope as well as `<source srcset>`;
  - comments inside a mixed HTML block are stripped, as
    [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 2 does;
  - ask B inherits [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s rules by name: the
    attribute's own line, and entity decoding.
- **What the finding says.** An image finding opens with "missing image" and names the alt and the
  URL, never "broken link" (`packages/md/src/conditions/resolve.ts:81`). `[![b](./gone.png)](./gone.md)`
  gives two findings on one line, and a definition shared by a link and an image gives one per
  rule at the definition's line. The directory hint about `resolveDirectories` would hand an image
  a remedy that clears the finding and not the defect. The element string also differs from the
  link's (`packages/md/src/conditions/resolve.ts:77`), so a waiver can tell the two apart.
- **"A fixture row per break class" cannot fail as written.** Each row names the sabotage it goes
  red under: the walk skipping `image`, `imageReference`, link children, headings or footnotes;
  the dedupe removed; `self` or a directory accepted; `srcset` split on every comma or read as one
  path. Every row asserts message, file and line, never the rule id alone
  ([bug 0110](../bugs/fixed/0110-nonvacuity-gates-do-not-assert-which-rule-fired.md)'s class).
  Add a clean fixture holding one image that resolves. `images()` extends `CorpusRuleBuilder`, so
  zero-examined and empty-project precedence are inherited. Most rows are red tests in
  `packages/md/tests/`, not nonvacuity rows.
- **A docs line is shippable now, whatever else is decided.** `docs/markdown.md:232` and
  `packages/md/README.md` never say that `links()` does not read images. "Nothing over-claims"
  holds today only through silence.

### Minor

- State the classes generically ("a query is not part of the path", "a fragment is not part of the
  file"), and keep `?raw=true` and `#gh-dark-mode-only` as examples.
- Tier 1 is honest, but the claim is "a file exists in the working tree at check time". "In the
  repo" over-states it for an untracked image. That was already true of links.
- Decide whether external images count in `examined`. For `links()` they do, so a dogfood
  `images()` over this repository would examine 6 badges and judge none.
- Case-sensitive lookup (`./X.png` against `x.png` is red) matches GitHub. Pin it with a row.
- Out of scope, named: `<video>`, `<audio>`, `poster`, `<object>`, `<iframe>`, MDX imports,
  unreferenced definitions, and `![c](./a b.png)` without angle brackets (text to the parser and to
  GitHub alike).
- The image type is not structurally assignable to `MdLink` (it has `alt`, not `text`), but keeps
  `url`, `external` and `doc.relPath`, so it stays a `LinkToResolve` and can be a
  `correspondence()` side, for orphan assets.
- Move `areInternal()` and `areExternal()` from module-private in
  `packages/md/src/builders/links.ts:23` to `predicates/`, typed on `{ external: boolean }`, rather
  than copying them.
- The dedupe set stays inside `evaluate`, so a fork's second `.check()` is not suppressed.
- [ADR-016](../../adr/016-a-bounded-instrument-limits-knowledge-never-the-verdict.md) applies only
  if ask B's reader has a budget. Say whether it does.

### Corrections to the submission

- It treated ask A as shippable alone. 66 of 73 local README images are `<img src>`, so A alone is
  the false green in critical item 1.
- Its fourth criterion, a dangling `![alt][gone]`, re-opened a decided record and is already met
  by [bug 0558](../bugs/0558-a-reference-style-or-raw-html-link-is-never-examined.md)'s example.
- Its fragment criterion, `./logo.svg#gh-dark-mode-only` resolving "as it does today", conflicts
  with [spike 0574](../spikes/0574-what-checking-a-link-fragment-needs.md) decision 4 and goes
  stale once [bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md) lands.
- "No second resolver is needed" is true, but the link door's accepted cases are not the image
  door's: `![a]()`, `![a](#)`, a directory and a Markdown file all pass.
- Open question 1 named only the new findings `links()` users would see. It missed the three other
  readers of the same links, whose verdicts would move, some from red to green.
- Ask B named `<source srcset>` and not `<img srcset>`, and did not name the unquoted
  `<img src=…>`, which the parser reads as text.
- "A fixture row per break class" named no sabotage, so it could not fail.

### Recorded separately

- [Bug 0583](../bugs/fixed/0583-a-local-link-with-a-query-string-never-resolves.md): a local link with a
  query string never resolves.
- The review's claim that no gate resolves the root README's ordinary links did not reproduce:
  `packages/ts/tests/docs/cross-document-links-resolve.test.ts` resolves every inline link in
  `README.md`, `CLAUDE.md` and `RELEASING.md` on every `npm test` (30 links, 0 broken, measured
  2026-11-01). Measuring it found a new instance of open
  [bug 0181](../bugs/0181-link-checks-cover-one-package-of-six.md) instead: eess-md's published
  README links into the repository relatively, six times; recorded there.

### Praise

The proposal is scoped correctly: an eess-md building block, with no kernel change, no preset and
no document shape ([ADR-006](../../adr/006-framework-rules-architecture.md),
[ADR-013](../../adr/013-the-kernel-takes-the-fact-not-the-project.md),
[ADR-022](../../adr/022-eess-mds-root-fixes-no-documents-shape.md)). It reuses before it builds:
one resolver, `definitionsOf`, and reference findings at the definition's line. Its criteria count
false reds as break classes, and frame `srcset` as both a false red and a false green. Measured,
the parser already gives the right tree for the badge, `data:`, code span, commented `<img>` and
image-inside-a-link cases, and percent-encoding, angle-bracket destinations, titles and line
attribution already work through the existing walk. Those classes need only rows.

### Disposition

| Ask                                                           | Disposition | What would unhold it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — inline and reference-style Markdown images resolve        | `Held`      | It ships together with ask B, never alone: 66 of 73 local README images are `<img src>`. Unheld when [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s plan has built the shared HTML-attribute reader. Then A and B are planned together as one `images()` element with the accepted cases in critical item 2, the image fix policy, the fragment rule against [bug 0575](../bugs/0575-a-fragment-the-link-check-cannot-judge-passes.md), the asset-root scope, and the rewritten non-vacuity criterion |
| B — `<img src>`, `<img srcset>` and `<source srcset>` resolve | `Held`      | The same condition: [proposal 022](./022-md-a-raw-html-link-is-resolved.md)'s plan has built the shared HTML-attribute reader. B reads `src` and `srcset` through it, with the srcset grammar in the same module                                                                                                                                                                                                                                                                                                 |
