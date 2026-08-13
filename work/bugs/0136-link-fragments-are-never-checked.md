# Bug 0136: `linkResolves` discards the fragment — a link to a real file with a dead anchor is green, and the autofix rewrites anchors it never validates

## Status

- **State:** Draft — root cause read from the source and confirmed by probing the
  live gate (see _Reproduction_). No red test yet.
- **Severity:** Medium — an honesty gap between a stated claim and its actual
  mechanism, which is `BUGS.md`'s Medium row. **Not** High: all five internal
  anchor links in the gated roots are correct today (verified below), so nothing
  is currently passing over drift that is present. The argument for High is the
  autofix path in _Symptom_ (4), which can actively **produce** a dead anchor
  rather than merely fail to notice one.
- **Origin:** self-found · probed the gate while adding an in-document anchor to
  [proposal 001](../proposals/001-md-corpus-rule-coverage.md) during the
  proposal-003/004 review round
- **Reported:** 2026-08-13

## Symptom

`packages/md/src/conditions/resolve.ts:40` splits the fragment off and throws it
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
   at the gate.
4. **The autofix carries a fragment it has never validated.** `movedLinkFix`
   deliberately preserves the fragment when rewriting a moved link
   (`resolve.ts:114-115`, `:123`):

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
[0086](./fixed/0086-links-to-directories-do-not-resolve.md)). So a complete fix has a
scope question, not just an implementation.

## Why it matters

It is the same class as [proposal 001](../proposals/001-md-corpus-rule-coverage.md)'s
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

## Fix

1. **Check the fragment when the target is in the corpus.** Slugify each
   `MdDocument`'s section headings (GitHub rules: lowercase, strip punctuation,
   spaces → hyphens, de-duplicate with `-1`, `-2`) and resolve the fragment
   against the target document's slug set. Same-document anchors resolve against
   the linking document's own headings, which needs no new data at all.
2. **Stop overloading the empty target list.** `resolveTargets` should
   distinguish "no file part, resolve the fragment locally" from "not a file
   reference, skip" rather than returning `[]` for both.
3. **Say what was not checked.** A fragment pointing at a document outside the
   corpus roots cannot be verified; that count belongs in the `check:corpus`
   summary (`N internal · M with fragments · K fragments unverifiable`) rather
   than being silently folded into "all resolve". Same convention as every other
   denominator the gate prints.
4. **Make the autofix honest.** Either validate the fragment against the _new_
   target before emitting the rewrite in `movedLinkFix`, or drop the fix when the
   URL carries a fragment the fixer cannot verify. Transplanting an unvalidated
   anchor onto a different file is the one behaviour here that creates drift
   instead of missing it.
5. **Decide the out-of-roots scope.** Three of five live anchors point into
   `work/bugs/**`, which `check:corpus` does not load. Either widen the roots
   (blocked on [0086](./fixed/0086-links-to-directories-do-not-resolve.md)) or parse
   link targets on demand for fragment checking only. This is the scope question
   the fix must answer, not an implementation detail.

## Verification

- [ ] Red test written first: `[x](#no-such-heading)` in a fixture document
      produces a violation. Green today.
- [ ] Red test: `[x](./other.md#no-such-heading)` where `other.md` exists produces
      a violation naming the fragment, not the file.
- [ ] Both real forms still pass — `#close-out-2026-07-19` and
      `BUGS.md#when-is-a-bug-fixed` — so the fix does not invert into false reds
      on correct slugs (punctuation-stripping and duplicate-heading suffixes are
      the two shapes most likely to).
- [ ] `movedLinkFix` no longer emits a rewrite carrying an unvalidated fragment.
- [ ] The `check:corpus` summary reports fragments checked and fragments it could
      not verify.
- [ ] A non-vacuity fixture reddens on a dead fragment — the existing
      `corpus/links` fixture cannot, since it only covers missing files.
- [ ] A changeset naming `@nielspeter/eess-md` — `linkResolves` behaviour and the
      autofix are consumer-visible.
- [ ] `npm run validate` green.

Deferred:

- **Widening `check:corpus` roots to `work/bugs/**`\*\* → blocked on
  [0086](./fixed/0086-links-to-directories-do-not-resolve.md), which already owns that
  scope decision. This record closes on fragment checking within whatever roots
  are loaded; if the answer to fix (5) is on-demand parsing, it closes without
  waiting on 0086 at all.
