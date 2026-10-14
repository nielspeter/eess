# Proposal 016 — eess-py: a Python dialect that states what eess-ts states

**State:** Draft — filed 2026-10-14 at the maintainer's request; not reviewed.
**Priority:** Medium — no shipped rule over-claims, since eess reads no Python today. A Python
project cannot state its architecture decisions as rules at all, and one consuming project is
already half-Python (proposal 014).
**Origin:** self-found · the maintainer's request, 2026-10-14: "make an eess-py, equivalent to
eess-ts". Engine measured in [spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md).
**Affects:** a new package, `@nielspeter/eess-py`. The kernel is not expected to change; any change
it needs is a finding of the plan, not an ask here.

## Problem

eess-ts turns an architecture decision into a rule that fails the build when the code breaks it:

```ts
modules(project('tsconfig.json'))
  .that()
  .resideInFolder('src/domain/**')
  .should()
  .notImportFrom('src/infrastructure/**')
  .check()
```

Python projects have the same decisions: layers that must not import each other, base classes a
repository must extend, `eval` nowhere, and modules nobody imports. They have no eess dialect, so
these decisions stay prose. The tools Python does have (import-linter for layering, Ruff and flake8
for lint) each cover one slice. None of them shares eess's rule shape, its agent-actionable
violations, or its fail-closed promise that a pass is built from evidence (ADR-009, ADR-010).

## Measured

[Spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md), on Flask and Django (3,016
files, 547,000 lines):

- **What eess-ts needs.** Of 90 public eess-ts capabilities, 55 need one file's syntax, 17 resolution
  across files, 4 the binding of a name (builtin, local or imported), and 14 the type checker.
  The first slice (this repository's own rule files and the five presets) needs 23, 11, 4 and **0**.
- **Two engines give the same facts on code that parses.** Python's `ast` and tree-sitter agreed on
  20,011 imports, 11,276 classes and 194,093 calls.
- **They differ on code that does not parse.** tree-sitter is green on four of nine files Python
  rejects, and it returns facts from a broken file. `ast` raises a `SyntaxError` with the line and
  Python's message for every grammar error.
- **Imports resolve to files without a type checker.** Django resolved 16,063 of 16,064 internal
  imports from its source roots alone; the one left is a deliberately broken fixture.
- **`symtable` answers the binding question** the security rules need.

## Existing code survey

- **The family pattern is set.** A dialect is its own package on the kernel, layered as
  `model → predicates → conditions → builders` (plus `presets/`). It re-exports the kernel symbols
  it uses (plan 0089, `check:family`), and binds to other dialects through `eess-crossvalidate`.
  eess-md, eess-mermaid and eess-gherkin all follow it, and none needs the TypeScript compiler.
- **The kernel already owns everything that is not language-specific:**
  - the base `RuleBuilder` surface (`that`, `should`, `excluding`, `check`, `warn`, `because`);
  - the `not`/`and`/`or` combinators;
  - `correspondence()`;
  - reporting (ADR-008);
  - the evidence receipt (ADR-014);
  - instrument findings (ADR-016).
- **eess-ts's builders map onto Python**, per the spike's survey:
  - `modules`, `classes`, `functions`, `calls` and `slices` map directly;
  - `types()` would become Protocol and TypedDict;
  - "exported" would become `__all__`, or names without a leading underscore;
  - type-only imports would become imports under `if TYPE_CHECKING:`.
- **No counterpart:** JSX, non-null assertions, default exports and the `Function` constructor.
- **No reader of Python exists anywhere in the family.** Proposal 014 rules it out of its own
  scope ("Reading Python, or any other language, inside eess"). A Python consumer there writes its
  own extractor on `ast` and passes eess a citation list.
- **ADR-002 rejected tree-sitter for TypeScript** because the rules needed a type checker. For
  Python's first slice they do not, so ADR-002's reason does not carry over. The engine is chosen
  here for a different reason: tree-sitter fails open on broken files.

## Asks

- **A — the dialect, first slice.** `@nielspeter/eess-py`, with `project('pyproject.toml')` and
  these entry points:
  - `modules()`: imports, layers, `noDeadModules`, `noUnusedExports`.
  - `slices()`: cycles and layer order.
  - `classes()`: bases at any depth (ADR-017), decorators and members.
  - `functions()`.
  - `calls()`.
  - the security rules: `noEval`, `noExec`, `noEnvironRead`, with Python's own spellings.
  - the presets that make sense in Python.

  Facts come from `ast` and `symtable`, run by a stdlib-only helper script in the project's own
  interpreter, which writes JSON to the Node side. No type checker. An annotation can be matched as
  written, but not inferred.

- **B — the engine decision, as an ADR.** "eess-py reads Python with Python." This is the Python
  counterpart of ADR-002 and ADR-007. It settles the engine, its boundary, and what fails closed:
  - the interpreter is missing, or older than the version the project declares;
  - a file does not parse;
  - an import does not resolve;
  - a top-level name is neither under a source root nor installed.
- **C — type facts.** Rules over inferred types (Pyright or another checker), for the 14 rows the
  first slice does not need. Expected to be held until an adopter asks for one, as proposal 015
  holds its Ask B.

## Acceptance criteria

**A and B, for each new way to fail a build:**

- **Break class, the engine:** a file that Python rejects is a finding with Python's line and
  message, never read as a file with facts. A row per probe class in spike 0417's Result 3
  (grammar errors, a Python 2 `print`, mixed indentation, a duplicate parameter).
- **Break class, the interpreter:** no interpreter, or one older than `requires-python`, is one
  instrument finding naming both versions (ADR-016). It is not one `SyntaxError` per file blaming
  the code.
- **Break class, resolution:**
  - an import under a source root that resolves to no file is a finding;
  - a top-level name that is neither under a root nor installed is a finding, never silently
    "external". This is spike 0417's Result 5: a missing root hides a layer violation.
- **Break class, the rules:** each eess-ts rule ported keeps its eess-ts break class, with a Python
  fixture. `notImportFrom` goes red on `from infrastructure.db import x` in `domain/`, on a
  relative import that reaches it, and on `import infrastructure.db as d`.
- **Break class, binding:** `noEval` goes red on the builtin `eval` and stays green on a local
  `eval`. It goes red on `builtins.eval`.
- **Non-vacuity:** every rule and preset has a `check:nonvacuity` fixture, and a rule that examines
  nothing is a finding (ADR-010).
- **Dogfooding:** this repository has no Python, so eess-py's gates cannot be dogfooded on its own
  code. The plan must name the fixture project that stands in for it, and say so in its Enforcement
  rows rather than claim a dogfood it does not have.

**C:** not specified until an adopter's rule sets what it needs.

## Open questions

1. **Name.** `eess-py`, matching `eess-ts` and `eess-md`, rather than `eess-python`. Chosen for
   consistency, and it can be overruled.
2. **Source roots.** Read them from `pyproject.toml` (setuptools, hatch, poetry, the `src` layout),
   take them as options, or both. The spike wrote them by hand. Whichever is chosen, a root that is
   not declared must not silently turn internal imports into external ones.
3. **Installed or missing.** Whether the helper asks the project's interpreter with
   `importlib.util.find_spec`, and what it does in a project with no virtual environment. Not
   measured.
4. **The first slice's exact list.** Which eess-ts rules and presets port, and which wait. The
   survey's 23 + 11 + 4 is the floor this repository uses; an adopter may need others.
5. **Proposal 014.** Once eess-py reads Python, should the scenario presets read a pytest suite
   through it, instead of through the consumer's own extractor? That would change 014's out-of-scope
   line. It is a separate decision, after A ships.

## Alternatives considered

- **tree-sitter in-process.** It needs no Python, starts in 5 ms and accepts every new syntax. It is
  rejected because it is green on files Python rejects (spike 0417, Result 3), and every caller must
  remember `hasError` to avoid a false green.
- **Pyright as the engine.** It gives types, but it is a 34 MB install, and as far as the spike
  looked its type queries are reachable through its language server, not a library API (not
  verified). Nothing in the first slice needs
  it. It stays a candidate for Ask C.
- **Wrap an existing Python tool** (import-linter, Ruff). Each covers one slice, in its own rule
  format and its own exit semantics. None carries eess's evidence receipt or its findings for "could
  not read", so the fail-closed promise would end at the wrapper.

## Out of scope

- Inferred types (Ask C).
- Jupyter notebooks, `.pyi` stubs as a source, and Cython.
- A Python-native API (`pip install eess`). Rules are written in TypeScript, like every dialect's;
  only the facts come from Python.
