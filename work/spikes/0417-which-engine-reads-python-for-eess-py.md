# Spike 0417: which engine reads Python for an eess-py dialect?

Measured 2026-10-14 for [proposal 016](../proposals/016-eess-py-a-python-dialect.md), at the
maintainer's request ("make an eess-py equivalent to eess-ts"). Time-boxed to an hour; it took about
50 minutes, including the survey below.

## The question

eess-ts reads TypeScript through ts-morph, the TypeScript compiler. Python has no single equivalent,
so the engine is a choice, and it decides which rules eess-py can state at all. Three facts decide it:

1. **What eess-ts's rules actually need from an engine.** Syntax alone, names resolved across files,
   or a type checker.
2. **Whether each candidate delivers those facts correctly** on real code.
3. **Whether each candidate fails closed** (ADR-009): a file Python rejects must never be read as a
   clean file, because then a rule over it passes on code that does not run.

## Method

**What eess-ts needs.** A read-only survey classified 90 public eess-ts capabilities (builders,
predicates, conditions, presets, rules) by the fact each one takes from ts-morph. The survey read
the implementations for calls to `getType()`, `getSymbol()` and `findReferences`, not the names:

- **S:** one file's syntax;
- **R:** an import or a name resolved to another file;
- **T:** the type checker.

It also separated out the capabilities this repository's own rule files use (`arch.rules.ts`,
`arch.internal.rules.ts`, `adr007.rules.ts`, `family.rules.ts`) and the five presets: the realistic
first slice.

**Candidates.**

- **Python's own `ast` and `symtable`**, run by a stdlib-only script in a Python subprocess that
  writes JSON. Python 3.15.0 here; 3.10.18 through `uv` for the version probe.
- **tree-sitter**: `web-tree-sitter` 0.27.1 with `tree-sitter-python` 0.25.0, WebAssembly,
  in-process in Node 24.14.0.
- **Pyright** 1.1.414 was installed and not measured. The survey answered the question it would
  have: nothing in the first slice needs a type checker (Result 1).

**Corpus.** Shallow clones of Flask (`d086db8`, 83 files, 18,333 lines) and Django (`80c997f`,
2,933 files, 528,578 lines), 3,016 `.py` files in all.

**Facts compared.** Each engine extracted, per file:

- every import (line, relative level, module and name);
- every class (line, name, bases, decorators);
- every call (line).

The two outputs were diffed. A disagreement means one of them is wrong.

**Fail-closed probes.** Nine files Python rejects and seven files that use syntax added from 3.10
to 3.14 (Harness).

**Resolution.** A 60-line resolver maps each import to a file from the source roots alone:

- relative imports from the importing file's package;
- `a.b.c` to `a/b/c.py`, `a/b/c/__init__.py` or a namespace directory;
- `from a import b` to the submodule `b` if one exists, else to the module `a`.

The roots were `src` and `tests` for Flask, and the repository root and `tests` for Django.

## Result

**1. The first slice needs no type checker.** Of the 90 capabilities:

| Fact                                    | All | First slice |
| --------------------------------------- | --- | ----------- |
| syntax of one file                      | 55  | 23          |
| import or name resolved to another file | 17  | 11          |
| builtin, local or imported (binding)    | 4   | 4           |
| type checker                            | 14  | 0           |

- **Resolution.** In the first slice it is almost all import edges: `importFrom`, `notImportFrom`,
  `onlyImportFrom`, slices, cycles, layer order and the reverse graph behind `noDeadModules`. Beyond
  those there is one base-class walk (`extend`, in `dataLayerIsolation`) and export usage
  (`noUnusedExports`).
- **Binding.** The four binding rows are the security rules (`noEval`, `noProcessEnv`, `noConsole`,
  `noFunctionConstructor`). In TypeScript they need the checker, because a global is declared in an
  ambient `.d.ts` (`packages/ts/src/helpers/global-binding.ts:93`). In Python the same question is
  answered from one file's scopes.
- **Type checker.** The 14 rows are type-level conditions: property and parameter types and the
  type matchers (e.g. `packages/ts/src/conditions/members.ts:24`). Each has an "annotation as
  written" reading in Python, which is syntax.
- **No Python counterpart:** JSX, non-null assertions, default exports and the `Function`
  constructor.

The row counts depend on how variants were bundled (`noEval`, `functionNoEval` and `moduleNoEval`
are one row), so read them as proportions.

**2. On code that parses, both engines give the same facts.**

| Fact    | Facts (`ast`) | Disagreements |
| ------- | ------------- | ------------- |
| imports | 20,011        | 0             |
| classes | 11,276        | 0             |
| calls   | 194,093       | 0             |

- **Two disagreements in the first pass were the spike's own extractor bugs, not the engines'.** The
  tree-sitter extractor missed 27 `from __future__ import` lines, which tree-sitter parses as a
  separate node type. It also took a `**kwargs` among a class's bases for a base.
- **Timing (one process, 3,016 files):**

  | Engine              | Parse and extract | Notes                   |
  | ------------------- | ----------------- | ----------------------- |
  | `ast`               | 2.75 s            |                         |
  | `symtable` over all | 1.3 s             |                         |
  | tree-sitter         | 3.65 s            | plus 5 ms to initialise |

  Neither is a bottleneck at Django's size.

**3. tree-sitter is green on files Python rejects; `ast` is not.**

| Probe file                         | tree-sitter | `ast.parse` (3.15) | `compile` (3.15) |
| ---------------------------------- | ----------- | ------------------ | ---------------- |
| `1syntax_error` (invalid literal)  | error       | SyntaxError        | SyntaxError      |
| `def f(:`                          | error       | SyntaxError        | SyntaxError      |
| `x = = 1`                          | error       | SyntaxError        | SyntaxError      |
| unclosed `(`                       | error       | SyntaxError        | SyntaxError      |
| `class = 1`                        | error       | SyntaxError        | SyntaxError      |
| `print "hello"` (Python 2)         | **clean**   | SyntaxError        | SyntaxError      |
| tabs and spaces mixed in one block | **clean**   | SyntaxError        | SyntaxError      |
| `def f(a, a)`                      | **clean**   | ok                 | SyntaxError      |
| `return` outside a function        | **clean**   | ok                 | SyntaxError      |

- **tree-sitter recovers from an error and keeps going.** It returns facts for the rest of the file,
  so a broken file reads as a file with facts. The error is detectable only if the caller checks
  `rootNode.hasError`.
- **That check is easy to get wrong.** The spike's own first error walk tested for `ERROR` nodes and
  `isMissing`, and reported Django's deliberately broken `tests_syntax_error.py` as clean. Its error
  is a `MISSING` newline, which the walk did not catch; `hasError` was true. That is a fail-open
  committed by the spike itself, and it is the kind a dialect would have to guard forever.
- **`ast.parse` misses what only `compile` checks.** It rejects everything the grammar rejects, but
  not the two checks `compile` makes later (duplicate parameter, `return` outside a function).
  Building `symtable` raises the duplicate-parameter error. It accepts `return` outside a
  function, which only `compile` refuses.

**4. `ast` parses the grammar of the interpreter that runs it.**

- **3.15** accepts all seven new-syntax files: PEP 695 `type` and generics, the PEP 701 nested
  f-string, the PEP 758 unparenthesised `except`, the PEP 750 t-string, `match` and `except*`.
- **3.10** rejects six of them, everything newer than 3.10, each with a `SyntaxError`. It accepts
  `match`.
- **`feature_version`** can make a newer interpreter reject newer syntax. Parsing `type X = int`
  with `feature_version=(3, 10)` on 3.15 gave "Type statement is only supported in Python 3.12 and
  greater". It cannot make an older interpreter accept newer syntax.
- **tree-sitter accepted all seven**, whatever version the project targets.

**5. Imports resolve to files without a type checker.**

| Project | Resolved to a file | Standard library | Third-party | Unresolved |
| ------- | ------------------ | ---------------- | ----------- | ---------- |
| Django  | 16,063             | 3,060            | 239         | 1          |
| Flask   | 290                | 197              | 179         | 9          |

- **Django's one unresolved import** is a deliberate fixture: `from .....test import Test`, in
  `tests/sphinx_tests/testdata/package/import_error.py`.
- **Flask's nine** are relative imports in `examples/`. Each example is a separate project with its
  own root, which the configuration did not declare.
- **"Third-party" was decided by elimination:** any top-level name not under a declared root and not
  in `sys.stdlib_module_names`. Django's 239 include local scripts outside the declared roots
  (`pr_quality`, `do_django_release`, `test_settings`).
- **So a missing root turns internal imports into external ones silently.** For a layering rule
  that is a false green: an import that crosses a layer is not seen as an import into the project
  at all.

**6. `symtable` answers the binding question directly.** It was probed on one file:

- a module-level `eval("1")` is a free `eval` (the builtin);
- `eval` assigned inside a function is local;
- `from os import environ as env` is imported;
- `import builtins` inside a function is a local import.

These are the four facts the security rules need. Building `symtable` over all 3,016 files took
1.3 s, and it succeeded on all but the one deliberately broken file.

## Decision

**eess-py reads Python with Python: `ast` and `symtable`, run by a stdlib-only helper script in the
project's own interpreter, which writes facts as JSON to the Node side.** The rules, builders and
reporting stay in TypeScript on the eess kernel, like every other dialect.

- **Fail-closed decides it.** tree-sitter is green on four of the nine files Python rejects, and it
  makes a broken file look like a file with facts. That a careful caller can recover the error from
  `hasError` does not change the default, and the spike's own walk got it wrong on the first try.
  `ast` refuses what the interpreter refuses, with the line and Python's own message, which is the
  remedy an adopter needs.
- **The interpreter is the project's own.** A Python project always has one, and its version is the
  version the code is meant to run on. That turns the version dependency (Result 4) into the right
  answer, not a drawback. If the interpreter is missing, or older than the version the project
  declares, that is one instrument finding (ADR-016), never a `SyntaxError` per file blaming the
  code.
- **Files that do not parse, imports that do not resolve, and names that are neither under a root
  nor installed** are findings, never skipped. Result 5's silent "external" is the shape to refuse.
  The helper can ask the interpreter whether a top-level name is installed, with
  `importlib.util.find_spec`. That was not measured.
- **No type checker in the first slice.** Type-level conditions read the annotation as written, or
  wait for a later proposal.

Choosing the engine is a binding decision, the Python counterpart of ADR-002 and ADR-007, so it
becomes an ADR when the proposal is accepted. The choice was made here from the measurements and
the mission (ADR-009, ADR-010, ADR-016), and it can be overruled.

## Not measured

- **`importlib.util.find_spec` in the project's interpreter**, to tell installed from missing.
- **Source-root discovery from `pyproject.toml`** (setuptools, hatch, poetry, `src` layout). The
  spike's roots were written by hand.
- **The cost of a subprocess round trip on a small project**: interpreter start-up, a few hundred
  milliseconds expected, not measured.
- **Pyright** as a later type-fact provider, and its install size: 34 MB for the npm package here.
- **Base-class walks across files** (ADR-017's "any depth"). Only the per-file facts and import
  resolution were measured; a walk composes them.
- **Whether the helper should run `compile` as well**, for the checks only it makes (`return`
  outside a function), and what that costs.
- **Windows**, and an interpreter inside a virtual environment in a monorepo.

## Harness

Python 3.15, Node 24, in a directory with `web-tree-sitter@0.27.1` and
`tree-sitter-python@0.25.0` installed, and Flask and Django cloned with `--depth 1`.
`find flask django -name '*.py' | sort > files.txt`.

```python
# ast_facts.py: python3 ast_facts.py < files.txt > ast.json
import ast, json, sys, time
def facts(path, src):
    t = ast.parse(src, filename=path)
    imps, classes, calls = [], [], []
    for n in ast.walk(t):
        if isinstance(n, ast.Import):
            for a in n.names: imps.append([n.lineno, 0, a.name])
        elif isinstance(n, ast.ImportFrom):
            for a in n.names: imps.append([n.lineno, n.level, (n.module or '') + ':' + a.name])
        elif isinstance(n, ast.ClassDef):
            classes.append([n.lineno, n.name, [ast.unparse(b) for b in n.bases], [ast.unparse(d) for d in n.decorator_list]])
        elif isinstance(n, ast.Call):
            calls.append([n.lineno, ast.unparse(n.func)])
    return {'imports': sorted(imps), 'classes': sorted(classes), 'calls': sorted(calls)}
out, t0 = {}, time.time()
for p in sys.stdin.read().split('\n'):
    if not p: continue
    try:
        out[p] = facts(p, open(p, encoding='utf-8').read())
    except SyntaxError as e:
        out[p] = {'error': f'SyntaxError line {e.lineno}: {e.msg}'}
sys.stderr.write(f'ast: {len(out)} files in {time.time()-t0:.2f}s\n')
json.dump(out, sys.stdout)
```

The tree-sitter extractor walks `import_statement`, `import_from_statement` (its `module_name`,
`relative_import` and `name` fields), `class_definition` (`superclasses`, and decorators from a
`decorated_definition` parent) and `call` (`function`). It is corrected for the two bugs above:
`future_import_statement`, and `dictionary_splat` among the bases. The comparison keys are:

- imports: line, level and `module:name`;
- classes: line, name, bases (a dotted name, or `<expr>`) and the decorator count;
- calls: the line, compared as a multiset.

The probe files, one per row of Result 3 and Result 4:

```text
bad_numlit          x = 1\n1syntax_error\n
bad_def             def f(:\n    pass\n
bad_assign          x = = 1\n
bad_unclosed        x = (1,\ny = 2\n
bad_py2print        print "hello"\n
bad_indent          def f():\n\tif x:\n        return 1\n
bad_return_outside  return 1\n
bad_kw_as_name      class = 1\n
bad_dup_arg         def f(a, a):\n    pass\n
new_pep695_type     type Point = tuple[float, float]\n
new_pep695_generic  def first[T](xs: list[T]) -> T:\n    return xs[0]\nclass Box[T]:\n    pass\n
new_pep701_fstring  x = f"{f"{1}"}"\n
new_pep758_except   try:\n    pass\nexcept ValueError, TypeError:\n    pass\n
new_pep750_tstring  name = 1\nx = t"hi {name}"\n
new_match           match x:\n    case [a, *rest]:\n        pass\n
new_except_star     try:\n    pass\nexcept* ValueError:\n    pass\n
```

The tree-sitter verdict is `parser.parse(src).rootNode.hasError`. The `ast` verdicts are
`ast.parse(src)` and `compile(src, f, 'exec')`, each in a `try`. The 3.10 run is
`uv run --python 3.10 --no-project python probe_ast.py`.
