/**
 * The release gate's pure core (bug 0106) — no git, no fs, no process.
 *
 * Split out from `check-release.mjs` on purpose. "Which packages changed since a
 * base ref" needs git and only answers in a repo; "does this set of changed
 * packages have the declarations it needs" is a correspondence over plain data.
 * Keeping the second half pure is what lets `scripts/nonvacuity/bad-release.mjs`
 * prove both rules go red with synthetic inputs and no fake repository — the
 * same pure/impure split that let `ledgerStats` become a denominator the gate
 * could not disagree with (bug 0119).
 *
 * Two rules, because one of them holds even when the diff is empty:
 *
 *   release/changed-package-needs-changeset  a changed package with no changeset
 *                                            declaring a bump — the bug 0106 case.
 *   release/changeset-names-real-package      a changeset naming a package that is
 *                                            not in the workspace. Pure drift, no
 *                                            base ref needed: a typo'd name is a
 *                                            declaration that silently publishes
 *                                            nothing, which is 0106's failure one
 *                                            layer over.
 *
 * STRONGER THAN `changeset status --since`, deliberately. Measured on a
 * throwaway worktree while fixing 0106: changing `packages/core/src` and
 * committing a changeset that names `@nielspeter/eess-md` instead exits **0**.
 * Upstream asks "were any changesets added since the ref", not "does each
 * changed package have one", so a changeset for an unrelated package satisfies
 * it. This gate keys the correspondence per package name, so it does not.
 *
 * The one place it deliberately MATCHES upstream is the blanket waiver: an empty
 * changeset (`npx changeset add --empty`, whose whole body is `---\n---`) is the
 * author declaring "this ships nothing", and it waives the changed-package rule
 * wholesale. That is the manifesto's own move — the gate fails on a MISSING
 * declaration, not on low hardness (docs/manifesto.md, "Declare the tier, gate
 * on the declaration") — so there is no path-exemption table here and no second
 * private definition of "a change that doesn't count". A waiver is a file in the
 * diff, and `check-release.mjs` names it in the summary so it is countable
 * rather than silent.
 */
import { correspondence } from '@nielspeter/eess'

/**
 * Map changed file paths to the workspace packages that own them.
 *
 * Ownership is "the file lives under the package directory" — the same rule
 * changesets uses, so the two can never disagree about what changed. That is
 * why `packages/md/tests/**` counts as a change to `@nielspeter/eess-md`: it is
 * not an oversight, it is the author's call to declare (see the header).
 *
 * @param {readonly string[]} changedFiles repo-relative POSIX paths
 * @param {readonly {name: string, dir: string}[]} packages workspace packages
 * @returns {{name: string, dir: string}[]} owners, unique, sorted by name
 */
export function packagesTouchedBy(changedFiles, packages) {
  const hit = new Map()
  for (const file of changedFiles) {
    for (const pkg of packages) {
      if (file === pkg.dir || file.startsWith(`${pkg.dir}/`)) hit.set(pkg.name, pkg)
    }
  }
  return [...hit.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** A package bump declared by one line of one changeset's frontmatter. */
/**
 * @typedef {object} Declaration
 * @property {string} pkg   package name as written
 * @property {string} bump  patch | minor | major
 * @property {string} file  repo-relative path of the changeset
 * @property {number} line  1-based line of the declaring frontmatter entry
 */

/**
 * Run both correspondences over already-gathered data.
 *
 * @param {object} input
 * @param {readonly Declaration[]} input.declarations every bump declared by a pending changeset
 * @param {readonly {name: string, dir: string}[]} input.changedPackages packages touched since the base
 * @param {readonly {name: string, dir: string}[]} input.workspacePackages every package in the workspace
 * @param {readonly string[]} input.blanketWaivers paths of empty changesets
 * @returns {{violations: import('@nielspeter/eess').ArchViolation[], stats: object}}
 */
export function releaseViolations({
  declarations,
  changedPackages,
  workspacePackages,
  blanketWaivers = [],
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
  // ambiguity is not a finding here — two changesets for one package is the
  // normal state of a release train, and `direction` already excludes it.
  const needsChangeset = correspondence({
    left: declarationSelection,
    right: changedSelection,
    keyBy: { left: (d) => d.pkg, right: (p) => p.name },
    suggest: {
      right: (info) =>
        `run \`npx changeset\` and select ${info.name} — or \`npx changeset add --empty\` ` +
        `if this change ships nothing a consumer can observe`,
    },
  })
    .should()
    .beComplete({ direction: 'right-to-left' })
    .because(
      'a package can change, pass every gate and merge without ever reaching a consumer: ' +
        'with no changeset, `changeset version` never bumps it and `changeset publish` never ships it',
    )
    .rule({ id: 'release/changed-package-needs-changeset' })

  // left-to-right: report declarations naming a package that does not exist.
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
    .because(
      'a changeset naming a package that does not exist is a declaration that publishes nothing — ' +
        'it looks like a pending release and is one only to a reader',
    )
    .rule({ id: 'release/changeset-names-real-package' })

  const waived = blanketWaivers.length > 0
  const violations = [
    ...(waived ? [] : needsChangeset.violations()),
    ...namesRealPackage.violations(),
  ]

  const declaredNames = new Set(declarations.map((d) => d.pkg))
  return {
    violations,
    stats: {
      changed: changedPackages.length,
      changedDeclared: changedPackages.filter((p) => declaredNames.has(p.name)).length,
      declarations: declarations.length,
      workspace: workspacePackages.length,
      blanketWaivers: [...blanketWaivers],
      waived,
    },
  }
}
