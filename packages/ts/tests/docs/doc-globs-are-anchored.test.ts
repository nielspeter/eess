/**
 * A glob in a documented example has to work.
 *
 * Plan 0069's R2b. The existing `scan-markdown.ts` is per-line regex over symbol
 * names; the invariant R2b adds is **glob syntax** — anchored, no `./` segment —
 * and the plan warned it "reds three legitimate patterns" and was "real work of
 * unpredictable size".
 *
 * Measured, the size is predictable once the population is derived correctly:
 *
 *     glob-ish literals matched by line-regex over fences   467   <- the naive population
 *       of which "unanchored"                               224   <- almost all FALSE
 *
 *     string args to path-glob APIs, found by PARSING       132   <- the real population
 *       anchored                                           123
 *       dot-segment                                          0
 *       unanchored                                           9
 *     string args to import-target APIs                      31   <- exempt, see below
 *
 * The 224 are things like `'@nielspeter/eess-ts'`, `'preset/agent/no-copy-paste'`
 * and `') // matches console.log('` — import specifiers, rule ids, and fragments the
 * regex mis-sliced. **A literal is a path glob only because of which API it is an
 * argument to**, which a line-regex cannot know and a parser can. That is the whole
 * design, and it is why this parses each fence with ts-morph.
 *
 * ## What it found
 *
 * One real bug, in the worst possible place. `docs/running-in-tests.md` taught:
 *
 *     it('every architecture rule asserts something', () => {
 *       const rules = [
 *         modules(p).that().resideInFolder('src/domain/**').should()…,
 *       ]
 *       expect(diagnose(rules)).toEqual([])
 *     })
 *
 * Measured: `resideInFolder('src/core/**')` selects **0** modules where
 * `'**\/src/core/**'` selects **40**, and `diagnose()` on that rule returns **1**
 * finding — so the documented example that teaches you to check your rules enforce
 * something **fails its own assertion**. Fixed by anchoring it.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Node, Project, SyntaxKind } from 'ts-morph'
import { docsDir, packageRoot } from '../roots.js'

/**
 * APIs whose string arguments are matched against an **absolute** path, so an
 * unanchored glob cannot match and the example is dead as written.
 *
 * **Empty since v0.35.0** (plan 0067 part C). It held `resideInFile`,
 * `resideInFolder` and `havePathMatching`, and those three now resolve an
 * unanchored glob against the project root — so an unanchored example is
 * correct, and the narrower spelling of the two. The set is kept rather than
 * deleted because the classification is the mechanism here: a new API matched
 * against absolute paths belongs in it, and an empty set states that none
 * currently is.
 */
const ANCHORING_REQUIRED = new Set<string>([])

/**
 * APIs that accept a project-relative glob **by design**, so unanchored is correct.
 *
 * `slices().matching()` resolves every spelling of the same intent — v0.18.1's fix.
 * Measured: `matching('src/features/*\/')` and `matching('**\/src/features/*\/')` both
 * resolve and both report 1 finding on the slices fixture. Eight of the nine
 * unanchored args in the docs are this shape, so a rule that ignored the distinction
 * would be 8 false positives to 1 true one — the "three legitimate patterns" the plan
 * warned about, and the reason per-API classification is the mechanism rather than a
 * refinement of it.
 */
const RELATIVE_ALLOWED = new Set([
  'matching',
  // `assignedFrom` is listed here and MEASURED NOT TO BE — it discovers nothing
  // from a relative glob, which `docs/troubleshooting.md` also states. So this
  // entry lets a dead example through. Left as-is deliberately: correcting it
  // would flag that page's intentional `// ❌ 0 files` counter-example, so it
  // needs the guard to distinguish a counter-example first. Recorded in
  // bug 0033, which is about the same inconsistency one level up.
  'assignedFrom',
  // Since v0.35.0 — an unanchored glob here means the folder at the project
  // root, which is narrower than the anchored spelling rather than broken.
  'resideInFile',
  'resideInFolder',
  'havePathMatching',
])

/**
 * APIs whose glob is matched against a resolved module path **or a bare specifier**.
 *
 * Exempt entirely: `notImportFrom('fastify')` is correct and unanchored, which is
 * what [ts-archunit bug 0014](https://github.com/nielspeter/ts-archunit/blob/main/bugs/fixed/0014-bare-package-import-globs-match-nothing.md)
 * was fixed to support. 31 such args in the docs.
 */
const IMPORT_TARGET = new Set([
  'notImportFrom',
  'onlyImportFrom',
  'dependOn',
  'onlyHaveTypeImportsFrom',
  'onlyBeImportedVia',
  'importFrom',
])

interface GlobArg {
  file: string
  api: string
  glob: string
}

/** Every string argument to a glob-taking API in every TypeScript fence in `docs/`. */
function globArgs(): {
  anchoringRequired: GlobArg[]
  relativeAllowed: GlobArg[]
  importTarget: GlobArg[]
  fences: number
} {
  const project = new Project({ useInMemoryFileSystem: true })
  const anchoringRequired: GlobArg[] = []
  const relativeAllowed: GlobArg[] = []
  const importTarget: GlobArg[] = []
  let fences = 0

  for (const name of fs.readdirSync(docsDir).filter((n) => n.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(docsDir, name), 'utf-8')
    const blocks = [...text.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)]
    for (const [index, match] of blocks.entries()) {
      const code = match[1]
      if (code === undefined) continue
      fences += 1
      // A doc fence is a fragment, so it will not typecheck — parsing is enough, and
      // it is what distinguishes an argument from a coincidence.
      const sourceFile = project.createSourceFile(`/docs/${name}-${String(index)}.ts`, code, {
        overwrite: true,
      })
      for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        const expression = call.getExpression()
        const api = Node.isPropertyAccessExpression(expression)
          ? expression.getName()
          : Node.isIdentifier(expression)
            ? expression.getText()
            : ''
        const bucket = ANCHORING_REQUIRED.has(api)
          ? anchoringRequired
          : RELATIVE_ALLOWED.has(api)
            ? relativeAllowed
            : IMPORT_TARGET.has(api)
              ? importTarget
              : undefined
        if (bucket === undefined) continue
        for (const argument of call.getArguments()) {
          if (Node.isStringLiteral(argument)) {
            bucket.push({ file: name, api, glob: argument.getLiteralValue() })
          }
        }
      }
    }
  }
  return { anchoringRequired, relativeAllowed, importTarget, fences }
}

const isAnchored = (glob: string): boolean => glob.startsWith('**/') || glob.startsWith('/')
const hasDotSegment = (glob: string): boolean => glob.startsWith('./') || glob.includes('/./')

describe('globs in documented examples', () => {
  const found = globArgs()

  it('parses every TypeScript fence, or it is checking a subset it cannot name', () => {
    // Non-vacuity, and the first thing to break if the fence regex drifts: every
    // assertion below is over an empty set if this is zero. Measured at 319.
    expect(found.fences).toBeGreaterThan(250)
    expect(
      found.anchoringRequired.length + found.relativeAllowed.length + found.importTarget.length,
    ).toBeGreaterThan(100)
  })

  it('anchors every glob matched against an absolute path', () => {
    // The finding this exists for. An unanchored glob here selects nothing, so the
    // example teaches a rule that enforces nothing — measured, `resideInFolder`
    // selects 0 modules unanchored against 40 anchored.
    const unanchored = found.anchoringRequired
      .filter((g) => !isAnchored(g.glob))
      .map((g) => `${g.file}: ${g.api}('${g.glob}')`)
    expect(unanchored).toEqual([])
  })

  it('uses no `./` segment in ANY documented glob', () => {
    // **Over every bucket, not just `anchoringRequired`.** `ANCHORING_REQUIRED` is
    // empty by construction, so filtering it made this row — and the anchoring row
    // above — unable to fail on any input. Measured: appending
    // `resideInFolder('./src/domain/**')` to a doc page left all five rows green,
    // while that glob selects 0 modules against the `modules` fixture where the
    // anchored spelling selects 4.
    //
    // A `./` segment is dead for EVERY base, which is not a guess — it is what
    // `core/glob-diagnosis.ts` states and why `syntacticFault` returns
    // `'dot-segment'` before it considers anchoring: "a './' anywhere — not just
    // leading — makes the glob unmatchable ... True for every base." So the
    // relative-by-design exemption does not extend to it, and neither does the
    // bare-specifier one.
    const dotted = [...found.anchoringRequired, ...found.relativeAllowed, ...found.importTarget]
      .filter((g) => hasDotSegment(g.glob))
      .map((g) => `${g.file}: ${g.api}('${g.glob}')`)
    expect(dotted).toEqual([])
  })

  it('DECLARED EMPTY: no API currently requires anchoring, and that is asserted', () => {
    // The two rows above filter `anchoringRequired`. An empty registry is honest
    // only when it is DECLARED — the `.expectEmpty()` shape from ADR-010 part 3 —
    // otherwise "no findings" and "no possible findings" are indistinguishable.
    //
    // The day an absolute-path-matched API is added to the set, the anchoring row
    // wakes up and this row fails, telling you to delete it. That is the expiry
    // property: the declaration is only allowed to hold while it is true.
    expect(ANCHORING_REQUIRED.size).toBe(0)
  })

  it('leaves the relative-by-design and bare-specifier APIs alone', () => {
    // The discriminator. Without this the rule is 8 false positives to 1 true one,
    // and the cheapest way to green those 8 would be to anchor globs that are correct
    // as written — making the docs wrong to satisfy a test.
    // A FLOOR, not the exact count. It was pinned at 8 — `matching()` and
    // `assignedFrom()`, all of them unanchored — and v0.35.0 moved the three
    // path predicates into this set, taking it past 130. Re-pinning the new
    // number would buy a test that reds on the next doc edit and says nothing;
    // what this assertion is for is that the exemption is **exercised**, so
    // that is what it now asserts. The `toBe` was the snapshot ADR-009 rule 4
    // warns about, and it took a behaviour change to notice.
    expect(found.relativeAllowed.length).toBeGreaterThan(20)
    // At least some are genuinely unanchored — an exemption nothing exercises
    // is not load-bearing, which is the property the old count stood for.
    expect(found.relativeAllowed.filter((g) => !isAnchored(g.glob)).length).toBeGreaterThan(5)

    // Import-target APIs. A FLOOR on the population, for the reason the sibling
    // assertion above gives: this arrived from `ts-archunit` as `toBe(31)`, a
    // snapshot of THAT corpus, and eess's docs hold 29. Re-pinning 29 buys a row
    // that reds on the next doc edit and says nothing — the ADR-009 rule 4
    // snapshot trap, twice in one test.
    // 29 today. The floor sits just under it rather than 9 below: a 20 would let
    // eight documented examples vanish unnoticed, which is the gap a floor is
    // supposed to close. Re-pinning 29 exactly is the snapshot trap named above.
    expect(found.importTarget.length).toBeGreaterThan(25)

    // **The exemption is EXERCISED here, and that is the corrected fact.**
    // `ts-archunit`'s version asserted zero unanchored args, with a comment saying
    // the exemption was unexercised because its docs held no bare-specifier
    // example. eess's docs hold three project-relative ones —
    // `notImportFrom('src/repositories/**')` in `cli.md`, and the equivalents in
    // `what-is-eess.md` and the calculator walkthrough.
    //
    // Those are CORRECT as written, which was measured rather than assumed before
    // this line was changed: against the `modules` fixture,
    // `notImportFrom('src/infra/**')` reports 1 violation, matching the
    // project-relative candidate `"src/infra/database.ts"` that `edgeCandidates`
    // produces alongside the absolute one. The anchored spelling reports the same
    // 1, and a true bare specifier (`'fastify'`) reports 0. So an unanchored
    // import target is a working example, not a dead one — inverting this
    // assertion to match the old corpus would have meant editing three correct
    // teaching pages, including the landing page, to satisfy a test.
    expect(found.importTarget.filter((g) => !isAnchored(g.glob)).length).toBeGreaterThan(0)
  })

  it('knows which APIs it is classifying, so a new one is not silently unchecked', () => {
    // The failure mode this file would otherwise have: a glob-taking API added later
    // falls into no bucket and its doc examples go unchecked forever, which is how
    // `Condition.globs` came to exist unpopulated (plan 0073). Asserted against the
    // source rather than a hard-coded list.
    const conditions = fs.readFileSync(
      path.join(packageRoot, 'src/conditions/dependency.ts'),
      'utf-8',
    )
    for (const api of ['notImportFrom', 'onlyImportFrom', 'dependOn', 'onlyHaveTypeImportsFrom']) {
      expect(conditions).toContain(`export function ${api}`)
      expect(IMPORT_TARGET.has(api)).toBe(true)
    }
  })
})
