# Spike 0418: where do Python's architecture tools pass when they should not?

Measured 2026-10-14 for the rewrite of [proposal 016](../proposals/016-eess-py-a-python-dialect.md).
Its review found the submission's premise false ("none of them shares eess's rule shape", or its
fail-closed promise) and asked that the fail-closed claim be measured against the existing tools
before eess-py is argued for. Took about 25 minutes.

## The question

Python already has architecture-rule tools. eess-py is worth building only where it differs. The
difference the proposal claimed is failing closed ([ADR-009](../../adr/009-agent-first-failure-surfaces.md), [ADR-010](../../adr/010-a-pass-is-constructed-from-evidence.md)): a rule never passes on code it
did not read, on a selector that matched nothing, or on an import it could not resolve. Where do the
existing tools pass in those cases?

## Method

import-linter 2.15, PyTestArch 5.0.0 and pytest-archon 0.0.7, with pytest 9.1.1, in a Python 3.13
virtual environment outside the repository.

One src-layout project, `src/myapp/` with `domain/` and `infrastructure/` packages, and one rule in
each tool: `myapp.domain` must not import `myapp.infrastructure`. Only `src/myapp/domain/a.py`
changes between the eight variants:

| Variant    | `domain/a.py`                                                    | Expected              |
| ---------- | ---------------------------------------------------------------- | --------------------- |
| `clean`    | `x = 1`                                                          | pass                  |
| `plain`    | `from myapp.infrastructure import db`                            | fail                  |
| `syntax`   | the `plain` import, then `def f(:`                               | fail                  |
| `relative` | `from ..infrastructure import db`                                | fail                  |
| `aliased`  | `import myapp.infrastructure.db as d`                            | fail                  |
| `typo`     | the `plain` import, but the rule names `myapp.domian`            | fail                  |
| `dynamic`  | `importlib.import_module("myapp.infrastructure.db")`             | fail                  |
| `missing`  | `from myapp.infrastructur import db`, a module that is not there | fail (no such module) |

The rules, as each tool documents them:

- **import-linter:** a `forbidden` contract, `source_modules = myapp.domain`,
  `forbidden_modules = myapp.infrastructure`, `root_package = myapp`.
- **PyTestArch:** `Rule().modules_that().are_sub_modules_of("myapp.domain").should_not()
.import_modules_that().are_sub_modules_of("myapp.infrastructure")`, over
  `get_evaluable_architecture("src/myapp", "src/myapp")`.
- **pytest-archon:** `archrule(…).match("myapp.domain*").should_not_import("myapp.infrastructure*")
.check("myapp")`.

## Result

**1. On the variants each tool was built for, all three fail closed.** _Corrected by review: the
table shows PyTestArch passing `plain` and `relative`. See Corrections._

| Variant    | import-linter                 | PyTestArch                      | pytest-archon                     |
| ---------- | ----------------------------- | ------------------------------- | --------------------------------- |
| `clean`    | pass                          | pass                            | pass                              |
| `plain`    | **fail**                      | pass (see 2)                    | **fail**                          |
| `syntax`   | **fail**, "Syntax error in …" | **fail**, `SyntaxError`, line 3 | **fail**, `SyntaxError`, line 3   |
| `relative` | **fail**                      | pass (see 2)                    | **fail**                          |
| `aliased`  | **fail**                      | **fail**                        | **fail**                          |
| `typo`     | **fail**, "does not exist"    | **fail**, `ModuleUnknown`       | **fail**, "NO CANDIDATES MATCHED" |
| `dynamic`  | pass                          | pass                            | pass                              |
| `missing`  | pass                          | pass                            | pass                              |

- **A file that does not parse fails in all three**, with Python's own error. So does a rule naming
  a module that does not exist: import-linter says the module "does not exist", PyTestArch raises
  `ModuleUnknown`, and pytest-archon says "NO CANDIDATES MATCHED". The proposal's implied claim that
  these tools pass on broken input is false for these two cases.
- **All three pass on `dynamic` and `missing`.**
  - An `import_module` with a literal string is not an import to any of them.
  - An import of a module that does not exist inside the project's own package is dropped without
    a word. A rule over that package passes, and nothing says one import was not resolved.

**2. PyTestArch passes on a violation in two ways a reader would not expect.**

- **`are_sub_modules_of(pkg)` excludes the package itself.** `from myapp.infrastructure import db`
  records an edge to `myapp.infrastructure`, the package, not to `db`. The rule above passes on it,
  and on the relative form. The same check written `are_named("myapp.infrastructure")` or
  `have_name_matching(r"myapp\.infrastructure.*")` fails as it should. The spelling most like the
  other tools' is the one that misses it.
- **A wrong scan root drops the project's own edges.** With `get_evaluable_architecture("src",
"src/myapp")`, a plausible first attempt and the spike's own first attempt, every module is named
  `src.myapp.…`. The import `myapp.infrastructure` then matches no module in the graph, and the
  edge is dropped as external. With rule names adjusted to `src.myapp.…`, `plain` and `relative`
  pass. This is [spike 0417](./0417-which-engine-reads-python-for-eess-py.md)'s Result 5, the silent "external", in a shipped tool. _Falsified by
  review: the edge is kept, renamed. See Corrections._

**3. Where eess-py could actually differ**, from what was measured:

- **An unresolved import inside the project is a finding.** All three tools pass on it today.
- **A literal `import_module` target is an edge,** or its count is reported beside the result. All
  three are blind to it, and so would a first eess-py be unless it resolves literal targets.
- **A scan root or selector that drops edges is a finding,** not a quiet pass. PyTestArch shows the
  shape.

On the cases the tools were built for (a file that does not parse, a rule that names nothing),
eess-py would match them, not beat them.

## Decision

The rewrite of [proposal 016](../proposals/016-eess-py-a-python-dialect.md) argues for eess-py from the family, not from fail-closed alone. These
tools already refuse a broken file and an empty selector. The measured difference is narrower:

- unresolved and dynamic imports;
- selectors and roots that drop edges silently.

The larger difference is not about Python at all. It is that a Python rule can be bound to an ADR's
Enforcement table, a Mermaid diagram, Gherkin scenarios and Markdown specs, in one family with one
evidence receipt ([ADR-014](../../adr/014-the-emitter-refuses-a-verdict-without-evidence.md)). None of these tools does that, and none was measured doing it, because
none claims to.

Decided by delegation from the measurements; can be overruled.

## Not measured

- **tach and deply**, and lint tools (Ruff, Bandit) for the security rules.
- **The tools' behaviour on the editable-install case** ([proposal 016](../proposals/016-eess-py-a-python-dialect.md)'s review, Critical 3).
- **Larger projects.** Each variant is one file in one package.
- **Agent-actionability of their output**, which the proposal also claims. Not measured, so the
  rewrite does not claim it as a difference.

## Corrections after review (2026-10-14)

[Proposal 016](../proposals/016-eess-py-a-python-dialect.md)'s second review (architect, product, enforcement, method) found these errors in this
record. The claims above are annotated in place.

- **The wrong scan root does not drop edges** (enforcement; re-run by the coordinator). With root
  `src`, the graph holds `src.myapp.domain.a → src.myapp.infrastructure`: the edge is kept under
  renamed modules. The rule passed only because of the `are_sub_modules_of` gap in Result 2's first
  bullet. With `are_named("src.myapp.infrastructure")` it fails, as it should. There is one
  PyTestArch pitfall, not two. PyTestArch's README also documents that `are_sub_modules_of`
  excludes the package itself (product), so "a reader would not expect" overstated it.
- **Result 1's heading contradicts its table** (enforcement, method). PyTestArch passes `plain` and
  `relative` with the selector the spike used.
- **"A rule naming a module that does not exist" was measured on the source only** (enforcement,
  product, measured). With the forbidden **target** misspelt, `myapp.infrastucture`, import-linter
  reports the contract kept (exit 0) and pytest-archon passes. Only PyTestArch raises
  `ModuleUnknown`. That is a fourth gap, and the most direct [ADR-018](../../adr/018-a-string-that-names-code-is-resolved-or-the-rule-says-why-not.md) case of all.
- **The `missing` row shows no missed violation** (product). An import of a module that does not
  exist breaks no layer, and the code would fail at import anyway. The evidence for "an unresolved
  import is a finding" is `from myapp.infrastructure.nope import x`, an unresolved import into the
  forbidden layer. The reviewers measured that import-linter passes on it. _(Corrected 2026-10-15: the
  first version also counted PyTestArch, but that result came from `are_sub_modules_of`, the selector
  gap the first bullet explains, so it is not evidence here.)_
- **Cases the spike missed** (enforcement, measured): import-linter drops a namespace package (a
  directory with no `__init__.py`) and passes, reporting "0 dependencies".
- **"A file that does not parse fails in all three" rests on one probe** (method), `def f(:`.
  [Spike 0417](./0417-which-engine-reads-python-for-eess-py.md)'s other eight probes, including the two that only `compile` catches, were not run against
  these tools.

## Harness

`run.py` in a directory with a virtual environment holding the three tools and pytest. For each
variant it writes the project, `.importlinter`, `test_pytestarch.py` and `test_archon.py`, then
runs `lint-imports`, `pytest test_pytestarch.py` and `pytest test_archon.py` with
`PYTHONPATH=src`, and records each exit code. PyTestArch's selector comparison:

```python
from pytestarch import get_evaluable_architecture, Rule
ev = get_evaluable_architecture('src/myapp', 'src/myapp')
for label, r in [
    ('sub_modules_of', Rule().modules_that().are_sub_modules_of('myapp.domain').should_not()
        .import_modules_that().are_sub_modules_of('myapp.infrastructure')),
    ('are_named pkg', Rule().modules_that().are_sub_modules_of('myapp.domain').should_not()
        .import_modules_that().are_named('myapp.infrastructure')),
    ('regex', Rule().modules_that().have_name_matching(r'myapp\.domain.*').should_not()
        .import_modules_that().have_name_matching(r'myapp\.infrastructure.*')),
]:
    try: r.assert_applies(ev); print(label, 'PASS')
    except AssertionError as e: print(label, 'FAIL:', str(e).splitlines()[0])
# sub_modules_of PASS
# are_named pkg FAIL: "myapp.domain.a" imports "myapp.infrastructure".
# regex FAIL: "myapp.domain.a" imports "myapp.infrastructure".
```
