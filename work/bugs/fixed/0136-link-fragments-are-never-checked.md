# Bug 0136: `linkResolves` discards the fragment — a link to a real file with a dead anchor is green, and the autofix rewrites anchors it never validates

## Status

- **State:** Fixed — `resolve()` judges a fragment against its target's anchors under the linking
  document's renderer's rule (2026-11-03). Root cause read from the source and confirmed by probing
  the live gate (see _Reproduction_).
- **Severity:** High, raised 2026-10-30 — `BUGS.md`'s High row is a gate that
  passes over drift it should catch, and a dead anchor is that drift whether or
  not this repository holds one. Re-measured on the v0.16.0 build:
  `[x](./other.md#no-such-heading)`, with `other.md` present, and `[x](#nowhere)`
  produce no finding. _Was Medium (2026-08-13): an honesty gap, not High because
  all five internal anchor links in the gated roots were correct; the argument
  for High was the autofix path in Symptom (4)._
- **Scope (2026-11-01, [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md)):** the
  Fix's open questions are decided there. This record keeps the fragment check against loaded
  documents (Fix 1, 2 and the summary half of 3); a fragment on a file the corpus did not load or
  on a directory, the `#L` line form and the autofix (the rule half of Fix 3, Fix 4) moved to
  [bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md), so each closes whole.
- **Origin:** self-found · probed the gate while adding an in-document anchor to
  [proposal 001](../../proposals/001-md-corpus-rule-coverage.md) during the
  proposal-003/004 review round
- **Reported:** 2026-08-13
- **Pointers (2026-10-09, [plan 0406](../../plans/completed/0406-md-a-declared-link-is-answered.md)'s review):** the fragment split and the autofix moved to
  `model/resolve-link.ts` in [plan 0404](../../plans/completed/0404-md-one-link-resolver-names-each-case.md); the Symptom's pointers now cite them there. The other
  `resolve.ts` and `corpus.ts` line references below (`resolveTargets` at `resolve.ts:39-51`, the
  bare `:41`, `:69-70`, `:83`, `:88`, and `corpus.ts:40`) predate that move and are kept as
  history, not re-certified.

## Symptom

`packages/md/src/model/resolve-link.ts:152` splits the fragment off and throws it
away, on every path:

```ts
const withoutFragment = link.url.split('#')[0] ?? ''
if (withoutFragment === '') return [] // same-document anchor
```

Four consequences:

1. **A pure same-document anchor is skipped entirely.** `#anything` yields no
   targets (`:41`), and `linkResolves` treats an empty target list as "nothing to
   check" (`:88`) rather than as a link it declined to verify. `[text](#does-not-exist)`
   is indistinguishable from `[text](#real-heading)`.
2. **A cross-document fragment is half-checked.** `[x](../bugs/BUGS.md#dead-anchor)`
   verifies `work/bugs/BUGS.md` exists and never looks at `#dead-anchor`. The
   file half is gated; the half that says _where in it_ is not.
3. **The summary line reads as though it were.** `check:corpus` reports
   `links 251 internal · ✓ all resolve`, and `CLAUDE.md` tells agents that
   cross-links in `work/`, `adr/` and `docs/` "must resolve". A reader concludes
   their anchors are covered. The condition's own `description` is honest —
   `'resolve to an existing file'` (`:83`) — but nothing surfaces that distinction
   at the gate. [0138](../0138-pointer-resolve-proves-existence-not-truth.md)
   measures the sibling condition, `pointerResolves`: same shape, a `path:line`
   citation instead of a `#fragment`.
4. **The autofix carries a fragment it has never validated.** `movedLinkFix`
   deliberately preserves the fragment when rewriting a moved link
   (`packages/md/src/model/resolve-link.ts:270`, `:278`; moved there from `conditions/resolve.ts` by [plan 0404](../../plans/completed/0404-md-one-link-resolver-names-each-case.md)):

   ```ts
   const fragment = link.url.slice(path.length) // '' or '#anchor'
   const replacement = rel + fragment
   ```

   So `eess-md --fix` will rewrite `[x](./old.md#section)` → `[x](./new.md#section)`
   on basename match, transplanting an anchor onto a **different document** where
   it may not exist — and no rule will ever report it. This is the one path where
   the gap does more than under-report.

The skip is documented as intentional at `:35` ("or `[]` if it is a pure fragment
(`#anchor`)") and `:69-70` ("External links and pure anchors are skipped"), so
this is a known coverage boundary, not an accident. What is missing is that
nothing anywhere states the boundary to the person reading a green run — and
nothing revisited it when the autofix started emitting fragments.

## Reproduction

Probed against the live gate on 2026-08-13. In
`work/proposals/001-md-corpus-rule-coverage.md:107`, replace the real anchor with
a deliberately absent one:

```bash
sed -i '' 's|#correspondenceagree--value-not-just-existence|#this-anchor-does-not-exist-at-all|' \
  work/proposals/001-md-corpus-rule-coverage.md
npm run check:corpus
#   links     251 internal · ✓ all resolve
#   ✓ corpus integrity — 319 checks across 62 documents, 0 violations
```

Green, and the link count is **unchanged** — the link is counted as checked and
its fragment is not examined. The cross-document form reproduces the same way:
point any of the three `../bugs/BUGS.md#when-is-a-bug-fixed` links at
`#no-such-section` and the gate stays green.

## Root cause

`resolveTargets` (`resolve.ts:39-51`) is a **file** resolver, and an empty target
list is overloaded to mean two different things at the call site (`:88`): "this
link has no file part" and "this link needs no checking". A same-document anchor
takes the first meaning and receives the second.

Checking a fragment needs something the condition does not have: the heading
slugs of the _target_ document. The corpus parses every `.md` into an `MdDocument`
with sections, so the data exists for any target inside the corpus — but
`linkResolves` closes over `corpus.fileIndex` (a `ReadonlySet<string>` of paths,
`corpus.ts:40`), not over the documents. A target outside the corpus roots is not
parsed at all, which is the real constraint: three of the five live anchor links
point at `work/bugs/BUGS.md`, and `work/bugs/**` is outside `check:corpus`'s
roots (`scripts/check-corpus.mjs:22-24`, blocked on
[0086](./0086-links-to-directories-do-not-resolve.md)). So a complete fix has a
scope question, not just an implementation.

## Why it matters

It is the same class as [proposal 001](../../proposals/001-md-corpus-rule-coverage.md)'s
evidence item (6) — a reference shape that no rule can see, surviving every gate —
one shape over. There it was inline-code file paths; here it is the fragment half
of a link the gate otherwise checks.

It also lands on the corpus's own navigation. Anchors are how a long record points
into itself and into a sibling: `0067` links to its own `Close-out` section, and
three live plans cite `BUGS.md#when-is-a-bug-fixed` for the closing rule they are
bound by. Those are load-bearing citations — the kind that rot silently when a
heading is reworded, which is exactly the drift `check:corpus` exists to stop for
every other reference shape.

**Current state is clean**, and that is worth recording so a later reader knows
the gap was measured rather than assumed. All five internal anchor links in the
gated roots resolve correctly today:

| Link                                                             | Target heading                                                 | OK  |
| ---------------------------------------------------------------- | -------------------------------------------------------------- | --- |
| `work/plans/completed/0067-…:9` → `#close-out-2026-07-19`        | `## Close-out (2026-07-19)`                                    | ✓   |
| `work/proposals/001-…:107` → `#correspondenceagree--value-not-…` | `### \`correspondence().agree()\` — value, not just existence` | ✓   |
| `work/plans/0100-…:45` → `BUGS.md#when-is-a-bug-fixed`           | `### When is a bug fixed?`                                     | ✓   |
| `work/plans/0090-…:161` → `BUGS.md#when-is-a-bug-fixed`          | `### When is a bug fixed?`                                     | ✓   |
| `work/plans/0101-…:80` → `BUGS.md#when-is-a-bug-fixed`           | `### When is a bug fixed?`                                     | ✓   |

Verified by hand, which is the point: nothing else can.

**No longer clean (re-measured 2026-10-30, PR #280's enforcement re-check).** The
section above was true on 2026-08-13 and is history now. `check:corpus` loads
`work/**`, `adr/**` and `docs/**` (`scripts/check-corpus.mjs:115`), and those roots
hold 39 internal links with a fragment: 20 into another document, 9 within the
same document, and 10 site-absolute (`/cli#doctor`). At least two are dead, both
recorded in [bug 0562](./0562-two-anchors-in-the-docs-site-are-dead.md): one on
every renderer, one on the VitePress site only. The other 37 were not checked
here; the fix's dogfood row is what proves them.

**For an adopter the gap is live (added 2026-10-30).** The maintainer named GitHub
Flavored Markdown important: a README or a wiki links to its headings constantly,
so a corpus outside this repository is likely to hold the dead anchor this one
does not.

## Fix

Decided by [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md), section 5: the
linking document's renderer's anchor rule is a `LinkResolveOptions` member (heading texts in, ids
out, plus the ids' alias forms), GitHub's (`github-slugger`) by default; the anchor set is every
heading at any depth, read by eess-md's own text extraction, plus the HTML anchors the rule's
renderer keeps (under the default, `id` and `name` on `<a>`), from `html` nodes with comments
removed; `resolveLink` computes the verdict on the target and
each door decides what it means; the decoded fragment is compared exactly. The notes below are the
record of how the questions arose.

1. **Check the fragment when the target is in the corpus.** Slugify each
   heading the renderer anchors (superseded 2026-10-30: not the section index,
   see "The anchor set" below; the slug rule is the renderer's, see "Which
   renderer"), de-duplicated with `-1`, `-2`, and resolve the fragment against the
   target document's slug set. Same-document anchors resolve against
   the linking document's own headings, which needs no new data at all.

   **Letters outside ASCII are kept, not stripped (added 2026-10-30).** GitHub's
   slug keeps letters in any script, lowercased: `## Größe der Datei` is
   `#größe-der-datei`, and `## Kočka` is `#kočka`. Measured with
   `github-slugger` 2.0.0, which implements GitHub's rule, installed into an empty
   scratch directory (`npm i github-slugger@2.0.0`, then
   `node -e "import('github-slugger').then(m => console.log(new m.default().slug('Größe der Datei')))"`).
   A link may write the fragment percent-encoded (`#gr%C3%B6%C3%9Fe-der-datei`), so
   the fragment is decoded before it is compared, and decoding stays total: a
   malformed escape (`#gr%E0`) is a finding, never a `URIError`, since
   `resolveLink` promises not to throw (`packages/md/src/model/resolve-link.ts:188`).
   Whether a fragment and a heading are compared after NFC normalization is
   [bug 0560](../0560-a-link-that-differs-only-in-unicode-normalization-is-only-called-broken.md)'s
   question. A slug that strips such letters would turn every correct anchor into
   a heading written in another language into a false red. The exact rule is
   GitHub's, read from its slugger and pinned by rows, not restated from memory.

   **The anchor set is GitHub's, not the section index (added 2026-10-30, PR
   #280's enforcement review).** eess-md's sections leave out a heading inside a
   list item, a blockquote or a footnote definition
   (`packages/md/src/model/sections.ts:14`); GitHub gives each of them an anchor, so
   slugs built on sections would make `[x](#note)` to a `> ## Note` a false red and
   shift the `-1`/`-2` numbering. The anchor set is every heading the renderer
   anchors, plus explicit HTML anchors (`<a name="x">`, `<a id="x">`) and GitHub's
   `#user-content-…` alias. A fragment on a code file (`#L10`) is a line, and is
   checked as a pointer's line is, with
   [bug 0561](./0561-a-pointer-one-line-past-the-end-of-a-file-passes.md)'s count;
   any other fragment on a target that is not a document is reported as not
   judged under (3), never passed.

   **Which renderer (added 2026-10-30, PR #280's enforcement re-check).** The slug
   rule is the renderer's, and renderers differ. `docs/` is a VitePress site
   (`SITE_ROOTS`, `scripts/check-corpus.mjs:116`, no custom slugify in
   `docs/.vitepress/config.ts`), and VitePress's default `slugify`
   (`@mdit-vue/shared` 2.1.4; parity with the version `vitepress ^1.6.4` bundles not
   verified) gives, measured beside `github-slugger` 2.0.0:

   ```text
   heading                                  github                                vitepress
   A document's shape, built from blocks    a-documents-shape-built-from-blocks   a-document-s-shape-built-from-blocks
   Kočka                                    kočka                                 kocka
   Größe der Datei                          größe-der-datei                       große-der-datei
   Close-out (2026-07-19)                   close-out-2026-07-19                  close-out-2026-07-19
   ```

   So a single rule is a false green on one renderer or a false red on the other,
   and the non-ASCII examples above hold for GitHub only. The slug profile is an
   option of the rule (GitHub, VitePress), tied in this repository to the existing
   site/repo-native split (`scripts/lib/corpus-link-routing.mjs`), with VitePress's
   explicit `{#id}` anchors in its anchor set and a row per profile.

2. **Stop overloading the empty target list.** `resolveTargets` should
   distinguish "no file part, resolve the fragment locally" from "not a file
   reference, skip" rather than returning `[]` for both.
3. **Say what was not checked.** A fragment pointing at a document outside the
   corpus roots cannot be verified; that count belongs in the `check:corpus`
   summary (`N internal · M with fragments · K fragments unverifiable`) rather
   than being silently folded into "all resolve". Same convention as every other
   denominator the gate prints. **And in the rule itself (added 2026-10-30):** an
   adopter calling `links().should().resolve()` has no `check-corpus.mjs`, so the
   rule's own evidence says it did not judge the fragment, as a finding or as a
   subject it cannot judge ([ADR-021](../../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)),
   per [ADR-010](../../../adr/010-a-pass-is-constructed-from-evidence.md) and
   [ADR-014](../../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md). Today
   `[y](#nowhere)` counts toward `examined` with nothing checked.
4. **Make the autofix honest.** Either validate the fragment against the _new_
   target before emitting the rewrite in `movedLinkFix`, or drop the fix when the
   URL carries a fragment the fixer cannot verify. Transplanting an unvalidated
   anchor onto a different file is the one behaviour here that creates drift
   instead of missing it.
5. **Decide the out-of-roots scope.** _(Stale since `work/**` joined the roots;
   kept as history, 2026-10-30.)_ Three of five live anchors point into
   `work/bugs/**`, which `check:corpus` does not load. Either widen the roots
   (blocked on [0086](./0086-links-to-directories-do-not-resolve.md)) or parse
   link targets on demand for fragment checking only. This is the scope question
   the fix must answer, not an implementation detail.

**Built 2026-11-03.** `judgeFragment` (`packages/md/src/model/anchors.ts:164`) judges a fragment
against a document's anchor set under an `AnchorRule`, cached per rule and then per document;
`githubAnchors` (`:36`) is the default. `resolveLink` sets the verdict on `self` and `document`
targets (`verdictOn`, `packages/md/src/model/resolve-link.ts:199`), and `resolve()` reports one that
is absent or malformed (`fragmentMessage`, `packages/md/src/conditions/resolve.ts:119`). This
repository's `docs/` profile passes VitePress's rule (`scripts/check-corpus.mjs:263`,
`scripts/lib/vitepress-anchors.mjs`).

**Review round (2026-11-03).** The architect and enforcement reviews of the build changed it:

- The nearest anchors moved from the message to the finding's `Fix:` line, with the `anchorRule`
  hint, so a baseline entry (rule, element and message) holds when the target's other headings
  change.
- `resolveLink` throws `ArchConfigError` only for an `anchorRule` that breaks its contract; no URL
  makes it throw, and the docs say so.
- The option is `anchorRule`, not `anchors`, which read as a set.
- A line fragment after `?plain=1` (GitHub's source view) is not judged here: it names a line.
  It belongs with the `#L` form in [bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md).
- A fragment naming the `id` of an element the rule does not count is reported as that, not as a
  missing anchor.
- Fragments in raw HTML links, which `links()` reads since
  [plan 0580](../../plans/completed/0580-md-a-raw-html-link-is-resolved.md) Phase 2 and which
  [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md) did not measure, are checked like any other. Measured over the 574 README files in this
  repository's `node_modules` (`maxdepth 3`): 1,109 same-document HTML fragments, 30 dead under
  the GitHub rule (2.7%), the sampled ones all-contributors badge anchors (`#ideas-…`) that name
  nothing on GitHub either; and 3,931 Markdown ones, 48 dead, as the spike measured.
- The VitePress pin moved from `check:corpus` (and so `check:fast`) to `check:docs-code`.

Not measured, and not decided here: how GitHub slugs `## Notes[^1]` (the default reads `notes`; a
footnote mark may render as `notes1`), [spike 0574](../../spikes/0574-what-checking-a-link-fragment-needs.md)'s section 7 class. The gate's "not judged" count
is printed, not gated, until [bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md)
makes such a fragment a finding. Whether a fragment that equals an anchor after Unicode
normalization should resolve is [bug 0560](../0560-a-link-that-differs-only-in-unicode-normalization-is-only-called-broken.md)'s.

## Verification

- [x] Red test written first: `[x](#no-such-heading)` in a fixture document
      produces a violation: `packages/md/tests/link-fragments.test.ts` · `it('a same-document fragment that names no heading is reported')`.
      Ten of the file's rows red with the report switched off (measured).
- [x] Red test: `[x](./other.md#no-such-heading)` where `other.md` exists produces
      a violation naming the fragment, not the file: `it('a fragment on an existing document names the fragment, not the file')`.
- [x] Both real forms still pass — `#close-out-2026-07-19` and
      `BUGS.md#when-is-a-bug-fixed` — so the fix does not invert into false reds
      on correct slugs (punctuation-stripping and duplicate-heading suffixes are
      the two shapes most likely to): `it('punctuation and a question mark are slugged away, as GitHub does')`
      and `it('a repeated heading is numbered across containers')`; and the gate's 39 live
      fragments are green but 0562's two.
- [x] A heading with letters outside ASCII (`## Größe der Datei`) is reachable by
      its slug under each profile (GitHub, VitePress), written plain and
      percent-encoded, and a near miss is red: `it('a heading with letters outside ASCII is reached plain and percent-encoded, and a near miss is red')`,
      and in `scripts/lib/vitepress-anchors.test.mjs` the test titled "a heading with letters outside ASCII under the VitePress rule:
      plain and percent-encoded, and GitHub’s form is red".
- [ ] done-otherwise: the two dead anchors in
      [bug 0562](./0562-two-anchors-in-the-docs-site-are-dead.md) were reported by the gate
      before they were fixed in this PR (measured: `✗ 2 broken`, both "under the VitePress anchor
      rule"); the "VitePress only" half is the `corpus/links/fragment-site` non-vacuity row, whose
      slug is GitHub-valid and VitePress-dead.
- [x] `#gr%E0` is a finding, not a thrown `URIError`: `it('a malformed percent-escape is a finding, not a thrown error')`.
- [x] A heading inside a blockquote is reachable, and so is an `<a id>` anchor: `it('a heading inside a blockquote and an <a id> anchor are reached')`.
- [x] A `#user-content-…` anchor reaches its heading: `it('a user-content- fragment reaches its heading under GitHub’s rule')`.
- [ ] deferred→[bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md): a fragment
      on a code file (`./src/a.ts#L10`) is checked against the file's line count.
- [ ] deferred→[bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md): the rule's
      own result says which fragments it did not judge, without a caller's summary.
- [ ] deferred→[bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md):
      `movedLinkFix` no longer emits a rewrite carrying an unvalidated fragment.
- [ ] deferred→[bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md): a fragment
      on a directory, or on a file the corpus did not load, is read or reported.
- [x] Letter case: `[x](#Foo)` beside `## Foo` is red, and the finding names `#foo` as
      differing only in case. Pinned: `it('letter case counts, and the finding names the anchor that differs only in case')`.
- [x] The `user-content-` alias answers under GitHub's rule only: `#user-content-x` on a
      `docs/` link is red under the VitePress rule. Pinned: `scripts/lib/vitepress-anchors.test.mjs`, the test titled "no user-content- alias under the VitePress rule".
- [x] Duplicate numbering counts headings in containers: with two `## Dup`, one in a
      blockquote, `#dup-1` passes and `#dup-2` is red. Pinned: `it('a repeated heading is numbered across containers')`.
- [x] `{#install}` is the id under the VitePress rule (`#install` passes, the slug of the text
      is red) and is heading text under GitHub's. Pinned: `it('an explicit {#id} is heading text under GitHub’s rule')`, and in `scripts/lib/vitepress-anchors.test.mjs` the test titled "an explicit {#id} is the id under the VitePress rule, and its text is not".
- [x] `./this.md#x` (a path back to the same document), `/page#x` under `rootDir`, and a
      reference-style `[x][r]` with `[r]: ./other.md#x` are each checked. Pinned: `it('a path back to the same document, a site-absolute link and a reference-style link are each checked')`.
- [x] Heading text: inline code counts, image alt and inline HTML do not;
      `## Setup <Badge/>` is `#setup` under the VitePress rule and what `github-slugger` gives
      (`#setup-`) under the default, each pinned. Pinned: `it('inline code is heading text; an image’s alt and inline HTML are not')`, and in `scripts/lib/vitepress-anchors.test.mjs` the test titled "## Setup <Badge/> is #setup under the VitePress rule".
- [x] HTML anchors: an `<a id>` in a fenced block, an anchor inside an HTML comment and a
      `<meta name>` are not anchors; under the default rule a `<div id>` is not one either, and
      under the VitePress rule it is. Pinned: `it('an <a id> in a fence, one in an HTML comment, a <meta name> and a <div id> are no anchors under GitHub’s rule')`, and in `scripts/lib/vitepress-anchors.test.mjs` the test titled "a <div id> is an anchor under the VitePress rule".
- [x] `#top`, `#TOP` and an empty `#` resolve. Pinned: `it('#top in any letter case and an empty # name the top of the page')`.
- [x] The VitePress shapes of the spike's section 1 (an emoji shortcode, an entity, a
      footnote mark) are pinned: each matches VitePress, or is recorded as a bug.: none matches VitePress; pinned in `scripts/lib/vitepress-anchors.test.mjs` and recorded as [bug 0614](../0614-four-heading-shapes-the-vitepress-rule-reads-differently.md).
- [ ] done-otherwise: a test renders `docs/` with VitePress's `createMarkdownRenderer` and finds
      the gate's anchor sets equal to its ids. Built as: every rendered heading id is an anchor the
      gate's rule finds, and each document has as many ids as eess-md reads headings — a subset and
      a count, not list equality, since eess-md does not export its heading text
      (`scripts/lib/vitepress-anchors.test.mjs`, the test titled "every heading id VitePress renders
      for docs/ is an anchor under the gate’s rule"; about 2.4 s, under `check:docs-code`, not the
      gate or `check:fast`). It reds when the rule's slug drifts (measured).
- [x] Anchor sets are cached per rule: one corpus checked under both profiles gives each its
      own answer. Pinned: `it('one corpus judged under two rules gives each its own answer')`.
- [x] The `check:corpus` summary reports fragments checked and fragments it did not
      verify.: `links N internal · F fragments checked, K not judged`, counted from `resolveLink` (`scripts/check-corpus.mjs`); 39 checked, 0 not judged today.
- [x] Non-vacuity rows, one per routing region, each red on its own: a `docs/` probe with a
      GitHub-valid, VitePress-dead slug (red only if the site profile really passes the
      VitePress rule), and a `work/` probe with a dead fragment on an existing document. The
      existing `corpus/links` rows cannot, since they cover missing files only.: `corpus/links/fragment-site` and `corpus/links/fragment-repo` in `scripts/check-nonvacuity.mjs`, appended so no other row changes shard; the site row reports MISSING with the site's `anchorRule` removed (measured); the repo row links
      across documents, into `work/bugs/BUGS.md`.
- [x] A changeset naming `@nielspeter/eess-md`, a minor marked
      `**Breaking (@nielspeter/eess-md):**` with a migration line, since `resolve()` newly reds
      on adopters' corpora; released together with
      [bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md)'s.: `.changeset/a-link-fragment-names-an-anchor.md`.
- [x] `npm run validate` green.

Deferred:

- [bug 0575](../0575-a-fragment-the-link-check-cannot-judge-passes.md): a fragment on a file the
  corpus did not load or on a directory, the `#L` line form and the autofix (see Scope).
- _(Stale 2026-10-30: `work/**` is in the roots now, and 0086 is fixed.)_
  **Widening `check:corpus` roots to `work/bugs/**`\*\* → blocked on
  [0086](./0086-links-to-directories-do-not-resolve.md), which already owns that
  scope decision. This record closes on fragment checking within whatever roots
  are loaded; if the answer to fix (5) is on-demand parsing, it closes without
  waiting on 0086 at all.
