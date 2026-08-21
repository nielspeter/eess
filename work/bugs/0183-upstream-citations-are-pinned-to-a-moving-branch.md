# Bug 0183: upstream citations are pinned to a moving branch

## Status

- **State:** Draft — the rot channel is open; nothing is broken yet.
- **Found:** 2026-08-20, architect and devops review of the bug 0179 fix.

## Symptom

124 citations in shipped source now read:

```
https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/NNNN-….md
```

They resolve today (spot-checked; the repo is public and returns 200). Two
properties make that fragile in a way this repo normally refuses:

1. **`blob/main` is a moving ref.** `ts-archunit` renames files on purpose —
   `bugs/NNNN` → `bugs/fixed/NNNN` is its close ritual, the same one eess uses.
   That is precisely the mechanism
   [ts-archunit bug 0046](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0046-cross-document-links-rot-silently.md)
   is named after, now aimed at a repository eess does not control. (That citation
   is itself an instance of what this record describes — it is upstream history
   with no eess equivalent, and it is pinned to `main`.)
2. **No gate can see them.** `cross-document-links-resolve.test.ts` skips
   absolute URLs by construction (`if (/^(https?:|mailto:)/.test(raw)) continue`),
   and `check:corpus` does not read `packages/`. Measured in `packages/ts`:
   25 relative citations checked, 109 absolute ones skipped.

They also **ship**: tsc carries JSDoc into `.d.ts` and line comments into emit,
so `packages/core/dist` and `packages/ts/dist` both contain these URLs. They are
what a consumer's editor shows on hover.

## Root cause

Bug 0179's fix converted foreign-corpus citations to absolute URLs — the right
call, since those records genuinely have no eess equivalent — but pinned them to
`main` rather than to an immutable ref.

## Fix

Not built, and cheap: rewrite `/blob/main/` to `/blob/<tag-or-sha>/`. Same URL
shape, same reader experience, immutable target, rot channel closed. No network
gate required, which is the point — a link that cannot rot needs no checker.

Pick the `ts-archunit` commit that corresponds to the fold (the last release
before `@nielspeter/eess-ts` took over), so the citations describe the project at
the moment the code was carried across.

A separate, smaller question worth deciding at the same time: `@nielspeter/eess`,
the dialect-independent kernel, now ships 15 provenance URLs to the TypeScript
dialect's predecessor in its published `.d.ts`. That may be correct — the code
did come from there — but it should be a decision rather than a side effect.

## Verification

- [ ] No `github.com/nielspeter/ts-archunit/blob/main/` remains in
      `packages/*/src` or `packages/*/tests`.
- [ ] The pinned ref resolves for a sample of the rewritten paths.
- [ ] The choice of ref is recorded here, so a later reader knows what the
      citations describe.
