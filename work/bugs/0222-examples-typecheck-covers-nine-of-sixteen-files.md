# Bug 0222: `check:examples` typechecks 9 of the 16 TypeScript files in `examples/`

## Status

- **State:** Draft — measured 2026-08-23; fix not built.
- **Priority:** Medium — no live incorrectness, but it is a gate whose denominator is
  whatever matched a glob rather than what is there, and the untypechecked half includes
  the fixtures three cross-dialect gates run against.
- **Origin:** self-found — writing `scripts/nonvacuity/bad-waived-gates.mjs`, the fixture
  that removed this gate's `'no-gate-yet'` waiver. The probe was planted as a plain `.ts`
  file and the gate passed.

## Symptom

`examples/tsconfig.json` declares `"include": ["*.test.ts"]`. In tsconfig globs a single
`*` does not cross a directory separator, so the gate loads **top-level `.test.ts` files
only**. Measured with `tsc --listFiles`:

| loaded (9)                                                                                                                                                           | not loaded (7)                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `archunit-inspired.test.ts`, `clean-architecture.test.ts`, `custom-rules.test.ts`, `rest-api.test.ts`, `type-safety.test.ts`, and the four `cross-dialect.*.test.ts` | `vitest.config.ts`, `fixtures/calc/src/calc.ts`, `fixtures/adr/tests/example.test.ts`, `fixtures/gherkin-ts/covered/all.cases.ts`, `fixtures/gherkin-ts/green/green.cases.ts`, `fixtures/gherkin-ts/red/ambiguous.cases.ts`, `fixtures/gherkin-ts/red/bad-title.cases.ts`, `fixtures/gherkin-ts/red/dangling.cases.ts` |

Note the second column includes `fixtures/adr/tests/example.test.ts` — a `.test.ts` file that
is **still** not loaded, because it is nested. The pattern excludes by depth, not by kind,
which is not what its shape suggests.

## Repro

```bash
printf 'export const broken: number = "not a number"\n' > examples/__probe__.ts
npm run check:examples   # → exit 0
rm examples/__probe__.ts
```

Move the same file to `examples/__probe__.test.ts` and the gate reds (exit 2 — `tsc`'s
code for compile errors, worth knowing when asserting on it).

## Root cause

`"include": ["*.test.ts"]` answers "which files are examples?" with a glob that was true
when the directory was flat. `examples/fixtures/` was added later — it is the corpus the
`cross-dialect.*` gates run against — and nothing widened the include. The gate's
denominator is therefore supply-shaped: it checks what the pattern happens to match, and
reports success without stating how many files that was.

That is the same defect class as
[bug 0220](./0220-nothing-requires-a-public-symbol-to-be-documented.md) one directory over:
a check over a set nobody chose.

## Fix

1. **Widen the include** to `["**/*.ts"]` (or `["**/*.test.ts", "fixtures/**/*.ts"]` if the
   fixtures need different `compilerOptions`). Expect the seven currently-unloaded files to
   red on first run; that is the point, and they should be fixed rather than excluded.
2. **Print the denominator.** `check:examples` currently reports only vitest's own
   `N passed`. It should say how many files it typechecked, so a shrinking scope is visible
   the way `check:corpus`'s `N documents` is.

Both halves matter: widening without reporting leaves the next narrowing silent.

## Verification

- [ ] Red first: a non-compiling `.ts` anywhere under `examples/`, at any depth, reds the
      gate. Currently only top-level `*.test.ts` does.
- [ ] The gate prints the number of files it typechecked.
- [ ] `bad-waived-gates.mjs`'s probe moves back to a plain `.ts` path, which is where it
      was written before this hole forced it into `.test.ts`.
