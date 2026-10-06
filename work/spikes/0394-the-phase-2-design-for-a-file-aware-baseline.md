# Spike 0394: the Phase 2 design for a file-aware baseline

Started 2026-10-06 for [plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)'s
Phase 2, as the second of its five records. Time box: one working day. It ends in a design brought
back to the maintainer for a decision, not in code.

## The question

The maintainer decided on 2026-10-06 that the baseline matcher checks the file each entry records
([bug 0388](../bugs/0388-a-baseline-entry-forgives-the-same-finding-in-any-file.md),
[spike 0390](./0390-a-or-e-where-the-file-enters-a-findings-identity.md)). Plan 0346 left five
questions open, and this spike answers them:

1. **Grouping.** Leave `disambiguateIdentities`' grouping as it is (E0), or group per file (E+).
2. **Every consumer keyed by hash alone.** Under per-file grouping each must be keyed by
   `(hash, file)`, or it changes meaning. This spike's first output is that list, read from the
   code.
3. **A baseline with no recorded root.** Turn the check off, match nothing, or compare against the
   rediscovered root.
4. **The diagnosis.** How it tells "fixed there, made here" from "copied" and "moved".
5. **Identity-bearing and metric findings that move file.**

## Census: what keys on the hash, the subject or the grouping

Read from the code on `main` at `b1335f5`.

**eess-ts baseline** (`packages/ts/src/helpers/baseline.ts`):

| #   | consumer                                            | where                                               | keyed by today     |
| --- | --------------------------------------------------- | --------------------------------------------------- | ------------------ |
| 1   | `isKnown`, the matcher                              | `Baseline.isKnown`                                  | hash               |
| 2   | `hasEntry`, read by both diagnostics below          | `Baseline.hasEntry`                                 | hash               |
| 3   | the accepted-measurement map, a metric's ceiling    | `acceptedMeasurements`, `isKnown`                   | hash               |
| 4   | the stale-measurement diagnosis                     | `acceptedMeasurements.get` in `Baseline`            | hash               |
| 5   | the description-change diagnosis (`renamedRuleFor`) | `knownSubjects`, `baseline-diagnostics.ts`          | subject hash       |
| 6   | the "matched nothing" diagnosis                     | `matched` count from `hasEntry`, `knownHashes.size` | hash               |
| 7   | the regenerate summary (`+N, −N`)                   | `generateBaseline`, `readPriorHashes`               | hash               |
| 8   | loading                                             | `withBaseline`                                      | hash, subject hash |

**Kernel baseline** (`packages/core/src/baseline.ts`), used by any dialect that baselines through
the kernel:

| #   | consumer                                    | keyed by today |
| --- | ------------------------------------------- | -------------- |
| 9   | `isKnown`                                   | hash           |
| 10  | the accepted-measurement map                | hash           |
| 11  | `generateBaseline` (no summary, no version) | hash           |

**Grouping and its readers:**

| #   | consumer                                                               | keyed by today    |
| --- | ---------------------------------------------------------------------- | ----------------- |
| 12  | `groupKeyOf` in `disambiguateIdentities` (eess-ts `applyFilters` only) | `rule::subject`   |
| 13  | `hasIdentityCollision`, the deferred-warning collision guard           | `rule::subject`   |
| 14  | `identityCollisions()`, the disclosure channel                         | `rule::subject`   |
| 15  | the kernel `applyFilters`, which sibling dialects use                  | no disambiguation |

**Above the baseline, keyed by subject:**

| #   | consumer                                                       | note                                                              |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| 16  | a deferred warning's `accepted` list (bug 0389's `isAccepted`) | raw or portable subject; a subject without a path carries no file |
| 17  | `check-all`, the CLI `check`, both `execute-rule` paths        | call `filterNew`; inherit 1                                       |
| 18  | the CLI `baseline` command                                     | prints 7                                                          |
| 19  | plan 0346's Phase 3 migration join                             | not built; joins on what 1 defines                                |

Two facts this list makes plain:

- **An `accepted` list has bug 0388's hole too.** A subject without a path (`element::message`)
  carries no file, so an entry for it forgives the same finding in another file, raw or portable.
  Bug 0389 did not change that; it is the same class as 0388 and belongs to this phase.
- **Sibling dialects never disambiguate** (15), so for them two findings with one subject in one
  file already share an entry. That is [plan 0188](../plans/0188-unify-the-duplicated-engine-modules.md)'s.

## Method

One worktree of `main` at `b1335f5`, its own `node_modules` built entry by entry with the
`@nielspeter/*` links copied as relative links, so it resolves its own kernel (proven: the kernel's
realpath is the worktree's `packages/core`, and its built `dist` carries the patch). One patch
(Appendix A) adds every variant behind environment switches, so all rows run on identical code:

- `SPIKE_VARIANT=main` — today's behaviour.
- `SPIKE_VARIANT=E0` — the matcher checks the file each entry records, in both baselines; an entry
  with no recorded file matches nothing; grouping unchanged.
- `SPIKE_VARIANT=EP` — E0, plus per-file grouping (`groupKeyOf` and `hasIdentityCollision` key on
  `rule::file::subject`), plus every census item re-keyed by `(hash, file)`: the accepted-measurement
  maps (3, 10), the regenerate summary (7) and the description-change diagnosis (5).
- `SPIKE_NOROOT=off|none|rediscover` — for a baseline that records no root: skip the file check,
  match nothing, or compare against the root rediscovered at load.

Both E variants also key the description-change diagnosis by `(subject, file)`, so its misattribution
is measured separately from grouping. The harness (Appendix B) runs each row through the public
baseline API on a real repository on disk (a `.git` directory and a named `package.json`), so root
discovery behaves as it does for an adopter. Each run of the harness took about 2 seconds.

## Results

| #   | row                                                               | `main`                                 | E0                                        | E+ (`EP`)                |
| --- | ----------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------ |
| 1   | six cross-file cases (fix `a`, the same finding in `b`)           | **0 of 6** reported                    | 6 of 6                                    | 6 of 6                   |
| 2   | unchanged code                                                    | nothing                                | nothing                                   | nothing                  |
| 3   | fix `a`, `b` was reviewed                                         | nothing                                | **`b` reported** + a note                 | nothing                  |
| 3   | add the same finding in an earlier-sorted file                    | **`b` reported, the new one forgiven** | all three reported + a note               | the new one only         |
| 4   | a metric ceiling that worsened, 3 → 9, identity without the file  | **forgiven**                           | **forgiven**                              | reported                 |
| 5   | a finding with an empty `file` against a file's entry             | **forgiven**                           | reported                                  | reported                 |
| 6   | regenerate summary, `a` stays and `b` duplicates it               | `+0`                                   | `+1`                                      | `+1`                     |
| 7   | an entry with no recorded file                                    | **forgives `b`**                       | reports `a` and `b`                       | reports `a` and `b`      |
| 8   | no recorded root, `off`                                           | —                                      | forgives `b` (as `main`)                  | forgives `b` (as `main`) |
| 8   | no recorded root, `none`                                          | —                                      | reports everything, even unchanged code   | same                     |
| 8   | no recorded root, `rediscover`                                    | —                                      | reports `b`, unchanged code clean         | same                     |
| 9   | a renamed file: a plain, an identity-bearing and a metric finding | all forgiven                           | all reported                              | all reported             |
| 12  | the note on the 0388 case                                         | none                                   | "matched nothing", advising to regenerate | same                     |
| 13  | an `accepted` list, cross-file                                    | **forgiven**                           | **forgiven**                              | **forgiven**             |
| 14  | the kernel baseline, cross-file                                   | **forgiven**                           | reported                                  | reported                 |

Rows 4, 5 and 7 use hand-built findings (no built-in producer reaches them); the rest use real
producers. In row 4, `main` and E0 forgive because two hand-built findings share a hash that real
producers would have suffixed apart; E+'s pair-keyed ceiling map reports it either way. Row 12's note is
the "matched nothing" diagnosis (census 6), which now fires instead of the description-change note:
its listed causes are upgrades, and its remedy is to regenerate, which forgives `b`.

**The diagnosis.** A prototype classifier (Appendix C) for a finding whose hash an entry holds, but
for another file, decides by three facts the baseline has: whether that entry's file still has its
finding in this run, and whether that file still exists on disk.

| case                             | the prototype says                   |
| -------------------------------- | ------------------------------------ |
| fixed in `a`, made in `b` (0388) | "fixed in `src/a/x.ts`, made here"   |
| `a` stays, `b` added (copied)    | "copied (still in `src/a/x.ts`)"     |
| `a` renamed to `z`               | "moved or renamed from `src/a/x.ts`" |

## What this answers

1. **Grouping: per file (E+).** E0 is never more lenient than `main`, but it false-reds both edit rows
   and keeps a metric ceiling keyed by hash. E+ is exact on both edit rows, and every row where
   per-file grouping could be greener (4, 6, and 12 before the diagnosis change) closes once that
   census item is keyed by `(hash, file)`. No row measured is greener under E+ than under `main`.
2. **Every consumer keyed by hash alone:** the census above. Items 1–7 and 9–11 change; 12–14 follow
   per-file grouping; 16 is not a hash consumer and needs its own change (below); 15 is plan 0188's.
3. **A baseline with no recorded root: rediscover.** `off` keeps bug 0388 open for those baselines
   (`main`'s behaviour), `none` reports even unchanged code, and `rediscover` is exact when the
   rediscovered root is the author's and fails closed when it is not. This is the maintainer's call,
   because it decides what an old baseline costs to keep.
4. **The diagnosis:** a finding matched by hash in another file gets its own attribution with the
   three causes above, each with its remedy (fix this one; re-accept the copy after review;
   regenerate and review the diff for a move). The "matched nothing" diagnosis must not count such a
   finding as unmatched. Measured on three rows; untested on a file that both moved and changed.
5. **Identity-bearing and metric findings that move file are reported again** (row 9), like plain
   ones. That fails closed, at the cost of one re-accept per moved finding.

Two things this spike found that the Phase 2 build must also carry:

- **An `accepted` list keeps bug 0388's hole** (row 13), under every variant. A subject without a
  path carries no file. The advice should print a file-qualified form (`<root:NAME>/path::subject`),
  matched alongside the raw subject, so new lists close the hole and lists written before keep
  today's behaviour. Designed, not measured.
- **Per-file grouping moves the entries today's code suffixed across files**, so it ships with plan
  0346's Phase 3 migration, joined on `(old hash, recorded file)`.

## Recommendation, for the maintainer to decide

**E+ with every census item re-keyed by `(hash, file)`, `rediscover` for a baseline with no recorded
root, the new attribution, and a file-qualified `accepted` form**, built as one change. Not measured
here: sibling dialects beyond the kernel baseline's matcher (they never disambiguate, plan 0188), a
real `git worktree` and Windows paths.

## Appendix A: the variant patch

Applied to `main` at `b1335f5` in the spike worktree.

```diff
diff --git a/packages/core/src/baseline.ts b/packages/core/src/baseline.ts
index 7a8811c..14d19e1 100644
--- a/packages/core/src/baseline.ts
+++ b/packages/core/src/baseline.ts
@@ -168,9 +168,22 @@ export function withBaseline(baselinePath: string): Baseline {
   const violations: unknown[] = parsed.violations
   const hashes = new Set<string>()
   const accepted = new Map<string, AcceptedMeasurement>()
+  const files = new Map<string, Set<string>>()
+  const acceptedByPair = new Map<string, AcceptedMeasurement>()
   for (const entry of violations) {
     if (entry && typeof entry === 'object' && 'hash' in entry && typeof entry.hash === 'string') {
       hashes.add(entry.hash)
+      // SPIKE 0394
+      if ('file' in entry && typeof entry.file === 'string') {
+        const set = files.get(entry.hash) ?? new Set<string>()
+        set.add(entry.file)
+        files.set(entry.hash, set)
+        if ('measured' in entry && typeof entry.measured === 'number')
+          acceptedByPair.set(entry.hash + '\u0000' + entry.file, {
+            value: entry.measured,
+            unit: 'measuredUnit' in entry && typeof entry.measuredUnit === 'string' ? entry.measuredUnit : undefined,
+          })
+      }
       if ('measured' in entry && typeof entry.measured === 'number') {
         accepted.set(entry.hash, {
           value: entry.measured,
@@ -183,7 +196,7 @@ export function withBaseline(baselinePath: string): Baseline {
     }
   }

-  return new Baseline(hashes, baselineDir, root, accepted)
+  return new Baseline(hashes, baselineDir, root, accepted, files, acceptedByPair)
 }

 /**
@@ -240,8 +253,19 @@ export class Baseline {
     private readonly root?: string,
     /** hash -> accepted measurement, for metric findings. */
     private readonly accepted: Map<string, AcceptedMeasurement> = new Map(),
+    private readonly spikeFiles?: Map<string, Set<string>>,
+    private readonly spikeAcceptedByPair?: Map<string, AcceptedMeasurement>,
   ) {}

+  /** SPIKE 0394 */
+  private fileOk(v: ArchViolation, hash: string): boolean {
+    const variant = process.env.SPIKE_VARIANT ?? 'main'
+    if (variant === 'main' || this.spikeFiles === undefined) return true
+    const recorded = this.spikeFiles.get(hash)
+    if (recorded === undefined) return false
+    return recorded.has(toRelativePath(v.file, this.baselineDir))
+  }
+
   /**
    * Check if a violation is known (exists in the baseline).
    * Known violations are filtered out — they don't cause failures.
@@ -258,8 +282,12 @@ export class Baseline {
    */
   isKnown(violation: ArchViolation): boolean {
     const hash = hashViolation(violation, this.root)
+    if (!this.fileOk(violation, hash)) return false
     if (violation.measured === undefined) return this.knownHashes.has(hash)
-    const acceptedMeasurement = this.accepted.get(hash)
+    const acceptedMeasurement =
+      process.env.SPIKE_VARIANT === 'EP' && this.spikeAcceptedByPair !== undefined
+        ? this.spikeAcceptedByPair.get(hash + '\u0000' + toRelativePath(violation.file, this.baselineDir))
+        : this.accepted.get(hash)
     if (acceptedMeasurement === undefined) return false
     // Bug 0171: `<=` means nothing until both numbers count the same thing.
     if (!measurementComparable(acceptedMeasurement.unit, violation.measuredUnit)) return false
diff --git a/packages/core/src/violation.ts b/packages/core/src/violation.ts
index 4d46ede..5eaadba 100644
--- a/packages/core/src/violation.ts
+++ b/packages/core/src/violation.ts
@@ -260,6 +260,8 @@ export function portableSubjectOf(violation: ArchViolation, root?: string): stri
  * subject across their two rule strings would have moved a published entry.
  */
 function groupKeyOf(violation: ArchViolation): string {
+  // SPIKE 0394
+  if (process.env.SPIKE_VARIANT === 'EP') return `${violation.rule}::${violation.file}::${subjectOf(violation)}`
   return `${violation.rule}::${subjectOf(violation)}`
 }

diff --git a/packages/ts/src/core/terminal-builder.ts b/packages/ts/src/core/terminal-builder.ts
index fbed92a..b66acbc 100644
--- a/packages/ts/src/core/terminal-builder.ts
+++ b/packages/ts/src/core/terminal-builder.ts
@@ -94,7 +94,7 @@ export type { CollectResult }
 function hasIdentityCollision(violations: readonly ArchViolation[]): boolean {
   const seen = new Set<string>()
   for (const v of violations) {
-    const key = `${v.rule}::${subjectOf(v)}`
+    const key = process.env.SPIKE_VARIANT === 'EP' ? `${v.rule}::${v.file}::${subjectOf(v)}` : `${v.rule}::${subjectOf(v)}`
     if (seen.has(key)) return true
     seen.add(key)
   }
diff --git a/packages/ts/src/helpers/baseline-diagnostics.ts b/packages/ts/src/helpers/baseline-diagnostics.ts
index 1149b72..4fbf834 100644
--- a/packages/ts/src/helpers/baseline-diagnostics.ts
+++ b/packages/ts/src/helpers/baseline-diagnostics.ts
@@ -21,6 +21,8 @@ export interface BaselineFacts {
   readonly hashVersion: number
   isKnown(violation: ArchViolation): boolean
   hasEntry(violation: ArchViolation): boolean
+  /** SPIKE 0394 */
+  spikeSubjectByFile?(violation: ArchViolation, subjectHash: string): string | undefined
 }

 /**
@@ -60,7 +62,11 @@ function renamedRuleFor(ctx: BaselineFacts, violation: ArchViolation): string |
   // this the ratchet's own working case reported "1 rule whose description
   // changed", which is a false cause under ADR-009 rule 2.
   if (ctx.hasEntry(violation)) return undefined
-  return ctx.knownSubjects.get(hashSubject(violation, ctx.root))
+  const subjectHash = hashSubject(violation, ctx.root)
+  // SPIKE 0394: the description changed only if this finding's own file recorded the subject.
+  if (process.env.SPIKE_VARIANT !== undefined && process.env.SPIKE_VARIANT !== 'main')
+    return ctx.spikeSubjectByFile?.(violation, subjectHash)
+  return ctx.knownSubjects.get(subjectHash)
 }

 export function descriptionChangeFinding(
diff --git a/packages/ts/src/helpers/baseline.ts b/packages/ts/src/helpers/baseline.ts
index ca35e2d..02cd5b4 100644
--- a/packages/ts/src/helpers/baseline.ts
+++ b/packages/ts/src/helpers/baseline.ts
@@ -343,6 +343,13 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
       : undefined
   const effectiveRoot = options.root !== undefined ? root : (recordedRoot ?? root)
   const hashes = new Set<string>()
+  // SPIKE 0394
+  const spike: SpikeIndex = {
+    files: new Map(),
+    subjectsByFile: new Map(),
+    acceptedByPair: new Map(),
+    rootRecorded: recordedRoot !== undefined || options.root !== undefined,
+  }
   // subject hash -> the rule description recorded for it. Only what the
   // description-change diagnosis needs, so a large baseline does not carry a
   // second copy of every entry. Entries written before 0.24.0 have no subject
@@ -357,7 +364,21 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
   const rawEntries: readonly unknown[] = parsed.violations
   for (const entry of rawEntries) {
     if (entry === null || typeof entry !== 'object') continue
-    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
+    if ('hash' in entry && typeof entry.hash === 'string') {
+      hashes.add(entry.hash)
+      if ('file' in entry && typeof entry.file === 'string') {
+        const set = spike.files.get(entry.hash) ?? new Set<string>()
+        set.add(entry.file)
+        spike.files.set(entry.hash, set)
+        if ('subject' in entry && typeof entry.subject === 'string' && 'rule' in entry && typeof entry.rule === 'string')
+          spike.subjectsByFile.set(entry.subject + '\u0000' + entry.file, entry.rule)
+        if ('measured' in entry && typeof entry.measured === 'number')
+          spike.acceptedByPair.set(entry.hash + '\u0000' + entry.file, {
+            value: entry.measured,
+            unit: 'measuredUnit' in entry && typeof entry.measuredUnit === 'string' ? entry.measuredUnit : undefined,
+          })
+      }
+    }
     if (
       'subject' in entry &&
       typeof entry.subject === 'string' &&
@@ -388,9 +409,19 @@ export function withBaseline(baselinePath: string, options: BaselineOptions = {}
     }
   }

-  return new Baseline(hashes, effectiveRoot, hashVersion, resolved, subjects, accepted)
+  return new Baseline(hashes, effectiveRoot, hashVersion, resolved, subjects, accepted, spike)
 }

+// SPIKE 0394
+export interface SpikeIndex {
+  files: Map<string, Set<string>>
+  subjectsByFile: Map<string, string>
+  acceptedByPair: Map<string, AcceptedMeasurement>
+  rootRecorded: boolean
+}
+export const spikeVariant = (): string => process.env.SPIKE_VARIANT ?? 'main'
+
+
 /**
  * Generate a baseline file from a list of violations.
  *
@@ -446,7 +477,9 @@ export function generateBaseline(
   fs.mkdirSync(path.dirname(resolved), { recursive: true })
   fs.writeFileSync(resolved, JSON.stringify(baseline, null, 2) + '\n')

-  const written = new Set(entries.map((e) => e.hash))
+  const keyOf = (e: { hash: string; file: string }): string =>
+    spikeVariant() === 'main' ? e.hash : e.hash + '\u0000' + e.file
+  const written = new Set(entries.map((e) => keyOf(e)))
   return {
     before: prior?.count,
     after: entries.length,
@@ -516,7 +549,12 @@ function readPriorHashes(resolved: string):
   const hashes = new Set<string>()
   for (const entry of rawEntries) {
     if (entry === null || typeof entry !== 'object') continue
-    if ('hash' in entry && typeof entry.hash === 'string') hashes.add(entry.hash)
+    if ('hash' in entry && typeof entry.hash === 'string')
+      hashes.add(
+        spikeVariant() !== 'main' && 'file' in entry && typeof entry.file === 'string'
+          ? entry.hash + '\u0000' + entry.file
+          : entry.hash,
+      )
   }
   // `count` is the entry count, not `hashes.size`: two entries can share a hash
   // (bug 0028, measured at 17% in this repo), and reporting the deduplicated
@@ -633,8 +671,27 @@ export class Baseline {
      * shipped, where equality of identity remains the right test.
      */
     private readonly acceptedMeasurements: ReadonlyMap<string, AcceptedMeasurement> = new Map(),
+    private readonly spike?: SpikeIndex,
   ) {}

+  /** SPIKE 0394: the finding's file as recorded, root-relative. */
+  private spikeFile(v: ArchViolation): string {
+    return toPortablePath(v.file, this.root)
+  }
+
+  /** SPIKE 0394: does an entry for this hash record this finding's file? */
+  private fileOk(v: ArchViolation, hash: string): boolean {
+    if (spikeVariant() === 'main' || this.spike === undefined) return true
+    if (!this.spike.rootRecorded) {
+      const mode = process.env.SPIKE_NOROOT ?? 'rediscover'
+      if (mode === 'off') return true
+      if (mode === 'none') return false
+    }
+    const recorded = this.spike.files.get(hash)
+    if (recorded === undefined) return false
+    return recorded.has(this.spikeFile(v))
+  }
+
   /**
    * Check if a violation is known (exists in the baseline).
    * Known violations are filtered out — they don't cause failures.
@@ -647,7 +704,8 @@ export class Baseline {
    * entry and is not known.
    */
   hasEntry(violation: ArchViolation): boolean {
-    return this.knownHashes.has(hashViolation(violation, this.root))
+    const hash = hashViolation(violation, this.root)
+    return this.knownHashes.has(hash) && this.fileOk(violation, hash)
   }

   /**
@@ -661,6 +719,7 @@ export class Baseline {
   isKnown(violation: ArchViolation): boolean {
     const hash = hashViolation(violation, this.root)
     if (!this.knownHashes.has(hash)) return false
+    if (!this.fileOk(violation, hash)) return false

     // Bug 0012: a metric finding is known only while it is **no worse** than
     // what was accepted. Identity answers "is this the same finding?"; a metric
@@ -672,7 +731,10 @@ export class Baseline {
     // so it stays accepted until the baseline is regenerated. Treating a
     // missing value as 0 would fail every metric finding in an older baseline
     // and call it a regression.
-    const accepted = this.acceptedMeasurements.get(hash)
+    const accepted =
+      spikeVariant() === 'EP' && this.spike !== undefined
+        ? this.spike.acceptedByPair.get(hash + '\u0000' + this.spikeFile(violation))
+        : this.acceptedMeasurements.get(hash)
     if (violation.measured === undefined || accepted === undefined) return true

     // Bug 0171: the entry's number and this run's number must count the same
@@ -702,6 +764,10 @@ export class Baseline {
       hashVersion: this.hashVersion,
       isKnown: (violation) => this.isKnown(violation),
       hasEntry: (violation) => this.hasEntry(violation),
+      spikeSubjectByFile: (violation, subjectHash) =>
+        spikeVariant() === 'main' || this.spike === undefined
+          ? undefined
+          : this.spike.subjectsByFile.get(subjectHash + '\u0000' + this.spikeFile(violation)),
     }
   }

```

## Appendix B: the harness

Run from `packages/ts` of the patched worktree, with `SPIKE_VARIANT` and `PROBE_OUT` set.

```ts
// Spike 0394 harness. Run with SPIKE_VARIANT=main|E0|EP (and SPIKE_NOROOT for the no-root rows).
import { describe, it, expect, afterAll } from 'vitest'
import {
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { modules, classes, functions } from '../../src/index.js'
import { generateBaseline, withBaseline } from '../../src/helpers/baseline.js'
import { generateBaseline as kernelGenerate, withBaseline as kernelWith } from '@nielspeter/eess'
import { subjectOf } from '@nielspeter/eess/internal'
import { notHaveDefaultExport } from '../../src/conditions/exports.js'
import { moduleContain } from '../../src/conditions/body-analysis-module.js'
import { beImported, onlyBeImportedVia } from '../../src/conditions/reverse-dependency.js'
import { call } from '../../src/helpers/matchers.js'
import type { ArchViolation } from '@nielspeter/eess'
import type { ArchProject } from '../../src/core/project.js'

const OUT = process.env.PROBE_OUT ?? '/dev/null'
const V = process.env.SPIKE_VARIANT ?? 'main'
const log = (row: string, value: unknown) =>
  appendFileSync(OUT, `${V}\t${row}\t${JSON.stringify(value)}\n`)
const dirs: string[] = []
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))
function repo(): string {
  const r = mkdtempSync(path.join(tmpdir(), 's0394-'))
  dirs.push(r)
  mkdirSync(path.join(r, '.git'))
  writeFileSync(path.join(r, 'package.json'), '{"name":"acme"}')
  return r
}
function project(r: string, files: Record<string, string>): ArchProject {
  const tsm = new Project({ useInMemoryFileSystem: true })
  for (const [f, t] of Object.entries(files)) tsm.createSourceFile(path.join(r, f), t)
  return {
    tsConfigPath: path.join(r, 'tsconfig.json'),
    _project: tsm,
    getSourceFiles: () => tsm.getSourceFiles(),
  }
}
const rel = (r: string, vs: readonly ArchViolation[]) =>
  vs.filter((v) => v.file !== '').map((v) => path.relative(r, v.file))
const meta = (vs: readonly ArchViolation[]) =>
  vs.filter((v) => v.file === '').map((v) => v.message.slice(0, 50))
function roundTrip(
  r: string,
  before: readonly ArchViolation[],
  after: readonly ArchViolation[],
  tweak?: (j: any) => void,
) {
  const f = path.join(r, 'baseline.json')
  generateBaseline([...before], f)
  if (tweak) {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    tweak(j)
    writeFileSync(f, JSON.stringify(j))
  }
  return withBaseline(f).filterNew([...after])
}

type Rule = (p: ArchProject) => readonly ArchViolation[]
const BAD = 'function handle() {}\n',
  OK = 'export function handle() {}\n'
const exported: Rule = (p) =>
  functions(p)
    .that()
    .resideInFolder('**/src/**')
    .should()
    .beExported()
    .rule({ id: 'r' })
    .violations()
const cases: [string, Rule, Record<string, string>, Record<string, string>][] = [
  [
    'notHaveDefaultExport',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(notHaveDefaultExport())
        .rule({ id: 'r' })
        .violations(),
    { 'src/a/index.ts': 'export default 1\n', 'src/b/index.ts': 'export const b = 1\n' },
    { 'src/a/index.ts': 'export const a = 1\n', 'src/b/index.ts': 'export default 1\n' },
  ],
  [
    'moduleContain',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(moduleContain(call('init')))
        .rule({ id: 'r' })
        .violations(),
    { 'src/a/index.ts': 'export const a = 1\n', 'src/b/index.ts': 'init()\n' },
    { 'src/a/index.ts': 'init()\n', 'src/b/index.ts': 'export const b = 1\n' },
  ],
  [
    'beImported',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(beImported())
        .rule({ id: 'r' })
        .violations(),
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': "import { c } from '../c'\nexport const b = c\n",
      'src/c.ts': "import { b } from './b/index'\nexport const c = typeof b\n",
    },
    {
      'src/a/index.ts': "import { c } from '../c'\nexport const a = c\n",
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { a } from './a/index'\nexport const c = typeof a\n",
    },
  ],
  [
    'onlyBeImportedVia',
    (p) =>
      modules(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .satisfy(onlyBeImportedVia('**/nowhere/**'))
        .rule({ id: 'r' })
        .violations(),
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { a } from './a/index'\nexport const c = a\n",
    },
    {
      'src/a/index.ts': 'export const a = 1\n',
      'src/b/index.ts': 'export const b = 1\n',
      'src/c.ts': "import { b } from './b/index'\nexport const c = b\n",
    },
  ],
  [
    'classes extend',
    (p) =>
      classes(p)
        .that()
        .resideInFolder('**/src/**')
        .should()
        .extend('Base')
        .rule({ id: 'r' })
        .violations(),
    {
      'src/base.ts': 'export class Base {}\n',
      'src/a/svc.ts': 'export class Svc {}\n',
      'src/b/svc.ts': "import { Base } from '../base'\nexport class Svc extends Base {}\n",
    },
    {
      'src/base.ts': 'export class Base {}\n',
      'src/a/svc.ts': "import { Base } from '../base'\nexport class Svc extends Base {}\n",
      'src/b/svc.ts': 'export class Svc {}\n',
    },
  ],
  [
    'functions beExported',
    exported,
    { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
    { 'src/a/x.ts': OK, 'src/b/x.ts': BAD },
  ],
]

// Hand-built findings for shapes no built-in producer reaches.
const finding = (r: string, file: string, extra: Partial<ArchViolation> = {}): ArchViolation => ({
  rule: 'm',
  element: 'Big',
  file: file === '' ? '' : path.join(r, file),
  line: 1,
  message: 'Big is too big',
  ...extra,
})

describe('spike 0394', () => {
  it('1 cross-file cases: b reported', () => {
    const got: Record<string, boolean> = {}
    for (const [name, rule, r1, r2] of cases) {
      const r = repo()
      const fresh = roundTrip(r, rule(project(r, r1)), rule(project(r, r2)))
      got[name] = rel(r, fresh).some((f) => f.includes('b/'))
    }
    log('1-cross-file-b-reported', got)
    expect(true).toBe(true)
  })
  it('2 unchanged code', () => {
    const r = repo()
    const p = project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD })
    log('2-unchanged-new', rel(r, roundTrip(r, exported(p), exported(p))))
    expect(true).toBe(true)
  })
  it('3 edits to duplicates', () => {
    const r = repo()
    const base = { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD }
    const fixA = roundTrip(
      r,
      exported(project(r, base)),
      exported(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD })),
    )
    log('3a-fix-a-b-reviewed', { real: rel(r, fixA), meta: meta(fixA) })
    const r2 = repo()
    const ins = roundTrip(
      r2,
      exported(project(r2, base)),
      exported(project(r2, { 'src/0/x.ts': BAD, ...base })),
    )
    log('3b-insert-earlier-duplicate', { real: rel(r2, ins), meta: meta(ins) })
    expect(true).toBe(true)
  })
  it('4 metric ceiling, identity without the file', () => {
    const r = repo()
    const m = { identity: 'M::Big', measured: 3, measuredUnit: 'methods' }
    const before = [finding(r, 'src/a.ts', m), finding(r, 'src/b.ts', { ...m, measured: 10 })]
    const after = [
      finding(r, 'src/a.ts', { ...m, measured: 9 }),
      finding(r, 'src/b.ts', { ...m, measured: 10 }),
    ]
    log('4-a-worsened-3-to-9-reported', rel(r, roundTrip(r, before, after)))
    expect(true).toBe(true)
  })
  it('5 an empty-file finding against a baselined file finding', () => {
    const r = repo()
    log(
      '5-empty-file-reported',
      roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/a.ts'), finding(r, '')]).filter(
        (v) => v.message === 'Big is too big',
      ).length,
    )
    expect(true).toBe(true)
  })
  it('6 regenerate summary, a stays and b duplicates it', () => {
    const r = repo()
    const f = path.join(r, 'baseline.json')
    generateBaseline([finding(r, 'src/a.ts')], f)
    const d = generateBaseline([finding(r, 'src/a.ts'), finding(r, 'src/b.ts')], f)
    log('6-regenerate-added', d.added)
    expect(true).toBe(true)
  })
  it('7 an entry with no recorded file', () => {
    const r = repo()
    const fresh = roundTrip(
      r,
      [finding(r, 'src/a.ts')],
      [finding(r, 'src/a.ts'), finding(r, 'src/b.ts')],
      (j) => j.violations.forEach((e: any) => delete e.file),
    )
    log('7-no-file-entry-reported', rel(r, fresh))
    expect(true).toBe(true)
  })
  it('8 a baseline with no recorded root', () => {
    const r = repo()
    const strip = (j: any) => delete j.root
    const added = roundTrip(
      r,
      [finding(r, 'src/a.ts')],
      [finding(r, 'src/a.ts'), finding(r, 'src/b.ts')],
      strip,
    )
    const same = roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/a.ts')], strip)
    log(`8-no-root[${process.env.SPIKE_NOROOT ?? 'rediscover'}]`, {
      aStaysBAdded: rel(r, added),
      unchanged: rel(r, same),
    })
    expect(true).toBe(true)
  })
  it('9-11 renames', () => {
    const r = repo()
    const plain = roundTrip(r, [finding(r, 'src/a.ts')], [finding(r, 'src/z.ts')])
    const idBearing = roundTrip(
      r,
      [finding(r, 'src/a.ts', { identity: 'X' })],
      [finding(r, 'src/z.ts', { identity: 'X' })],
    )
    const m = { identity: 'M::Big', measured: 3, measuredUnit: 'methods' }
    const metric = roundTrip(r, [finding(r, 'src/a.ts', m)], [finding(r, 'src/z.ts', m)])
    log('9-11-rename-reported', {
      plain: rel(r, plain),
      identityBearing: rel(r, idBearing),
      metric: rel(r, metric),
    })
    expect(true).toBe(true)
  })
  it('12 the diagnosis on the 0388 case', () => {
    const r = repo()
    const fresh = roundTrip(
      r,
      exported(project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': OK })),
      exported(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD })),
    )
    log('12-meta', meta(fresh))
    expect(true).toBe(true)
  })
  it('13 an accepted list, cross-file', () => {
    const r = repo()
    const accepted = exported(project(r, { 'src/a/x.ts': BAD, 'src/b/x.ts': OK })).map((v) =>
      subjectOf(v),
    )
    const sev = functions(project(r, { 'src/a/x.ts': OK, 'src/b/x.ts': BAD }))
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
      .rule({ id: 'r' })
      .asSeverity('warn', { accepted })
      .violations()
      .map((v) => v.severity)
    log('13-accepted-b-severity', sev)
    expect(true).toBe(true)
  })
  it('14 the kernel baseline, cross-file', () => {
    const r = repo()
    const f = path.join(r, 'k.json')
    kernelGenerate([finding(r, 'src/a.ts')], f)
    log('14-kernel-b-reported', rel(r, kernelWith(f).filterNew([finding(r, 'src/b.ts')])))
    expect(true).toBe(true)
  })
})
```

## Appendix C: the attribution prototype

```ts
// Spike 0394: a classifier for a finding whose hash an entry holds but for another file.
import { it } from 'vitest'
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Project } from 'ts-morph'
import { functions } from '../../src/index.js'
import { generateBaseline, hashViolation } from '../../src/helpers/baseline.js'
import type { ArchViolation } from '@nielspeter/eess'

type Entry = { hash: string; file: string }
/** For each finding not matched on (hash, file): which cause, decided from the entries, the run and the disk. */
function classify(
  root: string,
  entries: Entry[],
  findings: ArchViolation[],
): Record<string, string> {
  const out: Record<string, string> = {}
  const runKeys = new Set(
    findings.map((v) => hashViolation(v, root) + '\0' + path.relative(root, v.file)),
  )
  for (const v of findings) {
    const hash = hashViolation(v, root)
    const file = path.relative(root, v.file)
    if (entries.some((e) => e.hash === hash && e.file === file)) continue
    const elsewhere = entries.filter((e) => e.hash === hash && e.file !== file)
    if (elsewhere.length === 0) {
      out[file] = 'new'
      continue
    }
    const causes = elsewhere.map((e) =>
      runKeys.has(e.hash + '\0' + e.file)
        ? `copied (still in ${e.file})`
        : existsSync(path.join(root, e.file))
          ? `fixed in ${e.file}, made here`
          : `moved or renamed from ${e.file}`,
    )
    out[file] = causes.join('; ')
  }
  return out
}
function repoWith(files: Record<string, string>): string {
  const r = mkdtempSync(path.join(tmpdir(), 'a-'))
  mkdirSync(path.join(r, '.git'))
  writeFileSync(path.join(r, 'package.json'), '{"name":"acme"}')
  for (const [f, c] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(r, f)), { recursive: true })
    writeFileSync(path.join(r, f), c)
  }
  return r
}
const run = (r: string, files: Record<string, string>) => {
  const t = new Project({ useInMemoryFileSystem: true })
  for (const [f, c] of Object.entries(files)) t.createSourceFile(path.join(r, f), c)
  return [
    ...functions({
      tsConfigPath: path.join(r, 'tsconfig.json'),
      _project: t,
      getSourceFiles: () => t.getSourceFiles(),
    })
      .that()
      .resideInFolder('**/src/**')
      .should()
      .beExported()
      .rule({ id: 'r' })
      .violations(),
  ]
}
const BAD = 'function handle() {}\n',
  OK = 'export function handle() {}\n'
it('classify', () => {
  const rows: [string, Record<string, string>, Record<string, string>][] = [
    [
      '0388: fixed in a, made in b',
      { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
      { 'src/a/x.ts': OK, 'src/b/x.ts': BAD },
    ],
    [
      'copied: a stays, b added',
      { 'src/a/x.ts': BAD, 'src/b/x.ts': OK },
      { 'src/a/x.ts': BAD, 'src/b/x.ts': BAD },
    ],
    ['renamed: a moved to z', { 'src/a/x.ts': BAD }, { 'src/z/x.ts': BAD }],
  ]
  for (const [name, before, after] of rows) {
    const r = repoWith(after)
    const f = path.join(r, 'b.json')
    generateBaseline(run(r, before), f)
    const entries: Entry[] = JSON.parse(readFileSync(f, 'utf8')).violations
    appendFileSync(
      process.env.PROBE_OUT!,
      `${name}\t${JSON.stringify(classify(r, entries, run(r, after)))}\n`,
    )
    rmSync(r, { recursive: true, force: true })
  }
})
```
