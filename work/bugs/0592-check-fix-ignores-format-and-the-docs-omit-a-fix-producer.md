# Bug 0592: `check --fix` ignores `--format`, and the docs leave out a fix producer

## Status

- **State:** Draft — reproduced 2026-11-01 on `bd78b962`; no red test yet.
- **Severity:** Medium — no false green: the exit code and the edits are right. But a caller who
  asked for `--format json` gets plain text on stdout with exit 0, so a script that parses the
  output fails, or reads nothing, with no word from eess. The docs gap means a reader of
  [`docs/cli.md`](../../docs/cli.md) does not know the mention fix can be applied by `--fix`.
- **Origin:** self-found · [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md)'s
  review (product lens, measured), which asked for both to be recorded outside the proposal: the
  first is a defect whatever the proposal's Ask B rules, and the second is a docs gap.
- **Reported:** 2026-11-01

The two parts are one record because they share a fix site: the `--fix` section of [`docs/cli.md`](../../docs/cli.md)
is where the producers are listed and where the format behaviour must be stated.

## Symptom

1. **`--format` is dropped under `--fix`.** `runCheck` resolves the format and passes it on,
   `runFix(args.ruleFiles, { format }, …)` (`packages/ts/src/cli/commands/check.ts:62`). `runFix`
   (`packages/ts/src/cli/commands/check.ts:359`) never reads `options`. It writes its plain-text
   dry run to stdout (`packages/ts/src/cli/commands/check.ts:462-469`) for every format. `--format
json` and `--format github` give the same text as the terminal format, and exit 0.
   `docs/cli.md:82` documents `--format` for `check` with no exception for `--fix`.
2. **The docs name two `--fix` producers; there are three.** `docs/cli.md:41`: "`--fix` applies the
   repairs eess can prove are unique — a broken markdown link whose target moved to exactly one
   file, or a shortened `path:line` pointer that resolves to one file." The mention fix
   ([plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md),
   `mentions(…).should().beLinked({ fix })`, `packages/md/src/conditions/be-linked.ts:134`) is a
   third. It is the one that proposes thousands of edits in a run, so a reader most needs to
   know it reaches `--fix`.

## Reproduction

Measured 2026-11-01 with the CLI from `packages/ts/dist` (built 09:29 the same day; the last commit
touching `packages/ts/src/cli` is `50e17370`, 2026-09-29), run in a scratch directory outside this
repository. The scratch project holds `docs/index.md` linking `./old/target.md`, which moved to
`docs/guide/target.md`, and this rule file:

```js
// rules.mjs
import { corpus, links } from '<repo>/packages/md/dist/index.js'
const c = corpus({ cwd: import.meta.dirname, roots: ['docs/**/*.md'] })
export default [links(c).should().resolve()]
```

Output (each run 0.30 to 0.34 s wall time):

```text
=== check rules.mjs --fix
eess-ts --fix (dry run — pass --apply to write)
  would fix: rewrite link "./old/target.md" → "./guide/target.md"
1 fix(es) would apply across 1 file(s)
exit: 0
=== check rules.mjs --fix --format json
eess-ts --fix (dry run — pass --apply to write)
  would fix: rewrite link "./old/target.md" → "./guide/target.md"
1 fix(es) would apply across 1 file(s)
exit: 0
=== check rules.mjs --fix --format github
eess-ts --fix (dry run — pass --apply to write)
  would fix: rewrite link "./old/target.md" → "./guide/target.md"
1 fix(es) would apply across 1 file(s)
exit: 0
```

Piping `check rules.mjs --fix --format json` into `JSON.parse`:

```text
JSON.parse: Unexpected token 'e', "eess-ts --"... is not valid JSON
```

Without `--fix`, `check rules.mjs --format json` prints a JSON report (`{ "summary": …,
"violations": [ … ] }`), so the format is honoured on every path except `--fix`.

For part 2, a rule file with the [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)
mention fix, over a `docs/notes.md` holding one plain mention of the scratch project's record
`work/bugs/0001-a.md`, goes through the same `--fix` door (0.34 s):

```text
=== check mention.rules.mjs --fix --format json
eess-ts --fix (dry run — pass --apply to write)
  would fix: docs/notes.md:3 link "bug 0001" → ../work/bugs/0001-a.md
1 fix(es) would apply across 1 file(s)
exit: 0
```

## Root cause

1. `runFix` was written to render one text form ([plan 0066](../plans/completed/0066-eess-deterministic-autofix.md)).
   It takes `CheckOptions` for its signature but has no branch on `options.format`, and nothing
   refuses a format it cannot render.
2. `docs/cli.md:41` was written when the moved link and the pointer were the only producers, and
   [plan 0550](../plans/completed/0550-a-plain-mention-is-fixed-to-the-one-record-it-names.md)
   did not update it.

## Fix

Not designed. The direction:

1. `--fix` must not print text when the caller explicitly asked for another format. What the JSON
   form of a dry run carries (each fix, its target) is
   [proposal 020](../proposals/020-a-fix-dry-run-a-reader-can-review.md)'s Ask B, and this bug must
   not decide it. Until it is ruled, the smallest honest fix refuses an explicit `--format json` or
   `--format github` with `--fix`: an error that says the dry run has a text form only, and a
   non-zero exit. `--format auto` must keep working: `detectFormat()`
   (`packages/core/src/environment.ts:10`) resolves to `github` under GitHub Actions, so refusing
   the resolved format would break every `check --fix` in CI. The refusal reads the format as
   written, not as resolved.
2. `docs/cli.md:41` lists all three producers, the mention fix with a link to its section, and
   states the format behaviour from part 1.

## Verification

- [ ] Red test written first, through the CLI entry point: `check <rules> --fix --format json`
      does not print the plain-text dry run with exit 0.
- [ ] The same for `--format github`.
- [ ] `check <rules> --fix` with `--format auto` and `GITHUB_ACTIONS=true` still prints the dry run.
- [ ] `check <rules> --fix` and `--fix --apply` in the terminal format are unchanged.
- [ ] [`docs/cli.md`](../../docs/cli.md) names the mention fix as a `--fix` producer, and states what `--format` does
      under `--fix`.
- [ ] `cd packages/ts && npx vitest run tests/docs` green after the docs edit.
- [ ] A changeset naming `@nielspeter/eess-ts`.
- [ ] `npm run validate` green.

Deferred: none
