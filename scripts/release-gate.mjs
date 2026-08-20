/**
 * The release gate's pure core (bug 0106) — no git, no fs, no process.
 *
 * Split out from `check-release.mjs` on purpose. "Which packages changed since a
 * base ref" needs git and only answers in a repo; "does this set of changed
 * packages have the declarations it needs" is a correspondence over plain data.
 * Keeping the second half pure is what lets `scripts/nonvacuity/bad-release.mjs`
 * drive it with synthetic inputs and no fake repository.
 *
 * THE PARSE IS NOT OURS. `declarationsIn` delegates to `@changesets/parse` —
 * the same parser `changeset version` uses. The first version of this gate
 * hand-rolled a regex, and review measured the cost: `'@pkg': minor # note`, a
 * multi-line value, a flow mapping and a quoted bump all parse fine upstream and
 * matched nothing here — and, worse, a file yielding no declarations was read as
 * `changeset add --empty`, i.e. an intentional waiver. A parser that cannot read
 * a declaration was treating that failure as the STRONGEST possible declaration,
 * repo-wide. `'@pkg': none` — a valid changesets bump type meaning "no release,
 * but recorded" — did the same: the most honest changeset a contributor can
 * write disabled the gate. Two definitions of "a changeset" is the drift this
 * project exists to catch, so there is now one.
 *
 * Four rules:
 *
 *   release/changed-package-needs-changeset  a changed package with no changeset
 *                                            declaring a bump — the bug 0106 case.
 *   release/changeset-names-real-package      a changeset naming a package that is
 *                                            not in the workspace. Pure drift, no
 *                                            base ref needed: a typo'd name is a
 *                                            declaration that silently publishes
 *                                            nothing.
 *   release/unparseable-changeset             a file in `.changeset/` the shared
 *                                            parser rejects. Fail-closed: it is a
 *                                            finding, never a waiver.
 *   release/breaking-needs-minor              a changeset whose body declares a
 *                                            break while every package it names
 *                                            takes `patch` (bug 0184). The one
 *                                            rule here guarding an IRREVERSIBLE
 *                                            effect: `changeset publish` ships
 *                                            with provenance and npm refuses a
 *                                            re-publish.
 *
 * STRONGER THAN `changeset status --since`, deliberately. Measured on a
 * throwaway worktree: changing `packages/core/src` and committing a changeset
 * that names `@nielspeter/eess-md` instead exits **0**. Upstream asks "were any
 * changesets added since the ref", not "does each changed package have one", so
 * a changeset for an unrelated package satisfies it. This gate keys the
 * correspondence per package name, so it does not.
 *
 * WAIVERS. An empty changeset (`npx changeset add --empty`) is the author
 * declaring "this ships nothing", and upstream treats it as satisfying the same
 * question. It is honoured here with two limits review forced:
 *   - It must be IN THIS DIFF. `blanketWaivers` used to come from a disk scan, so
 *     an `--empty` merged by an earlier PR silenced the gate for every subsequent
 *     PR until the next `changeset version` — weeks, invisibly, and never in the
 *     silenced PR's own diff. The scoping is what makes "a waiver is a file in
 *     the diff" true rather than merely claimed.
 *   - It is reported, never hidden. `check-release.mjs` names the waiving file
 *     AND the packages it left unchecked, and does not print "every changed
 *     package is declared" when it did not check them.
 * For a mixed change — a real feature in one package, a test-only touch in
 * another — the precise tool is `'@pkg': none`, which declares per package
 * instead of blanketing the run.
 */
import { correspondence } from '@nielspeter/eess'
import parseChangeset from '@changesets/parse'

/**
 * Map changed file paths to the workspace packages that own them.
 *
 * Ownership is "the file lives under the package directory" — the same rule
 * changesets uses, so the two can never disagree about what changed. That is
 * why `packages/md/tests/**` counts as a change to `@nielspeter/eess-md`: it is
 * not an oversight, it is the author's call to declare.
 *
 * @param {readonly string[]} changedFiles repo-relative POSIX paths
 * @param {readonly {name: string, dir: string}[]} packages workspace packages
 * @returns {{name: string, dir: string}[]} owners, unique, sorted by name
 */
export function packagesTouchedBy(changedFiles, packages) {
  const hit = new Map()
  for (const file of changedFiles) {
    for (const pkg of packages) {
      if (file.startsWith(`${pkg.dir}/`)) hit.set(pkg.name, pkg)
    }
  }
  return [...hit.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * @typedef {object} Declaration
 * @property {string} pkg   package name as changesets reads it
 * @property {string} bump  patch | minor | major | none
 * @property {string} file  repo-relative path of the changeset
 * @property {number} line  1-based line the package is named on (1 if not found)
 */

/**
 * Read one changeset's text with the shared parser.
 *
 * @param {string} text raw file contents
 * @param {string} file repo-relative path, for attribution
 * @returns {{declarations: Declaration[], empty: boolean, error?: string}}
 *   `empty` is true only when the parser succeeds and finds no releases — the
 *   `changeset add --empty` case, and exactly what upstream would conclude.
 *   `error` is set when the parser rejects the file; it is never a waiver.
 */
/**
 * Whether a changeset body DECLARES a breaking change.
 *
 * **The keyword set is measured, not guessed** (bug 0184). Two forms count:
 *
 * - a bolded `**Breaking…**` lead, which is how this repo writes it — 4 of the 9
 *   changesets pending when this was built use exactly that shape;
 * - `BREAKING CHANGE` / `BREAKING-CHANGE`, the conventional-commits marker, so a
 *   contributor who reaches for the ecosystem-standard spelling is covered.
 *
 * **What deliberately does NOT count, and why each was rejected:**
 *
 * - `**Migration:**` sections. The obvious second signal, and wrong: 5 pending
 *   changesets carry one and only 4 describe a break, so the two sets differ.
 *   Migration guidance accompanies plenty of non-breaking minors.
 * - bare `/breaking/i`. "This is **not** a breaking change" and "avoids breaking
 *   the baseline" both match it. A gate that reddens correct changesets is one
 *   that gets suppressed — ADR-009 rule 1, whose discriminator is whether the
 *   remedy is optional and which warns that failing on a judgement call trains
 *   the reader to suppress — and suppressing this one re-opens an
 *   irreversible path.
 *
 * Requiring a line-anchored marker or the all-caps form means every negation we
 * measured fails to match, without a lookaround nobody can read. Stated as
 * "measured", not "impossible": an unanchored version of this claimed the
 * stronger thing and was wrong — `a **Breaking** change but did not make one`
 * matched it.
 *
 * The cost of the narrow set is stated rather than hidden: a break announced in
 * unadorned prose is not caught. That is the honest trade — this gate exists to
 * catch the case where someone wrote "Breaking" and still typed `patch`, not to
 * infer intent from prose.
 */
export function breakingMarkerIn(summary) {
  if (typeof summary !== 'string') return undefined
  // The bolded form closes at its own `**`, so the quoted marker is a whole
  // span rather than a fixed-width slice. A character cap cut mid-code-span and
  // printed an unbalanced backtick — `**Breaking for subclasses of `SmellBuilder`
  // was the measured output, which reads as a typo in the gate rather than as a
  // quotation of the author's own text.
  // `__bold__` is CommonMark's other strong emphasis, and `CHANGES` (plural) is
  // the commoner spelling in the wild than the conventional-commits singular —
  // both were measured as misses by an adopter review, and both are free: no
  // negation can match either.
  const m =
    /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)(?:BREAKING|Breaking)[^\n]*?(?:\*\*|__)/m.exec(summary) ??
    /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)(?:BREAKING|Breaking)[^\n]*/m.exec(summary) ??
    /^#{1,6}[ \t]+(?:BREAKING|Breaking)[^\n]*/m.exec(summary) ??
    /\bBREAKING[ -]CHANGES?\b/.exec(summary)
  if (m === null || m === undefined) return undefined
  const marker = m[0].trim()
  return marker.length <= 72 ? marker : `${marker.slice(0, 69)}…`
}

/** Whether a changeset body declares a break. See {@link breakingMarkerIn}. */
export function declaresBreaking(summary) {
  return breakingMarkerIn(summary) !== undefined
}

export function declarationsIn(text, file) {
  let parsed
  try {
    parsed = parseChangeset(text)
  } catch (err) {
    return { declarations: [], empty: false, error: String(err?.message ?? err).split('\n')[0] }
  }
  // The parser gives no line numbers, so attribute to the line naming the
  // package; frontmatter only, so a package named in the prose cannot capture it.
  const lines = text.split('\n')
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  const lineOf = (pkg) => {
    for (let i = 1; i < (end < 0 ? lines.length : end); i++) {
      if (lines[i].includes(pkg)) return i + 1
    }
    return 1
  }
  const declarations = parsed.releases.map((r) => ({
    pkg: r.name,
    bump: r.type,
    file,
    line: lineOf(r.name),
  }))
  return {
    declarations,
    empty: declarations.length === 0,
    breakingMarker: breakingMarkerIn(parsed.summary),
  }
}

const WHY_UNDECLARED =
  'a package can change, pass every gate and merge without ever reaching a consumer: with no ' +
  'changeset, `changeset version` never bumps it and `changeset publish` never ships it'
const WHY_GHOST =
  'a changeset naming a package that does not exist is a declaration that publishes nothing — ' +
  'it looks like a pending release and is one only to a reader'
const WHY_BREAKING_PATCH =
  'a contract break released as a patch cannot be taken back — `changeset publish` ships with ' +
  'provenance and npm refuses to re-publish a version, so the wrong bump is permanent within ' +
  'the hour it takes anyone to notice'
const WHY_UNPARSEABLE =
  'a changeset the release tool cannot read declares nothing, and a file that declares nothing ' +
  'must never be mistaken for one declaring "this ships nothing"'

/**
 * Run the rules over already-gathered data.
 *
 * @param {object} input
 * @param {readonly Declaration[]} input.declarations every bump declared by a pending changeset
 * @param {readonly {name: string, dir: string}[]} input.changedPackages packages touched since the base
 * @param {readonly {name: string, dir: string}[]} input.workspacePackages every package, base ∪ head
 * @param {readonly string[]} input.waivers paths of empty changesets THAT ARE IN THIS DIFF
 * @param {readonly {file: string, error: string}[]} input.unparseable files the parser rejected
 * @returns {{violations: object[], stats: object}}
 */
export function releaseViolations({
  declarations,
  changedPackages,
  workspacePackages,
  waivers = [],
  unparseable = [],
  breakingFiles = [],
}) {
  const declarationSelection = {
    elements: [...declarations],
    label: 'changeset declaration',
    identify: (d) => ({ name: d.pkg, file: d.file, line: d.line }),
  }
  const changedSelection = {
    elements: [...changedPackages],
    label: 'changed package',
    identify: (p) => ({ name: p.name, file: `${p.dir}/package.json`, line: 1 }),
  }
  const workspaceSelection = {
    elements: [...workspacePackages],
    label: 'workspace package',
    identify: (p) => ({ name: p.name, file: `${p.dir}/package.json`, line: 1 }),
  }

  // right-to-left: report changed packages with no declaration. Left-side
  // branches are excluded, so a pending changeset for a package unchanged in
  // this branch is correctly not a finding.
  const needsChangeset = correspondence({
    left: declarationSelection,
    right: changedSelection,
    keyBy: { left: (d) => d.pkg, right: (p) => p.name },
    suggest: {
      right: (info) =>
        `run \`npx changeset\` and select ${info.name}; if this change ships nothing a consumer ` +
        `can observe, declare that instead — add \`'${info.name}': none\` to a changeset`,
    },
  })
    .should()
    .beComplete({ direction: 'right-to-left' })
    .because(WHY_UNDECLARED)
    .rule({ id: 'release/changed-package-needs-changeset' })

  // left-to-right: report declarations naming a package that does not exist.
  // The right side is the WORKSPACE, not the changed set — binding it to the
  // changed set would redefine the rule as "names a changed package" and
  // false-positive on every changeset carried over from an earlier PR.
  const namesRealPackage = correspondence({
    left: declarationSelection,
    right: workspaceSelection,
    keyBy: { left: (d) => d.pkg, right: (p) => p.name },
    suggest: {
      left: (info) =>
        `no workspace package is named '${info.name}' — fix the name in this changeset, ` +
        `or delete it if the package is gone`,
    },
  })
    .should()
    .beComplete({ direction: 'left-to-right' })
    .because(WHY_GHOST)
    .rule({ id: 'release/changeset-names-real-package' })

  const waived = waivers.length > 0
  const unreadable = unparseable.map((u) => ({
    rule: 'correspondence',
    ruleId: 'release/unparseable-changeset',
    element: u.file,
    file: u.file,
    line: 1,
    message:
      `\`${u.file}\` is in .changeset/ but the changesets parser rejects it: ${u.error}\n` +
      `  fix the frontmatter, or delete the file — an unreadable changeset is not a waiver`,
    because: WHY_UNPARSEABLE,
  }))

  // A changeset that says it breaks something must bump at least one package
  // beyond `patch`. **At least one, not all** — a break is owned by one package
  // while its siblings legitimately take a dependency patch, which is the shape
  // of `assertion-less-rules-fail.md` (kernel minor, five dialects patch).
  // Requiring every row to be minor would redden that correct changeset.
  // One shape: `{ file, marker }`. An earlier draft also accepted a bare path
  // string, which is two definitions of the same input — the drift this project
  // exists to catch, in the gate that catches it.
  const breakingAnnotated = breakingFiles
    .map(({ file, marker }) => ({
      file,
      marker,
      decls: declarations.filter((d) => d.file === file),
    }))
    // **The empty case is a finding, not a skip.** An earlier version filtered it
    // out reasoning "no bump here to be wrong". Measured, that premise is wrong:
    // `--empty` sets `waived`, which suppresses
    // release/changed-package-needs-changeset for every changed package — so a
    // file whose body carries the loudest marker the detector knows turns off the
    // strongest rule in this gate, and produced ZERO violations. A declared break
    // with no declared bump is a self-contradiction; fail closed.
    // **Two strengths, and the weaker one is named in the output.**
    //
    // When the marker names its owner — `**Breaking (@nielspeter/eess-ts):**` —
    // THAT package must be past patch. Without an owner the rule can only ask
    // that SOMETHING is, because a break is owned by one package while its
    // siblings take dependency patches: `assertion-less-rules-fail.md` is kernel
    // minor + five dialects patch, and demanding all of them would redden it.
    //
    // The gap that leaves is real and was measured, not theorised: kernel minor
    // with the break actually in a dialect on patch passes the weak form, and
    // that is this repo's most common multi-package shape. Naming the owner is
    // what closes it, which is why the message says so when no owner was given.
    .map((r) => {
      const owners = [
        ...new Set((r.marker ?? '').match(/@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9.-]*/g) ?? []),
      ]
      return { ...r, owners }
    })

  // How many were checked in the WEAK form: several packages declared, no owner
  // named, so "at least one past patch" is all the rule can ask. Counted and
  // printed on every run, including green ones — otherwise the summary reports
  // the same ✓ for a changeset checked exactly and one checked loosely, and only
  // one of those is the guarantee the record claims.
  const breakingLoose = breakingAnnotated.filter(
    ({ owners, decls }) => owners.length === 0 && decls.length > 1,
  ).length

  const brokenOnPatch = breakingAnnotated
    .filter(({ decls, owners }) =>
      decls.length === 0
        ? true
        : owners.length > 0
          ? !owners.every((o) =>
              decls.some((d) => d.pkg === o && (d.bump === 'minor' || d.bump === 'major')),
            )
          : !decls.some((d) => d.bump === 'minor' || d.bump === 'major'),
    )
    .map(({ file, marker, decls, owners }) => {
      // **Both branches must actually clear the finding** (ADR-009 rule 2). An
      // earlier wording offered "say plainly that nothing a consumer can observe
      // changed" — which is what `'@pkg': none` MEANS, and review measured the
      // rule still firing on `none` while advising exactly that. The gate told
      // you to do the thing you had just done. The marker, not the bump, is what
      // this rule reads, so removing the marker is the only second way out.
      // The empty changeset is its own shape: nothing to raise, so the remedy is
      // to declare the bump the break needs — or drop the marker if the file
      // really does ship nothing.
      if (decls.length === 0) {
        const emptySuggestion =
          `declare the bump this break needs — \`'@scope/pkg': minor\` — or, if this changeset ` +
          `really ships nothing, delete the marker` +
          (marker === undefined ? '' : `: \`${marker}\``) +
          `. An empty changeset also WAIVES the changed-package rule for every package in the ` +
          `run, so this file currently silences more than itself.`
        return {
          rule: 'correspondence',
          ruleId: 'release/breaking-needs-minor',
          element: file,
          file,
          line: 1,
          message:
            `\`${file}\` declares a breaking change` +
            (marker === undefined ? '' : ` (\`${marker}\`)`) +
            ` and declares no bump at all\n  ${emptySuggestion}`,
          suggestion: emptySuggestion,
          because: WHY_BREAKING_PATCH,
        }
      }
      const suggestion =
        `raise the package that owns the break to \`minor\` (on 0.x a break is a minor; ` +
        `\`major\` would take it to 1.0.0 and claim stability), or — if this is not a break — ` +
        `delete the marker this rule matched` +
        (marker === undefined ? '' : `: \`${marker}\``) +
        `. Changing the bump alone will not clear this, and neither will \`none\`.` +
        (owners.length > 0
          ? ` This changeset names its owner (${owners.join(', ')}), so THAT package is the one that must move.`
          : decls.length > 1
            ? ` Name the owning package in the marker — \`**Breaking (${decls[0].pkg}):**\` — and this rule ` +
              `will check that package specifically instead of accepting any one of the ${String(decls.length)} declared here.`
            : '')
      return {
        rule: 'correspondence',
        ruleId: 'release/breaking-needs-minor',
        element: file,
        file,
        line: decls[0].line,
        message:
          `\`${file}\` declares a breaking change` +
          (marker === undefined ? '' : ` (\`${marker}\`)`) +
          ` and bumps only ${[...new Set(decls.map((d) => d.bump))].sort().join('/')}: ` +
          `${decls.map((d) => `${d.pkg}=${d.bump}`).join(', ')}\n  ${suggestion}`,
        // Also as its own field: `CLAUDE.md` promises every violation surfaces a
        // `Fix:` line from `suggestion`, and `--format json` is the agent path.
        suggestion,
        because: WHY_BREAKING_PATCH,
      }
    })

  const violations = [
    ...(waived ? [] : needsChangeset.violations()),
    ...namesRealPackage.violations(),
    ...unreadable,
    ...brokenOnPatch,
  ]

  const declaredNames = new Set(declarations.map((d) => d.pkg))
  const undeclared = changedPackages.filter((p) => !declaredNames.has(p.name)).map((p) => p.name)
  return {
    violations,
    stats: {
      changed: changedPackages.length,
      changedDeclared: changedPackages.length - undeclared.length,
      declarations: declarations.length,
      workspace: workspacePackages.length,
      unparseable: unparseable.length,
      // **Reported by the rule, not by the caller's own variable.** The summary
      // used to print `breakingFiles.length` read from the shell, while the rule
      // read the argument. Severing the argument left the two disagreeing in
      // silence: measured, `check:release` exited 0 over a real break declared as
      // a patch while printing `✓ 4 of 9 … each bumping past patch`. A denominator
      // sourced from anywhere but the rule attests a check that may not have run,
      // which is worse than no denominator at all (ADR-010).
      breakingExamined: breakingFiles.length,
      breakingLoose,
      waivers: [...waivers],
      waived,
      // Named, not just counted: under a waiver these are the packages the gate
      // did NOT check, and the summary line has to say so rather than print a ✓.
      unchecked: waived ? undeclared : [],
    },
  }
}
