# Bug 0559: a code pointer into a path with a non-ASCII letter is skipped, or reported against a truncated path

## Status

- **State:** Draft — measured on the v0.16.0 build (eess-md 0.13.0), Node 24.22.0; no red test yet.
- **Severity:** High — a false green: a stale pointer into such a file can pass unread; and where it
  is read, the finding names a file the document never cites.
- **Origin:** self-found · the maintainer's question, 2026-10-30, about letters outside ASCII;
  measured by probing pointers and links with German and Czech names.
- **Reported:** 2026-10-30

## Symptom

`pointers()` finds a `path.ext:line` pointer with a pattern whose path class is ASCII only
(`packages/md/src/model/pointers.ts:27`):

```ts
String.raw`([A-Za-z0-9_./\[\]-]+\.(?:${CODE_EXT})):(\d+)(?:-(\d+))?`
```

So a pointer into a path holding a letter outside that class is read wrong, in one of two ways
(the examples are pointers to line 99, written in the fence below so this record's own gate does
not read them):

```text
src/maß.ts:99     skipped: no ASCII run before `.ts`, so the stale pointer is green
src/über.ts:99    truncated: read as ber.ts:99
src/kočka.ts:99   truncated: read as ka.ts:99
```

1. **Skipped**, when the letter sits right before the extension: the pattern finds nothing.
2. **Truncated**, otherwise: the pattern matches the ASCII tail after the last such letter, and
   reports a broken pointer to a file the document does not name, so a fix aimed at that file is
   aimed at nothing.

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
   stale code pointer: src/plain.ts has 3 lines; "src/plain.ts:99" references line 99
   broken code pointer: "ber.ts:99" — no such file in the repo
   broken code pointer: "ka.ts:99" — no such file in the repo
```

Four stale pointers: one is reported for what it is, two are reported against the wrong path, and
the one into `src/maß.ts` is not examined.

## Root cause

The path class in `POINTER_RE` (`packages/md/src/model/pointers.ts:27`) admits ASCII letters,
digits and `_ . / [ ] -` only. Nothing before or after the match checks that it starts where the
path starts, so a match can begin in the middle of a name.

## Fix

Not chosen. A path class that admits letters outside ASCII (Unicode letter and mark classes, with
the `u` flag), and a boundary so a match never starts inside a name, with the existing ASCII forms
kept. A name normalised differently from the file on disk (NFC against NFD) is
[bug 0560](./0560-a-link-that-differs-only-in-unicode-normalization-is-only-called-broken.md)'s for
links; the same question applies here and is answered there.

## Verification

- [ ] Red test written first: the reproduction's pointer into `src/maß.ts` is reported stale.
      Green today.
- [ ] Red test: the pointers into `src/über.ts` and `src/kočka.ts` are reported stale, naming the
      cited path. Today they are reported broken against `ber.ts` and `ka.ts`.
- [ ] The ASCII forms in use (`[id].vue`, ranges `:3-7`, a pointer in backticks) still read as
      before.
- [ ] A nonvacuity row reddens on a stale pointer into a non-ASCII path.
- [ ] A changeset naming `@nielspeter/eess-md`.
- [ ] `npm run validate` green.

Deferred: none
