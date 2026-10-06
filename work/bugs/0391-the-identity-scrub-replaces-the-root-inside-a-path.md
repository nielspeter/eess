# Bug 0391: the identity scrub replaces the root inside a path

## Status

- **State:** Draft — the scrub function measured with the built kernel on 2026-10-06; the
  baseline false green below is inferred from it, not reproduced end to end. No red test yet.
- **Severity:** High — **two different findings can share one baseline hash.** The scrub that makes
  a finding's identity portable replaces the identity root wherever its text appears, not only as
  a path prefix. A baseline entry for one finding then forgives a different one.
- **Origin:** enforcement review of the bug 0389 fix, 2026-10-06. The defect predates 0389: the
  baseline hash has used this scrub since ts-archunit's bug 0010 (folded into this repo). Bug
  0389's `accepted` comparison does not: it replaces whole path tokens instead (spike 0392).
- **Reported:** 2026-10-06

## Symptom

`normalizeIdentityText(text, root)` (`packages/core/src/identity-root.ts:156-166`) does
`text.replaceAll(root, '<root>')` and then folds `<root>/` into `<root>`. Measured with the built
kernel:

| text                              | root           | scrubbed                    |
| --------------------------------- | -------------- | --------------------------- |
| `/app/src/app/user.ts::m`         | `/app`         | `<root>src<root>user.ts::m` |
| `/app/src/appuser.ts::m`          | `/app`         | `<root>src<root>user.ts::m` |
| `/w/repo/src/a.ts::m`             | `/w/repo`      | `<root>src/a.ts::m`         |
| `/w/reposrc/a.ts::m`              | `/w/repo`      | `<root>src/a.ts::m`         |
| `/home/me/app/src/app/user.ts::m` | `/home/me/app` | `<root>src/app/user.ts::m`  |

- **The false green.** The first two rows are different files with the same scrubbed identity. A
  checkout at `/app`, the usual Docker `WORKDIR`, with a `src/app/` folder reaches it. The
  baseline hash uses this text. (Bug 0389's `accepted` comparison replaces whole path tokens, so
  it keeps these two apart.)
- **Portability breaks too.** The same file scrubs one way under `/app` and another under
  `/home/me/app`. A baseline written in a container matches nothing on a laptop. That direction
  fails closed.

## Root cause

The root is replaced as a bare substring, wherever it occurs. The checkout path is an occurrence
that a separator or the end of a token follows; `/app` inside `src/app/user.ts` is followed by
`/user.ts` too, so the right-hand boundary alone does not separate them, and the left one cannot
be required: producers write paths into prose messages, after a space (`file /w/repo/src/a.ts
imports x` must still scrub).

## Fix

Not decided here: neither boundary alone distinguishes the checkout path from a path segment that
spells it, as Root cause shows. Candidates are scrubbing only the first occurrence in each path
token, or scrubbing the `file` field rather than free text. Spike 0392 measured whole-token
replacement for bug 0389's `accepted` comparison; it is a candidate here too, with the same cost:
it leaves a path written inside prose unscrubbed, so such a subject would stop being portable. Enforcement review of the 0389 fix
measured that requiring a left delimiter would stop scrubbing paths inside prose messages, which
regresses portability. Any change here moves the hash of every entry
whose text contained the root inside a path, so it needs the migration treatment plan 0346
describes, and a `HASH_VERSION` decision.

## Verification

- [ ] a red test through the public baseline: two findings whose paths contain the root as a
      segment are distinct entries
- [ ] the same file scrubs the same under `/app` and under `/home/me/app`
- [ ] `npm run validate` green.

Deferred: none.
