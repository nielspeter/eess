# eess validates eess

The eess monorepo is **customer zero**. Every dialect enforces on the repo that builds it, in CI, with **no baselines and no silenced rules** — the family is held to the standard it sells. If eess-ts couldn't keep eess-ts honest, it wouldn't be worth shipping.

## The gates

Each dialect runs against this repository as part of `npm run validate`:

| Gate               | Dialect              | What it enforces on this repo                                                                                                                                             |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:arch`       | `eess-ts`            | Kernel purity, dialect isolation, ADR-002 raw-TS ban, and an internal policy (layering, cycles, security, hygiene, metrics, the ADR-005 `as`/`!` bans) over every package |
| `check:diagram`    | `eess-mermaid`       | The kernel's class diagram (`docs/architecture.mmd`) — every class carries the `<<kernel>>` stereotype                                                                    |
| `check:crossval`   | `eess-crossvalidate` | That diagram and the kernel's code stay in agreement (both directions), and every test an ADR cites resolves in the real AST                                              |
| `check:corpus`     | `eess-md`            | 100 markdown docs (plans, ADRs, bugs, guide): cross-links resolve, `path:line` pointers are live, and every ADR's `## Enforcement` table is well-formed                   |
| `check:nonvacuity` | (harness)            | Every gate above is proven to **fail** on a committed violating fixture — no green-but-empty gates                                                                        |

## No shortcuts

The dogfooding runs under a binding invariant: **no baselines, no severity-muting, no scoping a rule down until it passes, no ignore-lists that hide violations.** A rule is either enforced on the whole repo or declared out of scope _before_ it runs, with a written reason. Every inline exception uses the tool's own sanction mechanism — `// eess-exclude <rule-id>: <reason>` — so the full list is greppable, and each carries its justification.

The audit surface — every adopted rule, every a-priori exclusion with its reason, and the product bugs the dogfooding itself surfaced — lives in [`work/dogfood-coverage.md`](https://github.com/NielsPeter/eess/blob/main/work/dogfood-coverage.md).

## Why it matters

Dogfooding isn't a demo — it's the regression suite for the framework's credibility. It has already caught real product bugs: inline exclusion comments that silently matched nothing, and a rule that mis-flagged ES `#private` fields as public. Both were found because eess was pointed at eess, and both are fixed with regression tests.
