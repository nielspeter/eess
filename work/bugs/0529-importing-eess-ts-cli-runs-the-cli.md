# Bug 0529: importing `@nielspeter/eess-ts/cli` runs the CLI

## Status

- **State:** Draft — recorded 2026-10-19 from PR #253's devops review (item 5); measured by the
  reviewer.
- **Severity:** Low — an import of the subpath fails loudly rather than passing, and it predates this
  release: published eess-ts 0.13.1 behaves the same.
- **Origin:** self-found · PR #253's devops review
- **Reported:** 2026-10-19

## Symptom

`import '@nielspeter/eess-ts/cli'` runs the CLI as a side effect, printing
`Error: No command specified`, and the module exports nothing. The reviewer saw it while importing
every published subpath from the six release tarballs: it was the only empty entry of 28.

## Root cause

The `./cli` export (`packages/ts/package.json:11`) points at `dist/cli/bin.js`, the bin script, whose
body is `void run(process.argv.slice(2))` (`packages/ts/src/cli/bin.ts:4`). The importable module,
`dist/cli/index.js`, is not what the subpath names.

## Fix

Undecided: point `./cli` at the module that exports `run` and keep the bin separate, or drop the
subpath if nothing should import it. Either is a change to a published entry point and needs a
changeset that says which.

## Verification

- [ ] Red test written first: importing the `./cli` subpath runs nothing, or the decided
      alternative's test.
- [ ] `npm run validate` green.

Deferred: none
