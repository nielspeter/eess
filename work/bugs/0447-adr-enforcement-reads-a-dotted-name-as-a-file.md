# Bug 0447: `adrEnforcement` reads a dotted name such as `it.skip` as a file path and reports it missing

## Status

- **State:** Draft — recorded 2026-10-16; reproduced here on main's build. No red test yet.
- **Severity:** Low — a false red, not a false green; but the workaround is turning
  `verifyCitations` off, which turns off the real check too.
- **Origin:** inbound · an adopter monorepo (unnamed), feedback on proposal 017, verified here.
- **Reported:** 2026-10-16

## Symptom

`adrEnforcement` treats any backticked span shaped `name.ext` in a Mechanism cell as a cited file
(`PATH_RE`, `packages/md/src/rules/adr.ts:50`). Reproduced on an ADR whose Enforcement rows mention
`` `it.skip` ``, `` `describe.each` `` and `` `process.env` ``: each is reported as
`adr/citations-resolve` "cites missing file". A real `` `vitest.config.ts` `` in the same row
resolves. Adopters then pass `verifyCitations: false`, which also stops checking the paths that are
real.

Related, not this bug: bug 0128 (the Status column is validated by nothing).

## Fix

Decide what a citation is so that a dotted identifier is not one: for example, a path needs a
separator or a known extension, or the cell's identifiers are resolved and the rest reported as
unread. ADR-018's rule applies: a string that names code is resolved, or the rule says why not.

## Verification

- [ ] Red first: the three-row ADR above
- [ ] Green: the dotted names are not reported as files, `vitest.config.ts` still resolves, and a
      missing real path still reds

Deferred: none
