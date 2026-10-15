# Proposal 016 — eess-py: Python code joins the family, starting with one rule that cannot pass on what it did not read

**State:** Draft — filed 2026-10-14 at the maintainer's request; reviewed the same day (architect ·
product · enforcement, `Rewrite needed`); **rewritten the same day by the session that filed and
reviewed it**, against that review and a second measurement, [spike 0418](../spikes/0418-where-python-architecture-tools-pass-on-a-broken-rule.md).
The original submission is preserved verbatim as Appendix A. **Reviewed again the same day**
(architect · product · enforcement · method, `Split and sequence`): A, B and C accepted, reshaped;
D, E and F held. The record of that review was corrected on 2026-10-15 after a method review, and
every finding is listed in Appendix B. Queued behind proposal 006's Ask C, as the maintainer
scheduled on 2026-10-14.
**Priority:** Medium — the maintainer's request. No external adopter has asked for it. One consuming
project with both Python and TypeScript (proposal 014's) is a candidate, not a requester.
**Origin:** self-found · the maintainer's request, 2026-10-14. Measured in
[spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md) (the engine) and spike 0418
(the existing Python tools).
**Affects:**

- a new package, `@nielspeter/eess-py`;
- `@nielspeter/eess`, through Ask B's module graph;
- `@nielspeter/eess-ts`, which moves its graph code onto that kernel graph;
- `@nielspeter/eess-crossvalidate`, through Ask D;
- ADR-001 and ADR-002, which Ask A amends.

## Problem

A Python project's architecture decisions (layers, forbidden imports, base classes, no `eval`) can
already be stated as rules. import-linter, tach, PyTestArch, pytest-archon and deply all do it, and
Ruff and Bandit cover the security rules. What a Python project cannot do is state those rules
**inside the eess family**. That means:

- an ADR's Enforcement table citing a Python rule that `check:corpus` and `check:crossval` resolve;
- a Mermaid class diagram checked against Python classes;
- Gherkin scenarios bound to pytest tests (proposal 014);
- one evidence receipt (ADR-014) across all of them.

A repository that runs both TypeScript and Python can enforce half its architecture in eess and
must reach for a second tool, with its own rule format and exit semantics, for the other half.

Spike 0418 measured where those tools pass when they should not. They fail closed on a file that
does not parse and on a rule naming a module that does not exist. They do **not** fail closed on:
_(Corrected by the second review: "a module that does not exist" holds for the rule's **source**
only; a misspelt forbidden **target** passes in import-linter and pytest-archon. "A file that does
not parse" rests on one probe, `def f(:`.)_

- an import of a module inside the project that does not exist: all three pass, without a word;
- a literal `importlib.import_module("…")` target: all three are blind to it;
- a selector or scan root that drops the project's own edges: in PyTestArch, `are_sub_modules_of`
  excludes the package itself, and a wrong root renames every module so internal imports read as
  external. Both pass on a real violation. _Corrected by the second review: the wrong root keeps
  the edge; both passes are the same `are_sub_modules_of` gap. The reviewers also found a
  misspelt forbidden target passes in import-linter and pytest-archon. See spike 0418's
  Corrections._

Those are the cases eess's ADR-009 and ADR-010 are about. They are a narrower edge than the
original submission claimed, and this proposal claims only them.

## Who it is for

A repository that already runs Node, and has Python beside its TypeScript or binds Python to its
specs. Rules are written in TypeScript on the eess kernel, and the dialect needs Node 24. For a
Python-only team that is a real barrier, and a pip-installed tool will usually be the better
choice. This proposal does not try to win that team. A Python-native rule API is out of scope.

## Measured

- **The engine** ([spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md), Flask and
  Django, 3,016 files):
  - Python's own `ast` and tree-sitter agree on every import, class and call in code that parses.
    _(Calls were compared by line only, per the second review.)_
  - tree-sitter is clean on 4 of 9 files Python rejects, and no check recovers those four.
  - `ast` refuses all seven grammar errors. `compile` catches the remaining two _(2.55 s is parse and compile together, per the second review)_, in 2.55 s over all
    3,016 files.
  - Imports resolve to files from source roots alone, with no type checker: Django resolved 16,063
    of 16,064 _internal_ imports, those under the declared roots (the second review's wording).
  - `symtable` answers the builtin-or-local question the security rules need.
- **The existing tools** (spike 0418): Result 1's table, summarised under Problem.
- **What eess-ts needs** (spike 0417, Result 1): the rules this repository uses itself need syntax,
  import resolution and name binding, and no type checker.

## Existing code survey

- **The family pattern.** A dialect is its own package on the kernel, re-exports the kernel symbols
  it uses (`check:family`), and binds to other dialects through eess-crossvalidate. eess-md and
  eess-mermaid follow `model → predicates → conditions → builders`; eess-gherkin does not, and
  nothing requires it.
- **The kernel owns** the base `RuleBuilder`, the `not`/`and`/`or` combinators, `correspondence()`,
  reporting (ADR-008), the evidence receipt (ADR-014), instrument findings (ADR-016) and the one
  exclusion-comment parser (ADR-012).
- **The kernel does not own the import graph.** Cycles, slices, layer order, the reverse graph and
  glob diagnosis live in eess-ts and are tied to ts-morph:
  - `packages/ts/src/core/module-edges.ts`
  - `packages/ts/src/helpers/tarjan.ts`
  - `packages/ts/src/helpers/slice-graph.ts`
  - `packages/ts/src/conditions/slice.ts`
  - `packages/ts/src/conditions/reverse-dependency.ts`

  A second language dialect would copy all of it (Ask B). _(Corrected by the second review: "tied
  to ts-morph" overstates it. `tarjan.ts`, `conditions/slice.ts` and the glob diagnosis import no
  ts-morph; mostly a `SourceFile` is used as a node's identity.)_

- **The exclusion-comment parser** reads `//` and `<!-- -->`, not `#`
  (`packages/core/src/exclusion-comments.ts:102`). ADR-012 has the kernel take the lexer as a
  capability, so eess-py supplies a Python lexer; it does not need a second parser. _(False, per
  the second review, measured on the kernel. ADR-012's capability is a masker, not a comment
  syntax, and the kernel's default scanner still runs over it. A `#` waiver is never read, and a
  `//` waiver written inside a docstring is honoured _(no longer: since bug 0419's fix the kernel reads
  no directive in a `.py` file at all)_. See change 2 and
  [bug 0419](../bugs/fixed/0419-a-waiver-in-a-gherkin-doc-string-suppresses-a-real-finding.md).)_
- **No reader of Python exists in the family.** Proposal 014 rules it out of its own scope.
- **ADR-002** pins ts-morph for TypeScript and rejected tree-sitter because TypeScript's rules need a
  checker. Python's first rules do not, and tree-sitter is rejected here for a different reason,
  failing open (spike 0417).

## Asks, in order

Each ask stands alone and is closable on its own. Each later ask depends on the earlier ones.
_(Both false, per the second review: D cannot close from this repository without a choice made
outside it, and B does not depend on A.)_

- **A — the engine ADR.** "eess-py reads Python with Python." `ast`, `symtable` and `compile` run by
  a stdlib-only helper in the project's own interpreter, writing versioned JSON to the Node side.
  It amends ADR-001 (a non-npm runtime) and ADR-002 (a second AST engine). It settles:
  - how the interpreter is found, and what happens with none, or one older than the project
    declares;
  - what the helper refuses (the criteria below);
  - **the selector vocabulary (ADR-018).** Rules name modules by dotted name, with globs over dotted
    names, as Python's import system and every tool in spike 0418 do. A path glob would be a second
    word for the same thing. Decided, overrulable.
- **B — a language-neutral module graph in the kernel.** The kernel takes module edges as facts
  (ADR-013's shape) and owns cycles, slices, layer order and the reverse graph. eess-ts hands it
  ts-morph's edges and keeps its own behaviour. This is a refactor of eess-ts that stands without
  eess-py. It may be planned on its own, and it must change no eess-ts verdict. It is a kernel
  public-API change, so ADR-011 decides what is public and what is `internal`.
- **C — the walking skeleton.** `@nielspeter/eess-py`: the helper, `project()`, a CLI and rule-file
  loader of its own, so one dialect is a whole tool, and **one rule**, `modules().should()
.notImportFrom(…)`, on B's graph. It ships with every refusal in the criteria. It is the smallest
  thing that proves the engine, the boundary and the fail-closed edge end to end.
- **D — one crossvalidate binding.** Python joins the family. The candidate is proposal 014's test
  side: pytest tests that cite Gherkin scenarios, read by eess-py, not by the consumer's own
  extractor. That would change 014's out-of-scope line and needs that proposal's own ruling. Any
  other binding (a Mermaid class diagram against Python classes) would do. This ask is the reason
  for the dialect, so it comes right after C. _(Not yet, per the second review: 014's consumer is
  already served without eess-py, and a Mermaid binding needs `classes()`, which E holds. See D's
  disposition.)_
- **E — the rest of the first slice:**
  - `slices()` and cycles;
  - the security rules;
  - `classes()` (bases at any depth, ADR-017) and `functions()`;
  - presets.

  **Held** until C has shipped and an adopter, or the maintainer, names which rules it needs. The
  survey's list came from a TypeScript repository's rules and is not evidence of Python demand.

- **F — inferred types.** **Held** until an adopter's rule needs one. Annotations can be matched as
  written meanwhile.

## Acceptance criteria

**A and C: the helper and the one rule.** Each is a fixture, and each must go red:

- **A file Python rejects is a finding** with Python's line and message and the interpreter version
  that judged it. All nine rows of spike 0417's Result 3, including the two only `compile` catches.
- **Encoding:** a valid latin-1 file with a coding cookie parses. The helper reads bytes.
- **Version:** the grammar is pinned with `feature_version` set to `requires-python`'s minimum, so
  3.12 syntax in a project declaring 3.10 is a finding. Without `requires-python`, that absence is
  stated in the result, not assumed.
- **Interpreter:** none found, or one older than `requires-python`, is one instrument finding
  naming both (ADR-016). It is never one `SyntaxError` per file.
- **The helper run:** a crash, partial or malformed JSON, a schema-version mismatch, a file the
  project lists but the output lacks, and zero files loaded are each red. Zero files outranks
  `.expectEmpty()`. These findings cannot be lowered by `.warn()` or removed by `.excluding()`.
- **Isolation:** the helper runs as `python -I`, spawned with an argument list, never a shell. It
  never imports or runs project code: no `find_spec` on project modules. It names its buffer and
  timeout limits, and running out is an instrument finding (ADR-016). Spike 0417's facts were 7 MB.
  _(Measured by the first review's architect, not by spike 0417.)_
- **Resolution:**
  - an import inside the project that resolves to no file is a finding (spike 0418: every existing
    tool passes it);
  - a relative import that climbs above the top-level package is a finding;
  - a module whose file lies inside the project but under no declared source root is a finding.
    This is decided by path, never by "is it installed": an editable install makes the project's
    own package "installed" (review, Critical 3).
- **Optional imports:** an import guarded by `try: … except ImportError` is recorded as optional.
  It is still an edge for `notImportFrom`, but it is not an unresolved-import finding.
- **Dynamic imports:** `importlib.import_module` and `__import__` with a literal string are edges.
  A non-literal one is counted and reported beside the result, never silently skipped.
- **Type-checking imports:** whether `notImportFrom` fires on an import under `if TYPE_CHECKING:` is
  decided in the plan, with a fixture for the answer.
- **The rule:** `notImportFrom` goes red on these:
  - an absolute import;
  - a relative import;
  - an aliased import;
  - `from pkg import submodule`, where the edge is to the package, which is PyTestArch's miss;
  - a literal `import_module`.

  A selector that matches no module is a finding, as in all three existing tools.

- **CI:** the workflow pins a Python. Tests that need an interpreter fail without one; they never
  skip.
- **Non-vacuity:** a `check:nonvacuity` row each for the rule, the helper (one that drops a file
  from its output), and the resolver (one that resolves an unresolvable import).
- **Dogfooding:** the helper is Python, and its "stdlib only" promise is a rule eess-py states over
  this repository. A non-vacuity row adds `import requests` to the helper, and the gate goes red.

**B: the kernel graph.** Every existing eess-ts test and nonvacuity row passes unchanged, and no
eess-ts verdict changes. The graph's cycle and layer findings are proven by a fixture that feeds the
kernel hand-built edges, with no ts-morph.

**D:** set by the binding chosen, in its own plan.

**E and F:** not specified while held.

## Open questions

1. **Interpreter discovery.** The order to search in: an explicit option, `.venv`, `uv`, poetry, the
   `VIRTUAL_ENV` variable, then `PATH`. Whether a monorepo with several virtual environments needs
   one `project()` per interpreter.
2. **Source roots.** Read from `pyproject.toml` (setuptools, hatch, poetry, src layout), taken as an
   option, or both. Whichever it is, an undeclared root is a finding (the criteria above).
3. **D's binding.** Proposal 014's pytest side, or a Mermaid diagram. That depends on whether 014's
   consumer wants it, which only they can say.
4. **Watch mode.** One helper run per check, or a long-lived helper. Not measured.

## Alternatives considered

- **Recommend an existing tool and ship no dialect.** For a Python-only team, that is the right
  answer, and the docs should say so. It does not put Python in the family's evidence and bindings,
  which is the point here.
- **Wrap import-linter or PyTestArch.** Their verdicts would have to be trusted at the boundary.
  Spike 0418 shows both pass on an unresolved import, and PyTestArch on two selector and root
  shapes, so the fail-closed promise would end at the wrapper.
- **tree-sitter in-process.** It needs no Python, but it is clean on files Python rejects, and no
  check recovers four of them (spike 0417).
- **Pyright.** _(The 34 MB is in spike 0417's "Not measured".)_ It gives types, but it is a 34 MB install, and as far as the spike looked its type
  queries are reachable through its language server, not a library API (not verified). It is the
  candidate for Ask F.

## Out of scope

- A Python-native rule API (`pip install eess`).
- Inferred types (Ask F).
- Jupyter notebooks, `.pyi` stubs as a source, and Cython.
- Measuring how agent-actionable the existing tools' output is. Spike 0418 did not, so this
  proposal does not claim it as a difference.

## Review — 2026-10-14

**Ruling: Rewrite needed**

Reviewed by three lenses (architect, product, enforcement), each against the code. The engine
decision stands: every lens accepted reading Python with Python's own `ast`, and enforcement
reproduced the spike's numbers exactly. What must be rewritten is the case for the dialect and the
shape around the engine. All three critical findings are in this submission, not in the spike.
Product ruled Split and sequence; architect and enforcement ruled Ship with changes. The coordinator
rules Rewrite needed, because each critical finding changes what the proposal asks for.

### Critical — the submission must change

1. **The premise is false (product, verified on PyPI).** "None of them shares eess's rule shape" is
   wrong:
   - PyTestArch 5.0.0 and pytest-archon 0.0.7 offer fluent architecture rules under pytest;
   - import-linter 2.15 and tach 0.35.3 enforce layers and module boundaries;
   - deply 1.2.1 groups classes into layers by base class and decorator;
   - Ruff and Bandit cover `eval`, `exec` and `os.environ`.

   None of them was in the survey. The case eess-py can honestly make is narrower: fail-closed
   evidence (and that edge is asserted, not measured against these tools), agent-actionable
   violations, and binding Python code to the rest of the family. That covers ADR Enforcement
   tables, Mermaid diagrams, Gherkin scenarios (proposal 014) and Markdown specs. The rewrite must
   measure the fail-closed claim against at least import-linter and PyTestArch, on spike 0417's
   probes and an unresolved import.

2. **The import graph is not in the kernel (architect, cited).** The first slice needs the import
   graph, and cycles, slices, layer order, the reverse graph and glob diagnosis all live in eess-ts,
   tied to ts-morph:
   - `packages/ts/src/core/module-edges.ts`
   - `packages/ts/src/helpers/tarjan.ts`
   - `packages/ts/src/helpers/slice-graph.ts`
   - `packages/ts/src/conditions/slice.ts`
   - `packages/ts/src/conditions/reverse-dependency.ts`

   As written, eess-py builds a second copy. **Decided, overrulable:** a language-neutral module graph
   moves into the kernel first, and each dialect hands it the edges as facts. This is ADR-013's
   "take the fact" shape, and it serves every future language dialect. That refactor of eess-ts is
   its own plan, sequenced before any eess-py rule over imports. The alternative was accepting the
   duplication on purpose; it was rejected because a cross-dialect primitive kept inside one
   dialect gets reinvented once per language.

3. **The "nor installed" criterion is green on a layer violation (enforcement, measured).** In a
   src-layout project after `uv sync`, the editable install makes the project's own package
   "installed". With `src` undeclared, `notImportFrom` stays green. `find_spec` also runs package
   code. The criterion becomes: a module whose origin is inside the project but under no declared
   root is a finding.

### Important — the rewrite must answer

- **Who the user is (product).** Rules are written in TypeScript and need Node 24. That barrier
  probably decides it for a Python-only team. The user is a repository that already runs Node, or
  one that binds Python to the rest of the family. There is no external adopter yet; the request is
  the maintainer's.
- **Scope and sequence (product, architect).** Ask A is several shippable things, and its first slice
  was taken from this TypeScript repository's rules. Suggested order:
  1. the engine ADR (Ask B);
  2. the kernel module graph (Critical 2);
  3. the helper, `project()` and a CLI, proven with one rule, `notImportFrom`;
  4. slices and cycles;
  5. security rules;
  6. classes and functions;
  7. presets once an adopter exists.

  A crossvalidate binding is the differentiator and belongs early.

- **What the helper must refuse (enforcement, architect):**
  - run `compile` as well as `ast` and `symtable`, since all nine probe rows are fixtures;
  - read bytes, honouring the coding cookie;
  - pin the grammar with `feature_version` set to `requires-python`'s minimum, and say what happens
    when there is no `requires-python`;
  - say how the interpreter is found;
  - run it isolated (`-I`, an argument list, never a shell);
  - name the subprocess's limits: buffer size (the spike's facts were 7 MB, and the default
    synchronous buffer is 1 MiB) and the timeout (ADR-016);
  - make every way the helper run can fail red: a crash, partial JSON, a file missing from the
    output, zero files loaded.
- **Dynamic and optional imports (product, enforcement).** Django has 80
  `import_module`/`__import__` calls and 36 star imports, and 22 names are imported under
  `try/except ImportError`. Each rule must either resolve a literal target or state the gap. An
  optional import must not be reported as "not installed".
- **The selector vocabulary is a binding decision (architect, ADR-018).** Do rules name modules by
  path glob or by dotted name? Python developers and every competing tool use dotted names.
- **Ask B's ADR amends ADR-001 and ADR-002.** It adds a non-npm runtime and a second AST engine.
  The kernel's exclusion-comment parser knows `//` and `<!-- -->`, not `#`
  (`packages/core/src/exclusion-comments.ts:102`), and comment-reading rules need `tokenize`.
- **CI (architect, enforcement).** CI installs Node only (`.github/workflows/ci.yml:23`). It must
  pin a Python, and a missing interpreter must fail the tests, not skip them.
- **Naming (product).** `noEnvironRead` mixes a Python spelling with a concept, and `noExec` reads as
  subprocess. eess-ts's bare `noEval` checks classes only, the wrong default for Python. Open
  question 1 is closed: `eess-py`.

### Minor

- Dogfooding: the helper itself is Python. Its "stdlib only" promise is a rule eess-py can state
  over this repository, with a non-vacuity row (enforcement).
- Line attribution is not proven by the two engines agreeing, since both report a call at the
  start of its expression (architect).
- `types()` should map to type aliases, and `extend`/`implement` need Python meanings under ADR-017
  (architect).
- eess-gherkin does not follow the four-layer pattern the survey claims every dialect follows
  (architect).

### Praise

- The engine was chosen on fail-closed grounds, from a measurement.
- The spike recorded its own fail-open.
- Result 5's silent "external" import was found and named.
- Holding inferred types until an adopter asks.
- Refusing to claim a dogfood the repository does not have.

### Next step

Rewrite this proposal against the findings above: the premise and alternatives (with the
competitor measurement), the user, the sequence, the helper's refusals, and the kernel graph
decision. Then review it again. No plan before that. The kernel module graph (Critical 2) may be
planned on its own when scheduled, since it is a refactor of eess-ts that stands without eess-py.

## Review — 2026-10-14, second, after the rewrite

**Ruling: Split and sequence**

Four lenses (architect, product, enforcement, method) reviewed the rewrite. Their verdicts, as each
wrote them:

| Lens        | Verdict                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------- |
| Architect   | "Ship with changes."                                                                                |
| Enforcement | "Ship with changes."                                                                                |
| Product     | "Split and sequence."                                                                               |
| Method      | "Nearly ready for a second review, with one owed measurement and several edits first." No Critical. |

_Corrected 2026-10-15, after a method review of this record: the first recording gave method's
verdict as "no verdict", misstated three lenses' rulings on A and B as `Held`, called a choice an
overrule, and dropped about forty findings without saying so. This section now gives each lens's
ruling, says where the coordinator departed from it and why, and Appendix B lists every finding._

The rewrite answered all three of the first review's critical findings. Every code citation in the body resolves to the line it names (claims around some of them are corrected in place), and spike 0418's table reproduces cell for cell. What remains are changes to the
acceptance criteria and the asks' scope, not to the direction, so no third rewrite is needed. The
coordinator rules Split and sequence because the asks close separately, except A, which is written with C, and one of them (D) waits on
a choice only the maintainer or proposal 014's consumer can make.

**The first review's letters are the original submission's** (A the dialect, B the engine ADR, C
types). The letters below are the rewrite's.

### Disposition, per ask

Each lens's ruling, then the disposition recorded, and why they differ where they do.

| ask                                | architect                                                                       | product                                                                                                                                                                                          | enforcement                                               | disposition            | why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**: the engine ADR              | Accepted, reshaped                                                              | Accepted, reshaped: lands **with** C, not before it                                                                                                                                              | Accepted, reshaped                                        | **Accepted, reshaped** | As the three lenses ruled. Product's reshape is adopted: A's ADR is written in C's plan, because alone its Enforcement rows would all be `pending`, and it would amend ADR-001 and ADR-002 for a package that may never ship. What changed: changes 2 and 4–7, and Appendix B's A rows. The ADR declares `**Extends:**` ADR-001, ADR-002 and ADR-012, and confines the subprocess boundary to one module, as ADR-007 does for ts-morph. No plan owns it yet.                                                                                                                                          |
| **B**: kernel module graph         | Accepted, reshaped                                                              | Accepted, reshaped: behind `@nielspeter/eess/internal` until a second dialect uses it                                                                                                            | Accepted, reshaped                                        | **Accepted, reshaped** | As the three lenses ruled. Plannable alone. What changed: change 3, behind `@nielspeter/eess/internal` (ADR-011), and Appendix B's B rows. No plan owns it yet.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **C**: walking skeleton            | Accepted, reshaped                                                              | Held until D names a binding with a consumer, buildable without E. Alternatively: the maintainer's request is the bet, said in Priority, **and D must still name a binding buildable without E** | Accepted, reshaped                                        | **Accepted, reshaped** | Taken on product's stated alternative, not an overrule: the maintainer's request is the bet (change 13). Product's condition is kept as a condition: **C's plan is not frozen to Ready until D's binding is chosen and is buildable without E.** C may be planned before then. What changed: changes 1 and 8–11, and Appendix B's C rows. The plan splits it into two PRs, helper and resolver, then the rule and the CLI. No plan owns it yet.                                                                                                                                                       |
| **D**: one crossvalidate binding   | Held: unholds on 014's ruling **or** the maintainer picking the Mermaid binding | Accepted, reshaped: the gate. Pick the binding before C is planned; if Mermaid, a minimal `classes()` (names, bases) moves from E into D                                                         | Accepted                                                  | **Held**               | Two unhold paths, whichever comes first: **(a)** the maintainer picks the Mermaid class-diagram binding; D then takes a minimal `classes()` (names and bases) from E, so it is buildable without E; **(b)** proposal 014 is ruled, and its consumer wants eess-py's test side. Held, although enforcement accepted D and product accepted it reshaped, because the choice is the maintainer's or that consumer's, and product's reading of 014's consumer evidence shows that consumer is already served. Until one path is taken, the body's "this ask is the reason for the dialect" does not hold. |
| **E**: the rest of the first slice | Held                                                                            | Held                                                                                                                                                                                             | Held: record review 1's I7 and the ADR-017 note against E | **Held**               | Unholds when an adopter or the maintainer **names the rules** wanted. Method observed that a request for the dialect may already meet a looser condition; naming rules is the real one. The first review's I7 (security break classes, aliases, star imports) and the ADR-017 note on `extend`/`implement` are recorded against E.                                                                                                                                                                                                                                                                    |
| **F**: inferred types              | Held                                                                            | Held                                                                                                                                                                                             | Held                                                      | **Held**               | Unholds when an adopter's rule needs an inferred type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Changes owed

The fifteen below summarise the review. **Appendix B is the complete list**, one row per finding, and every row there is owed except the few its preface names. The first recording of this section left out the rows Appendix B marks MISSING or PARTLY.

**Critical**

1. **The rule's target must resolve** (enforcement, product, both measured). The criteria make only
   an empty source selector a finding. `notImportFrom('myapp.infrastucture')`, with the target
   misspelt, stays green on a real violation. import-linter (contract kept) and pytest-archon do
   the same. Every name passed to `notImportFrom` must resolve to a module or be a finding (ADR-018).
   This needs a fixture and a non-vacuity row.
2. **A Python waiver would not work, and a docstring would act as one** (architect; re-run by the
   coordinator on the built kernel).
   - **The parser reads `//` and `<!-- -->` only** (`packages/core/src/exclusion-comments.ts:100-103` for `//`, and `:120-122` for the HTML forms).
     For a `.py` file the default masker is the JavaScript one.
   - **Measured:** `// eess-exclude-start … // eess-exclude-end` written inside `"""` docstrings
     produced a block exclusion over lines 2 to 7, and a `# eess-exclude` comment produced none.
   - **The body is wrong.** It says ADR-012 lets eess-py supply a Python lexer. The capability is a
     masker, not a comment syntax.
   - **Owner:** an ADR-012 amendment, inside Ask A, with a row for each case.
   - **Other file types:** reproduced 2026-10-15 for eess-gherkin, a shipped false green. Recorded
     as [bug 0419](../bugs/fixed/0419-a-waiver-in-a-gherkin-doc-string-suppresses-a-real-finding.md).

**Important**

3. **B's scope and proof** (architect, enforcement).
   - **What moves.** C's one rule reads only forward edges (`packages/ts/src/conditions/dependency.ts:282-306`).
     So B moves a neutral edge fact (from, to or unresolved, line, a "counts toward cycles" flag)
     and forward-edge glob matching. TypeScript's edge kinds stay in eess-ts.
   - **What stays.** `haveNoUnusedExports` stays in eess-ts. The slice builder's
     `ownsDiscoveryDiagnosis()` moves only with its empty-slice self-report.
   - **The proof.** "No verdict changes" means a byte-equal JSON differential before and after,
     including `examined` and baseline hashes (`packages/core/src/baseline.ts:122-130`), and
     unchanged `.d.ts` for the public `Slice` type. It also needs a kernel non-vacuity row, and
     hand-built edges of Python's shape (dotted ids, an optional edge, an unresolved target).
4. **Dotted names** (architect, product).
   - **Coverage.** A name covers the module and its descendants, and `myapp.domain` does not match
     `myapp.domainx`.
   - **Implementation.** Names compile to path globs under the declared roots, so the existing
     dead-glob machinery applies.
   - **A path-style argument** is a finding that suggests the dotted spelling.
5. **Isolation** (architect). `python -I` still runs `site`, which runs `.pth` files, and editable
   installs are `.pth` files. Use `-I -S`, with a fixture whose `.pth` writes a sentinel that must
   not appear.
6. **`feature_version` is best-effort** (enforcement, measured: on 3.13 the 3.12 f-string
   `f"{"a"}"` parses under `(3, 10)`). Either state the limit in the ADR, or run the helper on an
   interpreter at the declared floor.
7. **"By path" has three holes** (enforcement).
   - uv's in-project `.venv` puts third-party code inside the project, so discovery needs named
     exclusions.
   - A misspelt top-level name (`myap.…`) is classified external.
   - Namespace packages have no criterion, and import-linter drops them silently.
8. **The CLI loader** (architect). Lift eess-ts's `importRuleModule`, which conforms to ADR-015, into
   the kernel's internal API, or copy it with the debt recorded. Do not make a third copy that
   differs.
9. **Dogfood** (enforcement). One `notImportFrom` can be over-fitted to the sabotage row. The
   "stdlib only" rule needs an allow-list (`onlyImportFrom`, or a stdlib-complement target), and its
   sabotage row adds an import the rule does not name.
10. **Non-vacuity rows for each claimed difference** (enforcement):
    - a resolver that classifies an internal import as external;
    - an emptied `import_module` extractor;
    - classification by "installed" instead of by path;
    - target resolution switched off.
11. **First-review items the rewrite dropped** (enforcement):
    - remedies for each cause of an unresolved import;
    - the null-byte half of the encoding fixture;
    - whether a `SyntaxError` finding can be suppressed;
    - the interpreter's path and version in the summary;
    - the dynamic-import count as a receipt field, since the CLI prints no `examined` (bug 0174).
12. **What moves** (product).
    - `family.rules.ts:35` hard-codes the dialect set.
    - `.github/workflows/publish.yml:54` hard-codes the publish order, and its tests (`:46`) need a
      Python.
    - `RELEASING.md:471` requires a manual first publish.
    - The README Packages table needs a row.
    - Changesets: B a minor on `@nielspeter/eess`, C a first `@nielspeter/eess-py` release, D a minor
      on `@nielspeter/eess-crossvalidate`.
13. **Priority** says that the maintainer's request is the bet and that no adopter or binding has
    asked (product, method).
14. **Text** (method).
    - **Scope the claims.** Problem's "those tools" means the three spike 0418 measured; tach, deply,
      Ruff and Bandit were only checked on PyPI.
    - **Fix two false sentences.** "Each ask is closable on its own" is false for D, and "each later
      ask depends on the earlier ones" is false for B.
    - **Attribute the numbers.** 7 MB was the architect reviewer's measurement, and 2.55 s is parse
      and compile together. Pyright's 34 MB is in spike 0417's "Not measured".
    - **Retitle.** The title over-claims.
15. **Spike 0418's gaps** (method, product): run spike 0417's other eight probes against the tools,
    and measure tach.

### Next step

Fold changes 1–15 and Appendix B's rows into the body as edits, not a third rewrite. Then plan B, and plan A with C. C's plan is not frozen to Ready until D's binding is chosen and is buildable without E. The maintainer
has scheduled proposal 006's Ask C first, so this proposal waits behind it. Nothing here is built
until those plans are drafted and frozen.

## Appendix A — original submission (superseded 2026-10-14)

> Preserved below the review rather than edited away, per the lane's rule. Verbatim, including the
> annotations the review added in place. Its headings are one level lower, and nothing else has changed.

### Proposal 016 (original submission) — eess-py: a Python dialect that states what eess-ts states

**State:** Draft — filed 2026-10-14 at the maintainer's request; not reviewed.
**Priority:** Medium — no shipped rule over-claims, since eess reads no Python today. A Python
project cannot state its architecture decisions as rules at all, and one consuming project is
already half-Python (proposal 014).
**Origin:** self-found · the maintainer's request, 2026-10-14: "make an eess-py, equivalent to
eess-ts". Engine measured in [spike 0417](../spikes/0417-which-engine-reads-python-for-eess-py.md).
**Affects:** a new package, `@nielspeter/eess-py`. The kernel is not expected to change; any change
it needs is a finding of the plan, not an ask here.

### Problem

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
_Falsified by review: PyTestArch and pytest-archon have a fluent rule shape, and import-linter,
tach and deply enforce layers. See the Review below._

### Measured

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

### Existing code survey

- **The family pattern is set.** A dialect is its own package on the kernel, layered as
  `model → predicates → conditions → builders` (plus `presets/`). It re-exports the kernel symbols
  it uses (plan 0089, `check:family`), and binds to other dialects through `eess-crossvalidate`.
  eess-md, eess-mermaid and eess-gherkin all follow it, and none needs the TypeScript compiler.
- **The kernel already owns everything that is not language-specific:** _(falsified by review:
  the import graph, cycles, slices and layer order live in eess-ts. See the Review below.)_
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

### Asks

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

### Acceptance criteria

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
    _(insufficient, per review: an editable install passes it)_
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

### Open questions

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

### Alternatives considered

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

### Out of scope

- Inferred types (Ask C).
- Jupyter notebooks, `.pyi` stubs as a source, and Cython.
- A Python-native API (`pip install eess`). Rules are written in TypeScript, like every dialect's;
  only the facts come from Python.

## Appendix B — every finding of the second review, and where it went

> Built 2026-10-15 from the four reviewers' reports, after a method review found the first recording
> of the second review had dropped findings without saying so. The reports themselves were not kept
> in the repository, so this list is the durable record of them. **Every row is owed, except these.** The disposition table declines two: product C1e (decide D before anything else; the record lets C be planned first, with D's choice gating only C's freeze) and method I3c (name the Mermaid binding now; the record leaves that pick to the maintainer). Method I3d is mostly adopted: its Held-on-014 shape is D's path (b), and C's freeze waits on D. Enforcement R-e is an observation with nothing to carry.
> column says how the first recording (commit `445921a1`) carried it: MAPPED rows are in changes
> 1–15, and PARTLY and MISSING rows were left out in whole or in part. The per-ask divergences it
> describes are corrected in the disposition table above.

Sources: the four second-review reports (architect, product, enforcement, method); the record = `work/proposals/016…md` at 445921a1,
section "Review — 2026-10-14, second, after the rewrite" (lens table, disposition rows A–F,
changes owed 1–15). The same commit also wrote annotations into the proposal body (`:44`, `:64`,
`:69`) and a "Corrections after review" section into spike 0418; where a finding landed only
there, the Where column says so ("0418 Corr." / "body :L") — it is in the commit but **not** in
the review section's owed list.

Status: **MAPPED** = carried in substance · **PARTLY** = carried, with the named part missing ·
**MISSING** = nowhere in the commit.

One row per distinct finding. Where a reviewer's numbered finding carries several separable
demands, it is split into sub-rows (a, b, …), because the record carried them unevenly.

### 1. Verdicts and per-ask dispositions, as each reviewer wrote them

|                             | Architect                                                                                                                                                                      | Product                                                                                                                                                                                                               | Enforcement                                                                                                                                               | Method                                                                                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Verdict**                 | "Ship with changes."                                                                                                                                                           | "Split and sequence."                                                                                                                                                                                                 | "Ship with changes."                                                                                                                                      | "nearly ready for a second review, with one owed measurement and several edits first." No critical findings.                                                           |
| **A** engine ADR            | **Accepted, reshaped** — own the comment-syntax / ADR-012 amendment (C1); `-I -S` (I4); decide how dotted names reach dead-glob machinery (I3); declare `**Extends:**` (M1)    | **Accepted, reshaped: lands _with_ C, not before it** — alone its rows are all `pending` and it amends ADR-001/002 for a package that may never ship; does not close alone                                            | **Accepted, reshaped** — `feature_version` best-effort (I2); discovery and in-tree exclusions named (I3); Enforcement-row tiers sketched (M3)             | no table. M11: assign open question 2 (source roots) to A or C                                                                                                         |
| **B** kernel graph          | **Accepted, reshaped** — scope to the neutral edge fact + forward-edge matching (I1); "no verdict change" as a differential incl. identity hashes and public `Slice` type (I2) | **Accepted, reshaped** (settled in review 1; only the surface reshaped) — behind `@nielspeter/eess/internal` (ADR-011) until a second dialect consumes it                                                             | **Accepted, reshaped** — differential verdict criterion, edge facts carrying resolution status, empty-discovery ownership moves with the self-report (I4) | no table. I3: B does not depend on A (false sentence at :98)                                                                                                           |
| **C** walking skeleton      | **Accepted, reshaped** — reuse the ADR-015 loader, no third copy (I5); blocked on the C1 fix                                                                                   | **Held, with an unhold condition** — unhold when D's binding is named, has a consumer (maintainer counts), and is buildable within C+D without E; add criteria from I1 and I3                                         | **Accepted, reshaped** — target-resolution criterion (C1); dogfood expressibility (I5); non-vacuity row per differentiator (I6)                           | no table. M12: C is large; plan may need to split helper from rule                                                                                                     |
| **D** crossvalidate binding | **Held with unhold condition** — 014's ruling on its out-of-scope line, **or the maintainer picks the Mermaid binding**                                                        | **Accepted, reshaped: it becomes the gate** — pick the binding before C is planned; if Mermaid, minimal `classes()` (names, bases) moves from E into D; if 014's pytest side, 014 must first be ruled wanting eess-py | **Accepted** — criteria in its own plan; 014's ruling a precondition, as stated                                                                           | no table. I3: either name the binding now (Mermaid needs nobody's ruling) and give D criteria, or make D `Held` with unhold "014 reviewed and its consumer confirming" |
| **E** rest of slice         | **Held** (agreed) — as written                                                                                                                                                 | **Held** (as proposed)                                                                                                                                                                                                | **Held, with unhold condition** — as written; record review 1's I7 and the ADR-017 note against E                                                         | no table. M10: unhold condition may already be met by the maintainer's request; require _named rules_                                                                  |
| **F** inferred types        | **Held** (agreed)                                                                                                                                                              | **Held** (as proposed)                                                                                                                                                                                                | **Held, with unhold condition** — as written                                                                                                              | —                                                                                                                                                                      |

**What the record wrote:** lens table — Architect "Ship with changes", Enforcement "Ship with
changes", Product "Split and sequence", Method "no verdict; fixes, nothing critical" (method's
actual verdict line not recorded). Disposition: **all six asks `Held`**. A and B "Ready to plan",
unholding when their plans are drafted (three lenses' `Accepted, reshaped` on A and B not recorded
as such); A's product condition "lands with C" not recorded or stated as overruled; C does not
wait for D, "Product ruled the opposite; overruled" (product's "buildable without E" condition not
carried); D unholds only on the 014 path (architect's and method's Mermaid-now path not recorded);
E carries review 1's I7 + ADR-017 note (enforcement's ask: MAPPED); method M10 on E: MISSING.

### 2. Findings

#### Architect

| Label | Finding                                                                                                                                                                                                                               | Where in the record                                                        | Status                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| C1a   | ADR-012's capability is a masker, not a comment syntax; `firstCommentBody` reads `//` only, other forms `<!-- -->`; `#` needs a kernel change                                                                                         | owed 2 (bullets 1, 3)                                                      | MAPPED (pointer `:100-103` omits `:120-122`, see M-row method M13)                    |
| C1b   | The kernel default (JS scanner for `.py`) runs _over_ the injected masker (`packages/core/src/exclusion-comments.ts:396-405`), so a Python masker is defeated; clause 3's "conservative default" holds only where the default can lex | owed 2 says "for a `.py` file the default masker is the JavaScript one"    | PARTLY: owed 2, missing the composition point (default runs over the injected masker) |
| C1c   | Kernel `executeRule` takes no masker (`packages/core/src/execute-rule.ts:151`); only eess-ts's duplicate injects one; eess-py would build on the kernel path                                                                          | —                                                                          | MISSING                                                                               |
| C1d   | Measured: `//` directives inside `"""` honoured (block exclusion covering an import); `# eess-exclude` ignored                                                                                                                        | owed 2 ("Measured", re-run by coordinator)                                 | MAPPED                                                                                |
| C1e   | Owner: Ask A's ADR or an explicit kernel step before C; content = ADR-012 amendment: introducer part of the dialect capability; unlexable extension → no directives + instrument finding; kernel `executeRule` accepts the masker     | owed 2 ("Owner: an ADR-012 amendment, inside Ask A"); row A cites change 2 | PARTLY: owner carried; the amendment's three content points missing                   |
| C1f   | Acceptance criterion: a `#` waiver applies; a directive inside `"""` never does; a non-vacuity row for each                                                                                                                           | owed 2 ("with a row for each case")                                        | PARTLY: "a row for each case", missing the two named criteria and non-vacuity rows    |
| C1g   | Drop "it does not need a second parser"                                                                                                                                                                                               | owed 2 ("The body is wrong")                                               | MAPPED (body sentence not annotated, per review-210 I4)                               |
| C1h   | Scope note: the default-scanner hole already applies to `.feature`, `.yml` etc.; record as its own bug                                                                                                                                | owed 2 ("Other file types: unverified … file a bug if it reproduces")      | PARTLY: softened from "record a bug" to "check, then file if it reproduces"           |
| I1a   | B's scope contains nothing C's rule uses; `notImportFrom` reads only forward edges (`dependency.ts:282-306`); B must include a neutral edge fact + forward-edge glob matching                                                         | owed 3 ("What moves")                                                      | MAPPED                                                                                |
| I1b   | B must also take edge-coverage accounting; kernel already owns `recordEdgeCoverage` (survey omits it)                                                                                                                                 | —                                                                          | MISSING                                                                               |
| I1c   | Neutral fact carries only from/to (to may be unresolved), line, one "counts toward cycles" boolean; kernel never sees an edge `kind`                                                                                                  | owed 3                                                                     | MAPPED                                                                                |
| I1d   | Neutral fact also carries a dialect-supplied `edgeVerb` and identity discriminator (`edgeDiscriminator`)                                                                                                                              | —                                                                          | MISSING                                                                               |
| I2a   | "No verdict change" = byte-equal JSON differential incl. message, line, order and baseline identity hash                                                                                                                              | owed 3 ("The proof")                                                       | MAPPED                                                                                |
| I2b   | Public eess-ts `Slice`/`SliceDefinition` types must not change; else B is a breaking eess-ts release (`check:release`)                                                                                                                | owed 3 ("unchanged `.d.ts` for the public `Slice` type")                   | PARTLY: `.d.ts` carried, missing the breaking-release/`check:release` consequence     |
| I2c   | `haveNoUnusedExports` stays in eess-ts; only the reverse graph moves                                                                                                                                                                  | owed 3 ("What stays")                                                      | MAPPED                                                                                |
| I2d   | Reverse graph cache is `WeakMap<Project,…>`; kernel has no project (ADR-013) — plan must name cache key and reset path, cache must not survive `fork()`                                                                               | —                                                                          | MISSING                                                                               |
| I2e   | Survey overstates the ts-morph binding (tarjan, slice.ts, glob diagnosis are ts-morph-free); real work is a change of node identity; say so to size B                                                                                 | —                                                                          | MISSING                                                                               |
| I2f   | ADR-011: the graph goes behind `@nielspeter/eess/internal`; state the default                                                                                                                                                         | —                                                                          | MISSING                                                                               |
| I3a   | Dotted names compile to path globs under declared roots so dead-glob machinery applies; decide in A                                                                                                                                   | owed 4 ("Implementation"); row A                                           | MAPPED                                                                                |
| I3b   | Namespace packages need a stated rule                                                                                                                                                                                                 | owed 7 (third bullet)                                                      | MAPPED                                                                                |
| I3c   | "Matches no module is a finding" must cover the `notImportFrom` _argument_, not only `modules()`                                                                                                                                      | owed 1                                                                     | MAPPED                                                                                |
| I4    | `python -I` still runs `site`/`.pth`; use `-I -S`, fixture with a sentinel-writing `.pth`                                                                                                                                             | owed 5                                                                     | MAPPED                                                                                |
| I5    | Do not write a third rule-file loader; lift `importRuleModule` into kernel internal, or copy eess-ts's with the debt recorded                                                                                                         | owed 8                                                                     | MAPPED                                                                                |
| M1a   | New ADR declares `**Extends:**` (gated) rather than prose "Amends"                                                                                                                                                                    | row A (Extends ADR-001, 002, 012)                                          | MAPPED                                                                                |
| M1b   | Name the ADR-001 Enforcement rows touched: Vitest-only (helper tested via Vitest), Prettier (what formats/lints `.py`)                                                                                                                | —                                                                          | MISSING                                                                               |
| M1c   | ADR-007-style clause confining the subprocess/JSON boundary to one module                                                                                                                                                             | row A                                                                      | MAPPED                                                                                |
| M2a   | `feature_version` is best-effort; state the gap                                                                                                                                                                                       | owed 6                                                                     | MAPPED                                                                                |
| M2b   | Name the fixtured constructs                                                                                                                                                                                                          | —                                                                          | MISSING                                                                               |
| M3    | Exclusion scan reads the file as UTF-8, a second reader beside the helper's cookie decode; note it in the C1 change                                                                                                                   | —                                                                          | MISSING                                                                               |
| M4    | "16,063 of 16,064" counts project-internal imports only; say so                                                                                                                                                                       | body `:69` annotation ("_internal_ imports … the second review's wording") | MAPPED (body note only, not in owed list)                                             |
| M5    | Test B's neutral shape with a Python-shaped fixture: dotted ids, optional edge, unresolved `to`                                                                                                                                       | owed 3 ("hand-built edges of Python's shape")                              | MAPPED                                                                                |

#### Product

| Label | Finding                                                                                                                                                                                 | Where in the record                                                   | Status                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| C1a   | D's named candidate (014's pytest side) is already served: the consumer built its own `ast` extractor                                                                                   | row D                                                                 | MAPPED (row D says product "measured"; it read 014's evidence — review-210 M4)                                                |
| C1b   | The generic primitive is 014's supplied-side seam (`TestCitationSite[]`), not a dialect; routing via eess-py would replace a working consumer-owned extractor                           | row D ("a binding it does not already serve")                         | PARTLY: row D implies it, missing the 014-seam-is-the-primitive argument                                                      |
| C1c   | The fallback binding (Mermaid vs Python classes) needs `classes()` with bases, which E holds; pull a minimal `classes()` into D                                                         | —                                                                     | MISSING                                                                                                                       |
| C1d   | ADR Enforcement tables and "one evidence receipt" are not new with eess-py (any path citable; title resolution `packages/ts` only, bug 0262; receipt comes with any `correspondence()`) | —                                                                     | MISSING                                                                                                                       |
| C1e   | Fix: make D's choice the first decision — rule 014, then name a D binding 014 doesn't cover, then A and C                                                                               | row C ("does not wait for D … Product ruled the opposite; overruled") | MAPPED as overruled (review-210 I2: it is product's own alternative, not an overrule)                                         |
| C1f   | Alternative: if the maintainer's request is the bet, say so in Priority and accept C — but D must still name a binding buildable without E                                              | owed 13; row C                                                        | PARTLY: owed 13 + row C, missing "D must name a binding buildable without E"                                                  |
| I1a   | A typo in the forbidden _target_ passes in import-linter and pytest-archon; every name/glob to `notImportFrom` must resolve or be a finding (ADR-018), with a non-vacuity row           | owed 1                                                                | MAPPED                                                                                                                        |
| I1b   | Update spike 0418's table and the Problem section with it                                                                                                                               | 0418 Corr. bullet 3; body `:44` note                                  | MAPPED (outside owed list; body `:37-38` sentence itself not annotated, review-210 I4)                                        |
| I2a   | The `missing` row shows no missed violation (crashes at import; eess-ts leaves unresolved to `tsc`; proposal exempts `except ImportError`)                                              | 0418 Corr. bullet 4                                                   | MAPPED (spike only)                                                                                                           |
| I2b   | Replace/extend `missing` with `from myapp.infrastructure.nope import x` (import-linter passes) as the evidence                                                                          | 0418 Corr. bullet 4                                                   | PARTLY: in spike Corrections (with the PyTestArch confound, review-210 I6), missing from the proposal's Problem and owed list |
| I2c   | Note the crash-at-import overlap in Problem so the claim is scoped honestly                                                                                                             | —                                                                     | MISSING                                                                                                                       |
| I3a   | Decide coverage: a bare dotted name = module and descendants; no `myapp.domainx` match                                                                                                  | owed 4 ("Coverage")                                                   | MAPPED                                                                                                                        |
| I3b   | `*` matches one segment, `**` any number; a fixture for each                                                                                                                            | —                                                                     | MISSING                                                                                                                       |
| I3c   | A path-shaped argument (`src/myapp/**`) is a finding suggesting the dotted spelling                                                                                                     | owed 4                                                                | MAPPED                                                                                                                        |
| I4a   | `family.rules.ts:35` hard-codes the dialect set → `check:family` silently skips eess-py, "a fail-open in our own gate"; C's criteria + a non-vacuity row                                | owed 12 (file listed)                                                 | PARTLY: owed 12, missing the non-vacuity row and the fail-open severity                                                       |
| I4b   | `publish.yml:54` publish order; `:46` runs tests so publish needs a pinned Python                                                                                                       | owed 12                                                               | MAPPED                                                                                                                        |
| I4c   | `publish.yml:5` header "six packages" goes stale                                                                                                                                        | —                                                                     | MISSING                                                                                                                       |
| I4d   | `RELEASING.md:471` manual first publish                                                                                                                                                 | owed 12                                                               | MAPPED                                                                                                                        |
| I4e   | README Packages row                                                                                                                                                                     | owed 12                                                               | MAPPED                                                                                                                        |
| I4f   | README prerequisite (Node 24 _and_ Python) and `README.md:76` "own parser" line                                                                                                         | —                                                                     | MISSING                                                                                                                       |
| I4g   | Changesets: B core minor; C eess-py 0.1.0; D crossvalidate minor                                                                                                                        | owed 12                                                               | MAPPED                                                                                                                        |
| I4h   | Changesets: B also `@nielspeter/eess-ts` patch or `none`                                                                                                                                | —                                                                     | MISSING (review-210 M9)                                                                                                       |
| I4i   | D's subpath takes eess-py as an _optional_ peer (`crossvalidate/package.json:69-79` pattern)                                                                                            | —                                                                     | MISSING                                                                                                                       |
| I5    | State the interpreter as a prerequisite in the package README; interpreter-not-found `Fix:` names what to install (ADR-016 real remedy)                                                 | —                                                                     | MISSING                                                                                                                       |
| M1    | Title overclaims; suggested "eess-py: Python joins the family, starting with one import rule"                                                                                           | owed 14 ("Retitle")                                                   | MAPPED                                                                                                                        |
| M2a   | PyTestArch's README documents `are_sub_modules_of` excludes the package, so "a reader would not expect" overstates                                                                      | 0418 Corr. bullet 1                                                   | MAPPED (spike only; enforcement judged it "fair" — disagreement not attributed, review-210 M6)                                |
| M2b   | Wrong scan root is close to PyTestArch's documented first README example; cite the README                                                                                               | —                                                                     | MISSING (superseded in part by the wrong-root correction, but the README citation is not recorded)                            |
| M2c   | tach and deply unmeasured; tach is the closest competitor; say so plainly                                                                                                               | owed 15 ("measure tach")                                              | PARTLY: owed 15, missing deply                                                                                                |
| M3    | Priority should say "bet", not imply demand                                                                                                                                             | owed 13                                                               | MAPPED                                                                                                                        |
| M4    | Open question 3 is answered by 014's Consumer evidence (they built their own extractor); record that                                                                                    | row D (mentions the extractor)                                        | PARTLY: row D, missing that open question 3 is answered/closed                                                                |

#### Enforcement

| Label | Finding                                                                                                                                                                                    | Where in the record                           | Status                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R-a   | Reproduction: spike 0418's wrong-root claim is a confound (edge kept; passes are the `are_sub_modules_of` gap); proposal `:40-42` repeats it; withdraw or re-measure (= I1)                | 0418 Corr. bullet 1; body `:44` note          | MAPPED (outside owed list)                                                                                                            |
| R-b   | Result 1's lead sentence contradicts its table                                                                                                                                             | 0418 Corr. bullet 2                           | MAPPED (spike only)                                                                                                                   |
| R-c   | `missing` is not a rule violation; "should fail" is eess's own standard, say so                                                                                                            | 0418 Corr. bullet 4 (product's version)       | PARTLY: spike Corrections, missing "eess's own standard, not the tool's promise" framing in the proposal                              |
| R-d   | Missed case: `if TYPE_CHECKING:` import is an edge in both tools — sets the precedent for C's open decision                                                                                | —                                             | MISSING                                                                                                                               |
| R-e   | Missed case: `domain/` with no `__init__.py` → import-linter "does not exist" (misattributed)                                                                                              | —                                             | MISSING (informational)                                                                                                               |
| C1a   | `notImportFrom`'s target must resolve to ≥1 module under a declared root, else a configuration finding naming the nearest module; fixture + non-vacuity row                                | owed 1                                        | PARTLY: owed 1, missing "naming the nearest module"                                                                                   |
| C1b   | A third-party target (`notImportFrom('requests')`) may match nothing on purpose; not resolved against installed; state the limit                                                           | —                                             | MISSING                                                                                                                               |
| C1c   | Correct proposal `:35-36` and 0418 Result 1 — "a rule naming a module that does not exist" holds for the source only                                                                       | 0418 Corr. bullet 3                           | PARTLY: spike corrected, proposal `:37-38` not annotated (review-210 I4)                                                              |
| I1    | Wrong-root claim is a confound; replace with the namespace-package drop or withdraw                                                                                                        | 0418 Corr. bullets 1, 5; body `:44`           | MAPPED (outside owed list)                                                                                                            |
| I2a   | `feature_version` best-effort (`f"{"a"}"` parses at 3.10 on 3.13); state limit with gated/ungated constructs in the Enforcement row, or run the helper at the floor                        | owed 6                                        | MAPPED                                                                                                                                |
| I2b   | The criterion's fixture must include a construct `feature_version` does not gate, with the stated outcome                                                                                  | —                                             | MISSING                                                                                                                               |
| I3a   | In-tree uv `.venv`: named silent exclusions (`.venv`, `site-packages`, `build`, `__pycache__`, `.tox`, `node_modules`, out-of-tree symlinks) via `silent-exclusion.ts`; fixtures green/red | owed 7 ("discovery needs named exclusions")   | PARTLY: owed 7, missing the list, the `silent-exclusion.ts` route and both fixtures; also that this was review 1's I4 bullet, dropped |
| I3b   | Misspelt top-level name classified external; stance: count in receipt, `PathFinder.find_spec` on the top-level name, arguably a finding if unguarded                                       | owed 7                                        | PARTLY: owed 7 names the hole, missing the stance                                                                                     |
| I3c   | PEP 420: a `.py` under a root without `__init__.py` is a module or a named exclusion, never silently absent; `nsinfra` fixture red                                                         | owed 7 ("no criterion")                       | PARTLY: names the gap, missing the rule and fixture                                                                                   |
| I4a   | B: byte-equal differential `{ruleId,file,line,message,suggestion}` + equal `examined` per rule                                                                                             | owed 3                                        | MAPPED                                                                                                                                |
| I4b   | Kernel break classes with hand-built edges: cycle red, layer inversion red, zero modules/edges → config finding, unresolved edge reaches dialect as a fact                                 | owed 3 ("hand-built edges of Python's shape") | PARTLY: owed 3, missing the four named break classes                                                                                  |
| I4c   | Kernel non-vacuity row: tarjan returning `[]` must go red                                                                                                                                  | owed 3 ("a kernel non-vacuity row")           | MAPPED                                                                                                                                |
| I4d   | Edge fact keeps resolution status (`resolvedPath` analogue)                                                                                                                                | owed 3 ("to or unresolved")                   | MAPPED                                                                                                                                |
| I4e   | `ownsDiscoveryDiagnosis()` moves only with the empty-slice self-report                                                                                                                     | owed 3 ("What stays")                         | MAPPED                                                                                                                                |
| I4f   | No new registration surface for `owns-empty-discovery.ts`/`cardinality.ts`; a kernel builder claiming ownership has a fixture whose empty case goes red                                    | —                                             | MISSING                                                                                                                               |
| I5a   | Dogfood "stdlib only" needs an allow-list (`onlyImportFrom` or stdlib-complement); sabotage row adds an import the rule doesn't name                                                       | owed 9                                        | MAPPED                                                                                                                                |
| I5b   | Name the `check:*` script and its `validate`/CI wiring (nonvacuity reverse sweep will demand a row)                                                                                        | —                                             | MISSING                                                                                                                               |
| I6    | Non-vacuity rows: internal→external resolver, emptied `import_module` extractor, by-installed classification, target resolution off                                                        | owed 10                                       | MAPPED                                                                                                                                |
| I7a   | Per-cause remedies for unresolved imports                                                                                                                                                  | owed 11                                       | MAPPED                                                                                                                                |
| I7b   | Null-byte / undecodable red half of the encoding fixture                                                                                                                                   | owed 11                                       | MAPPED                                                                                                                                |
| I7c   | Is a `SyntaxError` finding suppressible (instrument- or code-class)?                                                                                                                       | owed 11                                       | MAPPED                                                                                                                                |
| I7d   | Interpreter path and version in summary and receipt                                                                                                                                        | owed 11                                       | MAPPED                                                                                                                                |
| I7e   | Dynamic-import count (and absent `requires-python`) as a receipt field (bug 0174, ADR-014)                                                                                                 | owed 11                                       | PARTLY: owed 11, missing the absent-`requires-python` half                                                                            |
| M1    | Header "each must go red" covers green fixtures; reword, and give latin-1 a red twin                                                                                                       | owed 11 (null-byte half)                      | PARTLY: red twin carried, header rewording missing                                                                                    |
| M2    | `from pkg import submodule`: both `notImportFrom('…infrastructure')` and `notImportFrom('…infrastructure.db')` fire; resolver checks whether `Y` is a module                               | —                                             | MISSING                                                                                                                               |
| M3a   | Tier sketch for A's ADR (Tier 1 gated / Tier 3 / `n/a` limits)                                                                                                                             | —                                             | MISSING (also in enforcement's row-A condition)                                                                                       |
| M3b   | New ADR needs README and CLAUDE.md index rows (`check:spec`)                                                                                                                               | —                                             | MISSING                                                                                                                               |
| M3c   | `check:crossval` resolves only `packages/ts` titles (bug 0262); extend or state the limit                                                                                                  | —                                             | MISSING                                                                                                                               |
| M4    | Title honest only once non-literal dynamic imports and `feature_version` gaps are stated                                                                                                   | owed 14 (retitle) + owed 6                    | PARTLY: retitle carried, the condition linking it to the stated limits missing                                                        |
| M5    | 0418 "Not measured" should add target typo and namespace packages, or fold the measurements in                                                                                             | 0418 Corr. bullets 3, 5                       | MAPPED (spike only)                                                                                                                   |
| E-row | Record review 1's I7 (security break classes, star imports) and the ADR-017 heritage note against E                                                                                        | row E                                         | MAPPED                                                                                                                                |

#### Method

| Label | Finding                                                                                                                                  | Where in the record                                                              | Status                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| I1a   | "Fail closed on a file that does not parse" rests on one probe; run spike 0417's other eight                                             | owed 15; 0418 Corr. bullet 6                                                     | MAPPED                                                                                                                                         |
| I1b   | If not run, scope `016:35-36` to "one probe"                                                                                             | —                                                                                | MISSING (body `:37` not annotated, review-210 I4)                                                                                              |
| I2    | "Those tools" were seven; three measured; source the other four (PyPI)                                                                   | owed 14 ("Scope the claims")                                                     | MAPPED                                                                                                                                         |
| I3a   | D is "the reason for the dialect" but has no criteria and cannot close on this repo's action                                             | row D ("the body must stop calling it that"); ruling paragraph                   | MAPPED                                                                                                                                         |
| I3b   | Two false sentences at `:98` (closable on its own; later depends on earlier)                                                             | owed 14                                                                          | MAPPED (body not annotated, review-210 I4)                                                                                                     |
| I3c   | Fix option 1: name the binding now (Mermaid needs nobody's ruling) and give D criteria                                                   | —                                                                                | MISSING (row D keeps only the 014 path; review-210 I3)                                                                                         |
| I3d   | Fix option 2: state that A and C are justified only if D's precondition holds; D Held, unhold "014 reviewed and its consumer confirming" | row D (Held, unhold on 014 ruled + binding named)                                | PARTLY: Held carried, missing "consumer confirming" and the A/C-justified-only-if statement (record ruled the opposite: C does not wait for D) |
| I4a   | Review section uses the old ask letters; add a dated note                                                                                | review section note ("The first review's letters are the original submission's") | MAPPED                                                                                                                                         |
| I4b   | Board row (PROPOSALS.md) opens with superseded letters                                                                                   | —                                                                                | MISSING (review-210 I5: row now mixes both)                                                                                                    |
| I5a   | "Internal" qualifier dropped from 16,063 of 16,064                                                                                       | body `:69` annotation                                                            | MAPPED (body only)                                                                                                                             |
| I5b   | Django's local scripts outside roots counted third-party by elimination (the false-green mode); add Flask 290 of 299                     | —                                                                                | MISSING                                                                                                                                        |
| I5c   | Add the 60-line resolver to 0417's Harness so the re-run is reproducible                                                                 | —                                                                                | MISSING                                                                                                                                        |
| M1    | 7 MB is the architect reviewer's measurement of the spike's `ast.json`                                                                   | owed 14                                                                          | MAPPED                                                                                                                                         |
| M2    | 2.55 s is parse + compile together                                                                                                       | owed 14                                                                          | MAPPED                                                                                                                                         |
| M3    | "Agree on every call" — calls compared by line only                                                                                      | body `:64` annotation                                                            | MAPPED (body only)                                                                                                                             |
| M4    | Pyright 34 MB sits under 0417 "Not measured"                                                                                             | owed 14                                                                          | MAPPED                                                                                                                                         |
| M5    | 0418 Result 1 heading contradicts its table                                                                                              | 0418 Corr. bullet 2                                                              | MAPPED (spike only)                                                                                                                            |
| M6    | 0418's Decision generalises one tool's shape ("selectors and roots that drop edges")                                                     | —                                                                                | MISSING                                                                                                                                        |
| M7    | Two 0418 claims have no saved output (wrong-root run; "`SyntaxError`, line 3")                                                           | —                                                                                | MISSING                                                                                                                                        |
| M8    | 0417 Not-measured items `find_spec` and `compile` cost are answered in Corrections but unannotated                                       | —                                                                                | MISSING                                                                                                                                        |
| M9    | Criterion `:170` `from pkg import submodule`: say which edge eess-py records, rule fires either way                                      | —                                                                                | MISSING                                                                                                                                        |
| M10   | E's unhold condition may already be met by the maintainer's request; require named rules                                                 | —                                                                                | MISSING                                                                                                                                        |
| M11   | Open question 2 (source roots) has no owner; assign to A or C                                                                            | —                                                                                | MISSING                                                                                                                                        |
| M12   | Ask C is large; plan may split helper from rule                                                                                          | row C ("Split into two PRs: helper and resolver, then the rule and the CLI")     | MAPPED                                                                                                                                         |
| M13   | Pointer `packages/core/src/exclusion-comments.ts:102` shows `//` only; `<!-- -->` at `:119-122`; cite both                               | owed 2 cites `:100-103` for both                                                 | PARTLY: owed 2 repeats the single pointer, missing `:120-122` (review-210 M1)                                                                  |

### 3. Counts

| Lens        | Rows    | MAPPED | PARTLY | MISSING |
| ----------- | ------- | ------ | ------ | ------- |
| Architect   | 31      | 17     | 5      | 9       |
| Product     | 30      | 14     | 6      | 10      |
| Enforcement | 36      | 16     | 10     | 10      |
| Method      | 25      | 12     | 2      | 11      |
| **Total**   | **122** | **59** | **23** | **40**  |

(Counted mechanically from the Status column of section 2.)

Of the 59 MAPPED, 11 are carried **only outside the review section** — in the body's in-place
annotations or spike 0418's Corrections, not in "Changes owed" or rows A–F: architect M4; product
I1b, I2a, M2a; enforcement R-a, R-b, I1, M5; method I5a, M3, M5. The other 48 sit in owed changes
1–15, rows A–F, or the review section's letter note.

Per-ask: the record diverges from the reviewers on A (3 lenses `Accepted, reshaped` → `Held`;
product's "lands with C" unrecorded), B (3 lenses `Accepted, reshaped` → `Held`), C (architect and
enforcement `Accepted, reshaped`, product `Held` → `Held`, "does not wait for D"; product's
"buildable without E" condition dropped), D (architect's/method's Mermaid-now path and product's
`classes()`-into-D dropped), method's verdict line ("nearly ready … one owed measurement and several
edits first") recorded as "no verdict".

### 4. Items two lenses agreed on that are MISSING

- B behind `@nielspeter/eess/internal` (architect I2f, product row-B condition).
- `from pkg import submodule`, both halves / which edge (enforcement M2, method M9).
- Mermaid-binding-now as D's alternative unhold path (architect row D, method I3c).
