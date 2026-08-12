# Bug 0123: `eess-crossvalidate` publishes seven subpaths and documents four — `./files` ships with no way to discover it

## Status

- **State:** Draft — enumerated against `package.json` and the shipped README;
  no red test yet.
- **Severity:** Medium — no false green and nothing broken at runtime. It is a
  capability an adopter cannot find, which reads exactly like a missing feature.
- **Origin:** self-found · customer review of [0106](./fixed/0106-no-gate-requires-a-changeset.md)'s
  fix, which named it as the second instance of the same lag 0106 filed
- **Reported:** 2026-08-12

## Symptom

`packages/crossvalidate/package.json` declares seven `exports` subpaths.
`packages/crossvalidate/README.md` — the only documentation that ships, per
`"files": ["dist", "README.md", "LICENSE"]` — has a section for four:

| subpath           | README section |
| ----------------- | -------------- |
| `./mermaid-ts`    | yes            |
| `./md-ts`         | yes            |
| `./md-gherkin`    | yes            |
| `./gherkin-ts`    | yes            |
| `./md-mermaid`    | **no**         |
| `./md-mermaid-er` | **no**         |
| `./files`         | **no**         |

The reverse direction is clean — every README section names a real subpath — so
this is one-way drift.

`./files` is the one that stings. It is a building block for writing your own
correspondences (`files()` returns a `Selection<FileEntry>` for one side of a
`correspondence()`), and the only way to learn it exists is to open
`node_modules/@nielspeter/eess-crossvalidate/package.json`. This repo's own
`spec.rules.ts` uses it, and the release gate built in 0106 wanted it.

## Root cause

Same lag 0106 filed, one artifact over: a subpath and its documentation land in
different commits, and nothing binds them. 0106's symptom section already names
an instance — `./md-gherkin` shipped in `0.1.2` while the README section
documenting it landed later — and nothing was gated for it then.

## Why it matters

The family's premise is that documentation which is not checked drifts. A
package README is the first thing an adopter reads and the only doc that travels
with the package. An undocumented export is indistinguishable from an absent one,
which is precisely the inference that produced 0106.

It is also a claim this repo can check in its own dialect and does not, which is
the finding rather than the exception.

## Fix

Two parts.

1. **Document the three missing subpaths** in
   `packages/crossvalidate/README.md`.
2. **Gate it.** A `correspondence()` of the shape `spec.rules.ts` already runs
   over the root README's Packages table: the `exports` keys of each
   `packages/*/package.json` ↔ the sections of that package's README, both
   directions, with per-side `suggest`. Every dialect gets it for free, not just
   crossvalidate.

Adjacent and distinct, from [0092](./0092-integrity-gate-misses-three-packages.md)
and noted in 0106: assert that every `exports` subpath resolves to a file the
`files` field will actually publish. That is the _file-existence_ claim; this is
the _documented_ claim. Both are worth having; only the second would have caught
this.

## Verification

- [ ] Red test written first: removing a README section for a live subpath fails
      the gate, and adding an `exports` entry with no section fails it. Passes
      today.
- [ ] The reverse direction fires: a README section for a subpath that does not
      exist is reported.
- [ ] The three missing sections are written, and the gate is green because the
      drift is gone rather than because the rule is scoped around it.
- [ ] A non-vacuity fixture and gate row.
- [ ] `npm run validate` green.

Deferred: none.
