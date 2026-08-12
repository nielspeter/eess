# Bug 0094: the md↔ts README snippet silently checks nothing for the common ADR layout

## Status

- **State:** Draft — confirmed against the source and the README; no red test
  written yet.
- **Reported:** 2026-08-12 — self-found during the [plan 0091](../plans/0091-cross-dialect-examples-checked.md)
  review, when the customer persona checked whether the copyable snippet would
  actually fail on drift.

## Symptom

`adrCitationsResolve` defaults `dir` to `docs/adr/**`. The README's copyable
Markdown↔TypeScript snippet passes no `dir`, so an adopter whose ADRs live at
`adr/` — the common convention, and this repo's own layout — gets a **green check
that examines nothing**. The central promise ("drift fails the build") is silently
untrue for the most common setup.

## Reproduction

```typescript
// packages/crossvalidate/README.md — the copyable snippet, verbatim
adrCitationsResolve(corpus({ roots: ['docs/**'] }), project('tsconfig.json'))
```

With ADRs at `adr/` (not `docs/adr/`), this resolves zero citations and passes.
The repo's own gate learned this the hard way — `scripts/check-crossval.mjs:54-62`
sets `dir: 'adr/**'` explicitly and comments that omitting it "would silently
check zero documents (green-but-empty)".

## Root cause

`packages/crossvalidate/src/md-ts.ts:94`:

```ts
const dir = options.dir ?? 'docs/adr/**'
```

The default is a single layout, and the README snippet never overrides it. The
gate that dogfoods the package sets `dir`; the README that teaches adopters does
not.

## Fix

Add `dir` to the README snippet (and/or document the default loudly right at the
snippet), so the copyable form is non-vacuous for the common `adr/` layout:

```typescript
adrCitationsResolve(corpus({ roots: ['docs/**'] }), project('tsconfig.json'), {
  dir: 'adr/**',
})
```

## Verification

- [ ] Red test written first: a fixture with ADRs at `adr/` where a cited `it()`
      title is missing → `adrCitationsResolve` **without** `dir` passes
      (green-but-empty); with `dir: 'adr/**'` it fails.
- [ ] The README snippet is updated and its `dir` matches the fixture.
- [ ] `npm run validate` green.

Deferred: none
