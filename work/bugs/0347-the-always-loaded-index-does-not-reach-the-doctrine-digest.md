# Bug 0347: the always-loaded index does not reach the doctrine digest, and one binding corollary is in no digest at all

## Status

- **State:** Draft — measured, with a same-day instance.
- **Severity:** Medium — **no false green in the product; a false green in the
  method.** The binding clauses are written and correct. What fails is reach: the
  one document every agent has in context does not point at the digest that names
  them, so an agent plans against a headline instead of a rule. The cost is work
  that contradicts an ADR and has to be caught in review.
- **Origin:** measured on 2026-09-28 while drafting
  [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md),
  after the user asked whether the ADRs were clear enough. They are.
- **Reported:** 2026-09-28

## Symptom

**The digest exists and is good.** `docs/tests-cannot-lie.md:22-29` names the
doctrine clause by clause, with links: ADR-010's `{ violations, examined }`,
ADR-014's evidence at every seam, **ADR-009 Rule 1 by its own title** ("Actionable
findings fail; they never warn"), Rule 2, Rule 4, and ADR-014 §5's fail-closed
`.warn()`.

Two measured gaps:

| | |
| --- | --- |
| `grep -c "tests-cannot-lie" CLAUDE.md` | **0** |
| `grep -ic "migration" docs/tests-cannot-lie.md` | **0** |

1. **The digest is unreachable from the always-loaded file.** `CLAUDE.md` carries
   the ADR index table and is in every agent's context by construction. Its row
   for ADR-009 reads "A check that cannot fail is worth less than no check. Ported
   from `ts-archunit` ADR-008; **six binding rules**" — it says six rules exist and
   points at a 360-line document, and nothing links to the digest that lists them.
2. **One binding clause is in no digest at all.** ADR-009 Rule 1's *migration
   corollary* — "a migration's measuring instrument cannot be a warning either…
   the release that only warns is the release nobody reads", which then prescribes
   an explicitly invoked diagnostic — appears nowhere but inside Rule 1. A reader
   planning a migration has no path to it.

### The same-day instance

Drafting plan 0346, with `CLAUDE.md` in context throughout:

- The plan asserted **"nothing added here warns"** as an absolute. ADR-009 Rule 1
  states the opposite discriminator explicitly — the test is whether the *remedy*
  is optional, and `recommended` ships two rules at warn deliberately for that
  reason. The absolute also contradicts [ADR-003](../../adr/003-fluent-builder-dsl.md),
  which makes `.warn()` a first-class terminal.
- The plan's migration phase **re-derived** a shape Rule 1's corollary already
  prescribes, and arrived somewhere adjacent rather than at it.

Both were caught by reading the ADR, which happened only because the reader was
told to. The failure is not that the rules are unclear — they are unusually
precise. It is that a 360-line document is reached by an index line naming a
headline.

## Root cause

`CLAUDE.md`'s ADR table is a **census**, one line per ADR, and it is doing two
jobs: telling a reader which ADRs exist, and being the only thing most readers
will read. It is good at the first. For a document with six independently binding
rules plus corollaries, a one-line takeaway is not an index — it is a title.

`docs/tests-cannot-lie.md` already solved this, well, and unlinked.

## Fix

Not decided; the cheap shape is clear and it is **not** a new ADR.

- **Link the digest from the index.** One line in `CLAUDE.md`'s ADR section
  pointing at `docs/tests-cannot-lie.md` as where the clauses are named. This is
  the whole of the reach problem.
- **Give the migration corollary a digest entry**, since it is binding, it governs
  a decision anyone shipping a breaking gate faces, and it is currently reachable
  only by reading Rule 1 to the end.
- **The open question:** whether the index rows for the multi-rule ADRs (009 six
  rules, 010, 014) should name what their rules *cover* rather than restate the
  headline — "warn vs fail, remedies, snapshots, migrations" is a path in; "a check
  that cannot fail is worth less than no check" is a slogan. That is more words in
  a file whose size is itself a cost, which is why it is a question and not a
  candidate.

## Related

- [0330](./0330-what-a-rule-reads-is-ruled-in-archived-bug-records.md) — the same
  shape one level down: a binding ruling that exists and cannot be found. There it
  is a frozen bug record; here it is a long ADR behind a short index line.
- [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md) —
  the plan that got it wrong, and now records the correction in its own text.

## Verification

- [x] measured: the two greps above, the digest's coverage at
      `docs/tests-cannot-lie.md:22-29`, and the two errors in plan 0346.
- [ ] a ruling on whether the index rows change, or only gain the link
- [ ] the link, and the migration corollary's digest entry
- [ ] a changeset — or an explicit `none`, since this ships nothing an adopter
      installs
- [ ] `npm run validate` green.

Deferred: none.
