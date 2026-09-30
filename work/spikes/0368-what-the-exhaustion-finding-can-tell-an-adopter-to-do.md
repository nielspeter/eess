# Spike 0368: when the walk gives up, what can the finding tell an adopter to DO?

Measured 2026-09-30 for
[bug 0359](../bugs/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md),
after [spike 0367](./0367-must-the-disk-question-walk-the-whole-repo.md) settled that 0359 is
a report rather than a redesign.

## The question

0367 concluded that exhaustion must be **reported**. It did not ask what the report should
say, and that omission matters more than it looks, because ADR-009 rule 2 is binding:

> The remedy must be **real**. A message whose stated fix is impossible on the path that
> produced it is worse than no message: the agent tries it, it fails, and the agent then does
> the forbidden thing.

An exhaustion finding is unsuppressable by construction — it is the same class as
`emptyProjectViolation`. If its remedy amounts to _"your repository is too large"_, we would be
shipping a new unsuppressable finding with no achievable exit. That is
[0362](../bugs/fixed/0362-a-typod-ratchet-is-green-in-both-tools.md) again, one layer up, and
0362 has already cost this project two fixes and a release.

So: **is there a lever the adopter actually controls?**

## Method

Walk this repository twice with the production walk's shape — `readdirSync` with
`withFileTypes`, recursive — once with `disk-set.ts`'s 15-name prune list applied and once with
no pruning at all, counting directory entries and attributing them to their top-level
directory. Then read the code for what is reachable from the public API.

## Result 1 — pruning, not repository size, is the dominant term

| walk over this repository | entries    | share of the 50,000 budget |
| ------------------------- | ---------- | -------------------------- |
| prune list applied        | **2,262**  | 4.5%                       |
| no pruning at all         | **20,352** | 40.7%                      |

**The prune list removes 88.9% of entries.** Unpruned, this small repository would sit at 41% of
budget on its own. Whatever else is true, the budget is not primarily a statement about how big
a repository is — it is a statement about how much generated output is sitting in it.

Top consumers after pruning, which is what a finding could name:

| entries | share | directory  |
| ------- | ----- | ---------- |
| 1,552   | 68.6% | `packages` |
| 337     | 14.9% | `work`     |
| 128     | 5.7%  | `scripts`  |
| 53      | 2.3%  | `examples` |

## Result 2 — the prune list names 15 directories and misses the one that mattered

The list: `node_modules` `.git` `dist` `build` `out` `coverage` `.next` `.turbo` `.venv`
`vendor` `target` `.gradle` `.yarn` `.cache`.

Not named, all of them ordinary generated or cache output:

`.wrangler` `.svelte-kit` `.nuxt` `.output` `.parcel-cache` `.vite` `.astro` `.docusaurus`
`.serverless` `.terraform` `storybook-static` `tmp` `.pnpm-store` `.angular` `.expo`
`.dart_tool` `.sst`

**`.wrangler` is the one that matters, and it is measured, not hypothetical.** An adopter
profiling their own 15-package monorepo for
[0359](../bugs/0359-a-disk-walk-that-gave-up-reports-nothing-and-now-decides-a-verdict.md)
found `.wrangler` accounting for **58% of their entries** — a single unpruned generated
directory, more than half the walk, in the repository that measured closest to the budget.

## Result 3 — and today there is no lever at all

- **The budget is not tunable.** Its own docstring says so: _"An implementation constant, not
  part of the public contract and not tunable."_ A `budgetLimit` parameter exists on
  `buildDiskSet` but the public path, `diskSet(project)`, always passes the constant.
- **The prune list is not extensible.** `PRUNE` is referenced nowhere outside `disk-set.ts` —
  no option, no override, no extension point.

So as things stand, an adopter over the budget can do **nothing**. Both candidate levers exist
in the code and neither is reachable.

## Ruling — the remedy is real, and it reorders 0359's fix

There **is** an achievable remedy, and it is better than the one 0359 was heading for:

1. **Name the top consuming directories in the finding.** Specific, derived from the walk that
   just failed, and actionable — with 88.9% of entries prunable in a repository with no
   generated output at all, a repository that exhausts is overwhelmingly likely to be carrying
   directories that should never have been walked. "These four directories were 80% of the walk"
   is a remedy; "your repository is too large" is not.
2. **Extend the prune list.** This is the biggest single win available and 0359 did not consider
   it. Adding `.wrangler` alone would have taken the closest-measured real repository from 34%
   of budget to roughly 14%. It needs no new API and no configuration.
3. **Give the prune list an extension point**, so the remedy in (1) is one the adopter can act
   on for output the list will never anticipate.
4. **Raise the budget — last, not first.** 0359 and 0367 both put this near the front. Measured
   against pruning it is the weakest of the four: it moves the cliff, and 0367's figures for it
   are warm-cache only.

**What this changes about 0359.** Its `## Fix` currently reads "report exhaustion + raise the
budget". That is not wrong, but the ordering inverts the measured effect sizes, and it has no
answer to the ADR-009 rule 2 question at all. The report must name consumers, and the prune list
is the lever — the budget is the fallback.

## Honest limits

- **One repository, and it is the wrong one.** Every figure in Results 1 and 2 is this
  repository, which has no generated output and sits at 4.5% of budget. It establishes the
  _ratio_ (pruning removes 88.9%) and cannot establish what a repository near the cliff looks
  like. The `.wrangler` = 58% figure is the adopter's measurement, contributed for 0359, and is
  the only datapoint from a repository that came close.
- **The 17 unpruned names are a list, not a measurement.** They are directories these
  ecosystems generate; only `.wrangler` has a measured share. Adding the rest is cheap and
  low-risk, but the effect size is unknown for 16 of 17.
- **Not measured: whether naming consumers is enough.** Whether an adopter shown "`.wrangler`
  was 58% of the walk" actually resolves it is a question about people, and no spike settles it.
