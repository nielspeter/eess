# Bug 0198: nothing tells a ts-archunit user how to switch to eess-ts

## Status

- **State:** Draft — release-blocking for the replacement story.
- **Deferred:** none
- **Found:** 2026-08-21, while assessing readiness to retire the fork.

## Symptom

[Plan 0100](../plans/0100-publish-the-fold-retire-ts-archunit.md) will
`npm deprecate @nielspeter/ts-archunit`. A deprecation notice sends every
existing user looking for a migration path. **There is none.**

Measured across `docs/`, `README.md` and every package README, `ts-archunit` is
mentioned exactly three times, and none is instructions:

| where                        | what it says                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `docs/getting-started.md:15` | "evolved from ts-archunit's engine. Install `@nielspeter/eess-ts`." |
| `packages/ts/README.md:12`   | "Formerly published as `@nielspeter/ts-archunit`."                  |
| `docs/index.md:7`            | credits ArchUnit and ts-morph — unrelated                           |

`grep -rn 'migrat'` across `docs/` and `README.md` returns nothing tying the two
packages together. There is no page, no section, no snippet.

## Why this blocks the release rather than following it

The API surface is **not** the gap — that is already closed. Measured against the
published `@nielspeter/ts-archunit@0.61.0` `.d.ts`: 253 exports, of which **251
are present in eess-ts under the same name**, and eess-ts exports 311 in total.
The only two absent are `correspondence` / `CorrespondenceBuilder`, deliberately
renamed to `crossProject` / `CrossProjectBuilder`.

So a migration is genuinely small — which is exactly why leaving it undocumented
is the wrong trade. The work is a page, not an engine.

**The unanswered questions a switching user hits immediately**, none of which the
corpus answers today:

1. **The rename.** `correspondence()` → `crossProject()`. This is the one symbol
   that moved, and per [bug 0195](./0195-crossproject-ships-with-no-documentation.md)
   it is also the one with no documentation page — so the single thing a migrator
   must change is the single thing they cannot read about.
2. **Baselines.** `hashViolation` is `sha256(rule::subject)`. Does an existing
   ts-archunit baseline file still match under eess-ts, or must it be regenerated?
   For the renamed builder it provably must — the `rule` string changed from
   `correspondence [a <-> b]` to `crossProject [a <-> b]`. **For every other rule
   this is unverified and it is the question with the worst failure mode:** a
   silently-orphaned baseline entry stops suppressing and the build reds, or worse,
   a stale entry keeps suppressing something it no longer describes.
3. **The CLI binary name**, the config filename, and the scaffolded `package.json`
   scripts — do they change, and does `init` overwrite or collide with an existing
   ts-archunit setup?
4. **Presets.** Do preset names and their `overrides` keys carry over unchanged?

## Fix

Not decided. At minimum a `docs/migrating-from-ts-archunit.md`, reachable from
the sidebar and from `packages/ts/README.md`, that answers 1–4 **from
measurement** rather than assertion — the surface diff above is reproducible and
belongs in it.

Question 2 is the one to settle first, because it is the only one whose wrong
answer is silent.

## Verification

- [ ] The export-surface diff is reproduced by a script, not hand-typed, so the
      "251 of 253" claim cannot go stale (see the corpus's standing problem with
      hand-derived population counts — plan 0193).
- [ ] Baseline compatibility is **measured**: a real ts-archunit baseline is run
      against eess-ts and the result recorded, including which entries orphan.
- [ ] A ts-archunit project switches by following the page alone, with the gates
      green at the end.
- [ ] `docs/.vitepress` sidebar reaches the page.
