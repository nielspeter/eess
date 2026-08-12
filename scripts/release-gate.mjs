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
 * Three rules:
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
  return { declarations, empty: declarations.length === 0 }
}

/** Rationale is stamped here: the kernel's `.violations()` path drops `ctx.reason` (bug 0122). */
function stamp(violations, because) {
  for (const v of violations) if (v.because === undefined) v.because = because
  return violations
}

const WHY_UNDECLARED =
  'a package can change, pass every gate and merge without ever reaching a consumer: with no ' +
  'changeset, `changeset version` never bumps it and `changeset publish` never ships it'
const WHY_GHOST =
  'a changeset naming a package that does not exist is a declaration that publishes nothing — ' +
  'it looks like a pending release and is one only to a reader'
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

  const violations = [
    ...(waived ? [] : stamp(needsChangeset.violations(), WHY_UNDECLARED)),
    ...stamp(namesRealPackage.violations(), WHY_GHOST),
    ...unreadable,
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
      waivers: [...waivers],
      waived,
      // Named, not just counted: under a waiver these are the packages the gate
      // did NOT check, and the summary line has to say so rather than print a ✓.
      unchecked: waived ? undeclared : [],
    },
  }
}
