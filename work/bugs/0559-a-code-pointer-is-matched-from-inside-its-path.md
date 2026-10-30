# Bug 0559: a code pointer is matched from inside its path, so it is skipped, truncated, or checked against another file

## Status

- **State:** Draft — measured on the v0.16.0 build (eess-md 0.13.0), Node 24.22.0; no red test yet.
  Reframed 2026-10-30 after PR #280's enforcement review: filed as a non-ASCII defect, the root
  cause is a path class with no left boundary, and non-ASCII letters are one way to hit it.
- **Severity:** High — a false green: a stale pointer can pass unread, or pass against a file the
  document never names; and where it is reported, the finding and its fix name the wrong path.
- **Origin:** self-found · the maintainer's question, 2026-10-30, about letters outside ASCII;
  measured by probing pointers with German and Czech names, widened by the enforcement review.
- **Reported:** 2026-10-30

## Symptom

`pointers()` finds a `path.ext:line` pointer with a pattern whose path class admits ASCII letters,
digits and `_ . / [ ] -` only, with nothing marking where a path starts
(`packages/md/src/model/pointers.ts:27`):

```ts
String.raw`([A-Za-z0-9_./\[\]-]+\.(?:${CODE_EXT})):(\d+)(?:-(\d+))?`
```

So a path holding any other character is matched from just after it. Measured, each file two
lines, each pointer to line 99 unless shown (written in a fence, so this record's own gate does
not read them):

```text
src/maß.ts:99                  skipped: no run of the class before `.ts`; green
src/über.ts:99                 truncated: broken "ber.ts:99"
src/kočka.ts:99                truncated: broken "ka.ts:99"
src/übersicht.ts:1 (NFD name)  truncated: broken "bersicht.ts:1"; the combining mark is outside the class
src/routes/+page.ts:99         truncated: broken "page.ts:99"
app/(auth)/login/page.tsx:99   truncated: stale "/login/page.tsx:99"
packages/@scope/x.ts:99        truncated: broken "scope/x.ts:99"
src/a b.ts:99                  truncated: broken "b.ts:99"
```

Four ways it goes wrong:

1. **Skipped.** When the character sits right before the extension, nothing matches, and the stale
   pointer is green.
2. **Checked against another file.** Resolution is by suffix by default
   (`packages/md/src/conditions/pointer-resolve.ts:13`), so a truncated path can resolve. Measured:
   with `src/über.ts` (2 lines) and `lib/ber.ts` (200 lines), the stale pointer to line 99 of
   `src/über.ts` gives `examined 1 · violations 0`: it is checked against `lib/ber.ts`, and passes.
3. **Reported against the wrong path.** Otherwise a truncated pointer is reported broken against a
   file the document does not name.
4. **A fix that corrupts, or a remedy that cannot clear.** When the character ends a directory name
   (`src/café/index.ts`, line 2), the match is `/index.ts`:
   - with `paths: 'exact'`, the finding carries a fix replacing the match with `src/café/index.ts`;
     applied, the pointer's path reads `src/cafésrc/café/index.ts` (measured from the fix's span);
   - by suffix, with another `index.ts` in the repo, it is "ambiguous … cite a longer suffix", and
     the pointer already is the whole path.

## Reproduction

Four files under `src/`, two lines each: `plain.ts`, `maß.ts`, `über.ts`, `kočka.ts`. One document
under `docs/**`:

```markdown
# Pointers

- `src/plain.ts:99`
- `src/maß.ts:99`
- `src/über.ts:99`
- `src/kočka.ts:99`
```

`pointers(corpus({ cwd, roots: ['docs/**'] })).should().resolve().violations()`, measured:

```text
pointers: examined 3 · violations 3
  line 3 stale code pointer: src/plain.ts has 3 lines; "src/plain.ts:99" references line 99
  line 5 broken code pointer: "ber.ts:99" — no such file in the repo
  line 6 broken code pointer: "ka.ts:99" — no such file in the repo
```

Four stale pointers: one is reported for what it is, two against the wrong path, and the one into
`src/maß.ts` is not examined. ("3 lines" for a two-line file is a separate defect,
[bug 0561](./fixed/0561-a-pointer-one-line-past-the-end-of-a-file-passes.md).)

## Root cause

The path class in `POINTER_RE` (`packages/md/src/model/pointers.ts:27`) is narrower than the
characters paths hold, and nothing checks that a match starts where the path starts, so a match can
begin in the middle of a name.

## Fix

Not chosen. Two requirements, whatever the shape:

- **Read the paths in use.** Letters and marks in any script (the `u` flag and Unicode classes,
  NFD names included), and `+ ( ) @` and spaces where a path holds them.
- **Never drop a pointer the scan cannot place.** A match that would start inside a name is
  reported as a pointer that cannot be judged ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md)'s
  shape), never left out: `(` is prose in `(see src/a.ts …)` and part of the path in
  `app/(auth)/…`, so some cases cannot be decided, and a boundary that silently drops them would
  turn today's red-but-misattributed `+page.ts` into a skipped green, which is the defect this
  record is for.
- **Keep the readings that are right today.** In prose, `(` `@` `,` and a word before a path
  are delimiters, and each of these is read correctly today as `src/a.ts`, reported stale against
  the right file: the path in parentheses, the `@file` form agent instruction files use, `see`
  before the path, and a list of two. Admitting `+ ( ) @` and spaces into the class without care
  turns them into broken or unjudged findings that cannot be suppressed
  ([ADR-021](../../adr/021-a-predicate-that-cannot-judge-a-subject-says-so.md) rule 5). This
  repository cannot show it: all 1,247 pointers in its live corpus sit in backticks (PR #280's
  enforcement re-check).
- **Decide where the start is known.** Inside an inline code span, the span's start is where the
  path starts, so `app/(auth)/…` and `src/a b.ts` in backticks can be decided; only bare prose is
  ambiguous. A candidate, not measured as a design. An unjudged pointer's finding names the remedy
  that clears it: put the path in a code span.
- **No fix over a span that is not the whole cited path.**

A name normalised differently from the file on disk (NFC against NFD) is
[bug 0560](./0560-a-link-that-differs-only-in-unicode-normalization-is-only-called-broken.md)'s
question for links and for pointers; it is answered there.

## Verification

- [ ] Red test written first: the reproduction's pointer into `src/maß.ts` is reported stale.
      Green today.
- [ ] Red test: the pointers into `src/über.ts` and `src/kočka.ts` are reported stale, naming the
      cited path. Today they are reported broken against `ber.ts` and `ka.ts`.
- [ ] Red test: the stale pointer into `src/über.ts` stays red when a `lib/ber.ts` long enough
      exists. Green today.
- [ ] An NFD-named file is read whole.
- [ ] Each ASCII shape above (`+page.ts`, `(auth)/`, `@scope/`, a space) is read whole or reported
      as not judged, and is never absent from the findings.
- [ ] No fix is emitted over a span that is not the whole cited path (the `src/café/index.ts` case).
- [ ] The ASCII forms in use (`[id].vue`, ranges `:3-7`, a pointer in backticks) still read as
      before.
- [ ] In prose, a pointer in parentheses, after `@`, after a word and in a comma list still reads
      as the bare path, reported against the right file (the rows' pointers in a fixture, not
      here).
- [ ] A nonvacuity row reddens on the skipped shape (`src/maß.ts`), or asserts a message naming
      the cited path: a truncated-shape probe is red today through the misattributed finding, so
      it would prove nothing.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
