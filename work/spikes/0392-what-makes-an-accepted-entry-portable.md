# Spike 0392: what makes an accepted entry portable?

Measured 2026-10-06 for [bug 0389](../bugs/fixed/0389-an-accepted-warning-list-holds-the-authors-absolute-paths.md)
and PR #181, at the maintainer's request ("investigate or spike — no handwaving"), after three
review rounds each found a version of the fix that forgives a finding `main` reports.

## The question

A deferred warning's `accepted` list names findings by subject, and producer identities carry the
absolute path, so a list written on one checkout matches nothing on another. Making it portable means
comparing something machine-independent. Every machine-independent form so far has let one entry
match a **different** finding that `main`, comparing raw paths, would report. Is there a form that
keeps every portable case and is never greener than `main`? If not, what is the floor?

## Method

A harness (below) runs each candidate matcher as a pure function over real directory layouts, with
root discovery on the real disk. For each row a list is pasted from one finding (the candidate's own
advice form, or the raw form a list written on `main` holds), and a later finding is checked against
it. `want` is `accept` for a portability case and `reject` where `main` rejects; a candidate that
accepts where `main` rejects is **greener**. Rows marked `/app` force the root, as discovery returns
it in a container, because the substring case needs a short root the test machine does not have.

Candidates:

- **M** — `main`: compare raw subjects.
- **H** — PR #181 at `942e53a`: scrub the root out of both sides as a substring, root above the
  builder's tsconfig (any marker, falling back to the nearest `package.json`).
- **C2** — the reviewer's candidate: scrub only when the root is a `.git` (file or directory) or a
  workspace manifest and occurs once, as a prefix; the accepted side is not scrubbed.
- **C3** — replace whole `::`-delimited path tokens under the root with a root-relative form; root is
  the nearest `.git` **directory** or workspace manifest; the accepted side is not scrubbed.
- **C4** — C3, with the token naming the root directory's basename.
- **C5** — replace whole path tokens under the nearest `.git` (file or directory) or workspace
  manifest, and name that root by its `package.json` `name`; no name, no scrub.

Each row's layout is built fresh; the harness ran in under a second.

## Result

| row                                                                           | want   | M            | H                    | C2                   | C3                   | C4                   | C5                   |
| ----------------------------------------------------------------------------- | ------ | ------------ | -------------------- | -------------------- | -------------------- | -------------------- | -------------------- |
| P1 same file, another checkout (.git dir)                                     | accept | **reject** ✗ | accept               | accept               | accept               | accept               | accept               |
| P2 list written on main (raw), same checkout                                  | accept | accept       | accept               | accept               | accept               | accept               | accept               |
| P3 same file, a worktree (.git file)                                          | accept | **reject** ✗ | accept               | accept               | **reject** ✗         | **reject** ✗         | accept               |
| P4 same file, Docker with workspaces, no .git                                 | accept | **reject** ✗ | accept               | accept               | accept               | **reject** ✗         | accept               |
| N2 two package.json, no .git: list from pkgA, pkgA fixed, pkgB new            | reject | reject       | **accept** — greener | reject               | reject               | reject               | reject               |
| N2 no markers: list from pkgA, pkgA fixed, pkgB new                           | reject | reject       | **accept** — greener | reject               | reject               | reject               | reject               |
| N2 submodules under a repo: list from pkgA, pkgA fixed, pkgB new              | reject | reject       | **accept** — greener | **accept** — greener | reject               | reject               | reject               |
| N2 two separate repos: list from pkgA, pkgA fixed, pkgB new                   | reject | reject       | **accept** — greener | **accept** — greener | **accept** — greener | reject               | reject               |
| N2 two separate repos, no package names: list from pkgA, pkgA fixed, pkgB new | reject | reject       | **accept** — greener | **accept** — greener | **accept** — greener | reject               | reject               |
| N2 two separate repos, same dir name, one list                                | reject | reject       | **accept** — greener | **accept** — greener | **accept** — greener | **accept** — greener | reject               |
| R two separate repos that share one package name                              | reject | reject       | **accept** — greener | **accept** — greener | **accept** — greener | reject               | **accept** — greener |
| I1 /app: pasted for src/app/user.ts, later src/appuser.ts                     | reject | reject       | **accept** — greener | reject               | reject               | reject               | reject               |
| I1 /app: raw list from main, later src/appuser.ts                             | reject | reject       | **accept** — greener | reject               | reject               | reject               | reject               |
| I1 /app prefix: pasted for /app/2/src/x.ts, later /app2/src/x.ts              | reject | reject       | **accept** — greener | reject               | reject               | reject               | reject               |
| P5 /app: same file src/app/user.ts in /app and /home/me/app                   | accept | **reject** ✗ | **reject** ✗         | **reject** ✗         | accept               | accept               | accept               |
| **greener than `main` / portable cases kept**                                 |        | 0 / 1/5      | 10 / 4/5             | 5 / 4/5              | 4 / 4/5              | 1 / 3/5              | 1 / 5/5              |

## What this shows

- **Scrubbing text as a substring is the wrong mechanism.** H and C2 fail the `/app` rows: a root
  that also spells a path segment aliases two files (bug 0391). Replacing whole path tokens (C3–C5)
  passes every `/app` row by construction.
- **A root-relative path is not an identity.** Any form relative to a root makes the same layout
  under two different roots look alike. That is every "greener" cell in C3: per-package roots, and
  separate repositories sharing one list. Leaving the accepted side raw does not help; the pasted
  entry is already in the portable form.
- **The repository has to be named, and only a name the repository carries works.** C4 names the
  root by its directory, which differs between checkouts (Docker's `/app`, a worktree) and so loses
  portability, and is shared by unrelated repositories. C5 names it by the root `package.json`
  `name`, which travels with the repository: it keeps all five portability cases and closes every
  `reject` row but one.
- **The floor.** Two different repositories that share one `package.json` name, with one finding at
  the same relative path, under one rule file with one `accepted` list. No machine-independent form
  can tell them apart; a git remote would, but not in a checkout without `.git`. C5 is greener than
  `main` there and nowhere else measured.

## Decision

**Decided by the maintainer, 2026-10-06: C5, with the shared-package-name case accepted as a named
residual.** Built in PR #181 for bug 0389, where the residual is pinned by a test that turns red if
it is ever closed.

## Where this left the decision

C5 is the only measured form that ports and is greener than `main` on a single, named case. Whether
that case is an acceptable residual is the maintainer's call, because accepting a risk is. If it is
not, the honest alternative is to leave `accepted` comparing raw subjects (`main`) and fix the paste
experience instead (bug 0389 stays open). Either way PR #181's current matcher (H) should not ship:
it is greener than `main` on 10 rows here.

Not measured: subjects that carry a path inside prose rather than as a `::` token (C3–C5 leave those
raw, so they stay unportable and fail closed); git worktrees as real `git worktree add` output rather
than a `.git` file; producers whose identity carries several paths.

## Harness

Run from `packages/ts` (it imports the built kernel through `@nielspeter/eess/internal`):

```js
// Spike 0392: which accepted-list matcher ports across checkouts and is never greener than main?
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { discoverIdentityRoot, normalizeIdentityText } from '@nielspeter/eess/internal'

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'spike0392-'))
let n = 0
function layout(spec) {
  // spec: { 'rel/path': 'dir' | 'gitdir' | 'gitfile' | 'pkg' | 'workspaces' }
  const root = path.join(base, String(n++))
  fs.mkdirSync(root, { recursive: true })
  for (const [rel, kindSpec] of Object.entries(spec)) {
    const [kind, pkgName] = kindSpec.split(':')
    const d = path.join(root, rel)
    fs.mkdirSync(d, { recursive: true })
    if (kind === 'gitdir') fs.mkdirSync(path.join(d, '.git'))
    if (kind === 'gitfile') fs.writeFileSync(path.join(d, '.git'), 'gitdir: elsewhere\n')
    if (kind === 'pkg')
      fs.writeFileSync(
        path.join(d, 'package.json'),
        JSON.stringify(pkgName ? { name: pkgName } : {}),
      )
    if (kind === 'workspaces')
      fs.writeFileSync(
        path.join(d, 'package.json'),
        JSON.stringify({ workspaces: ['*'], ...(pkgName ? { name: pkgName } : {}) }),
      )
    if ((kind === 'gitdir' || kind === 'gitfile') && pkgName)
      fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name: pkgName }))
  }
  return root
}
const subject = (file) => `${file}::aliased::x::y`

// ---------- root finders ----------
const fsRoot = (r) => (r === undefined || path.parse(r).root === r ? undefined : r)
const headRoot = (tsconfig) => fsRoot(discoverIdentityRoot(path.dirname(tsconfig)))
function definitiveRoot(tsconfig, { gitFileCounts }) {
  let cur = path.resolve(path.dirname(tsconfig))
  for (;;) {
    const g = path.join(cur, '.git')
    if (fs.existsSync(g) && (gitFileCounts || fs.statSync(g).isDirectory())) return cur
    for (const m of ['pnpm-workspace.yaml', 'lerna.json', 'nx.json'])
      if (fs.existsSync(path.join(cur, m))) return cur
    const pj = path.join(cur, 'package.json')
    if (fs.existsSync(pj) && /"workspaces"/.test(fs.readFileSync(pj, 'utf8'))) return cur
    const up = path.dirname(cur)
    if (up === cur) return undefined
    cur = up
  }
}

// ---------- candidates: { paste(f) -> string, accepts(entries, f) -> bool } ----------
// f = { file, tsconfig, rootOverride? }
const rootOf = (f, finder) => (f.rootOverride !== undefined ? f.rootOverride : finder(f))
function tokenScrub(subj, root, tag) {
  if (root === undefined) return subj
  const prefix = root.endsWith('/') ? root : root + '/'
  return subj
    .split('::')
    .map((t) => (t.startsWith(prefix) ? `<root${tag}>/` + t.slice(prefix.length) : t))
    .join('::')
}
function namedRoot(tsconfig) {
  // nearest .git (file or dir) or workspace manifest; identity = that directory's package.json name
  const r = definitiveRoot(tsconfig, { gitFileCounts: true })
  if (r === undefined) return undefined
  const pj = path.join(r, 'package.json')
  if (!fs.existsSync(pj)) return undefined
  const name = JSON.parse(fs.readFileSync(pj, 'utf8')).name
  return typeof name === 'string' && name !== '' ? { root: r, name } : undefined
}
const c5Root = (f) =>
  f.rootOverride !== undefined
    ? { root: f.rootOverride, name: f.nameOverride }
    : namedRoot(f.tsconfig)
const c5 = (f) => {
  const nr = c5Root(f)
  return nr && nr.name ? tokenScrub(subject(f.file), nr.root, ':' + nr.name) : subject(f.file)
}
const candidates = {
  M_main: {
    paste: (f) => subject(f.file),
    accepts: (es, f) => es.includes(subject(f.file)),
  },
  H_head: {
    paste: (f) => {
      const r = rootOf(f, (x) => headRoot(x.tsconfig))
      return r ? normalizeIdentityText(subject(f.file), r) : subject(f.file)
    },
    accepts: (es, f) => {
      const r = rootOf(f, (x) => headRoot(x.tsconfig))
      const s = r ? normalizeIdentityText(subject(f.file), r) : subject(f.file)
      return es.some((e) => (r ? normalizeIdentityText(e, r) : e) === s)
    },
  },
  C2_oncePrefix: {
    // reviewer's candidate: scrub only when root is .git/workspace (file or dir) and occurs once as a prefix; accepted side raw
    paste: (f) => {
      const r = rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: true }))
      return c2(subject(f.file), r)
    },
    accepts: (es, f) => {
      const r = rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: true }))
      const raw = subject(f.file)
      return es.includes(raw) || es.includes(c2(raw, r))
    },
  },
  C3_tokenGitDir: {
    // replace whole '::' tokens under the root; root = nearest .git DIRECTORY or workspace manifest; accepted side raw
    paste: (f) =>
      tokenScrub(
        subject(f.file),
        rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: false })),
        '',
      ),
    accepts: (es, f) => {
      const r = rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: false }))
      const raw = subject(f.file)
      return es.includes(raw) || es.includes(tokenScrub(raw, r, ''))
    },
  },
  C5_tokenPkgName: {
    paste: (f) => c5(f),
    accepts: (es, f) => es.includes(subject(f.file)) || es.includes(c5(f)),
  },
  C4_tokenGitDirNamed: {
    // C3, and the token names the root's directory name
    paste: (f) => {
      const r = rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: false }))
      return tokenScrub(subject(f.file), r, r ? ':' + path.basename(r) : '')
    },
    accepts: (es, f) => {
      const r = rootOf(f, (x) => definitiveRoot(x.tsconfig, { gitFileCounts: false }))
      const raw = subject(f.file)
      return es.includes(raw) || es.includes(tokenScrub(raw, r, r ? ':' + path.basename(r) : ''))
    },
  },
}
function c2(raw, r) {
  if (r === undefined) return raw
  const prefix = r + '/'
  if (!raw.startsWith(prefix) || raw.indexOf(r, 1) !== -1) return raw
  return '<root>' + raw.slice(r.length)
}

// ---------- rows ----------
// author: finding the list was pasted from (paste form, or raw if raw:true). checker: the later finding.
// want: 'accept' (portability) or 'reject' (must not be greener than main).
const rows = []
{
  // P1 different checkout, .git dir both
  const a = layout({ repo: 'gitdir:acme', 'repo/src': 'dir' }),
    b = layout({ repo: 'gitdir:acme', 'repo/src': 'dir' })
  rows.push({
    id: 'P1 same file, another checkout (.git dir)',
    want: 'accept',
    author: { file: `${a}/repo/src/a.ts`, tsconfig: `${a}/repo/tsconfig.json` },
    checker: { file: `${b}/repo/src/a.ts`, tsconfig: `${b}/repo/tsconfig.json` },
  })
}
{
  // P2 compat: raw list from main, same checkout
  const a = layout({ repo: 'gitdir', 'repo/src': 'dir' })
  const f = { file: `${a}/repo/src/a.ts`, tsconfig: `${a}/repo/tsconfig.json` }
  rows.push({
    id: 'P2 list written on main (raw), same checkout',
    want: 'accept',
    raw: true,
    author: f,
    checker: f,
  })
}
{
  // P3 worktree: author repo .git dir, checker a worktree (.git file)
  const a = layout({ repo: 'gitdir:acme', 'repo/src': 'dir' }),
    b = layout({ wt: 'gitfile:acme', 'wt/src': 'dir' })
  rows.push({
    id: 'P3 same file, a worktree (.git file)',
    want: 'accept',
    author: { file: `${a}/repo/src/a.ts`, tsconfig: `${a}/repo/tsconfig.json` },
    checker: { file: `${b}/wt/src/a.ts`, tsconfig: `${b}/wt/tsconfig.json` },
  })
}
{
  // P4 docker: no .git, workspaces manifest both sides
  const a = layout({ repo: 'workspaces:acme', 'repo/src': 'dir' }),
    b = layout({ app: 'workspaces:acme', 'app/src': 'dir' })
  rows.push({
    id: 'P4 same file, Docker with workspaces, no .git',
    want: 'accept',
    author: { file: `${a}/repo/src/a.ts`, tsconfig: `${a}/repo/tsconfig.json` },
    checker: { file: `${b}/app/src/a.ts`, tsconfig: `${b}/app/tsconfig.json` },
  })
}
const twoPkg = (spec, label) => {
  const p = layout(spec)
  rows.push({
    id: `N2 ${label}: list from pkgA, pkgA fixed, pkgB new`,
    want: 'reject',
    author: { file: `${p}/pkgA/src/x.ts`, tsconfig: `${p}/pkgA/tsconfig.json` },
    checker: { file: `${p}/pkgB/src/x.ts`, tsconfig: `${p}/pkgB/tsconfig.json` },
  })
}
twoPkg(
  { pkgA: 'pkg:a', pkgB: 'pkg:b', 'pkgA/src': 'dir', 'pkgB/src': 'dir' },
  'two package.json, no .git',
)
twoPkg({ 'pkgA/src': 'dir', 'pkgB/src': 'dir' }, 'no markers')
twoPkg(
  {
    '.': 'gitdir:mono',
    pkgA: 'gitfile:a',
    pkgB: 'gitfile:b',
    'pkgA/src': 'dir',
    'pkgB/src': 'dir',
  },
  'submodules under a repo',
)
twoPkg(
  { pkgA: 'gitdir:a', pkgB: 'gitdir:b', 'pkgA/src': 'dir', 'pkgB/src': 'dir' },
  'two separate repos',
)
twoPkg(
  { pkgA: 'gitdir', pkgB: 'gitdir', 'pkgA/src': 'dir', 'pkgB/src': 'dir', x: 'dir' },
  'two separate repos, no package names',
)
{
  // N2 separate repos with the same directory name
  const p1 = layout({ svc: 'gitdir:payments', 'svc/src': 'dir' }),
    p2 = layout({ svc: 'gitdir:billing', 'svc/src': 'dir' })
  rows.push({
    id: 'N2 two separate repos, same dir name, one list',
    want: 'reject',
    author: { file: `${p1}/svc/src/x.ts`, tsconfig: `${p1}/svc/tsconfig.json` },
    checker: { file: `${p2}/svc/src/x.ts`, tsconfig: `${p2}/svc/tsconfig.json` },
  })
}
{
  const p1 = layout({ svc: 'gitdir:same', 'svc/src': 'dir' }),
    p2 = layout({ other: 'gitdir:same', 'other/src': 'dir' })
  rows.push({
    id: 'R two separate repos that share one package name',
    want: 'reject',
    author: { file: `${p1}/svc/src/x.ts`, tsconfig: `${p1}/svc/tsconfig.json` },
    checker: { file: `${p2}/other/src/x.ts`, tsconfig: `${p2}/other/tsconfig.json` },
  })
}
// I1: 0391 shapes, root forced to '/app' (as discovery would return in a container)
rows.push({
  id: 'I1 /app: pasted for src/app/user.ts, later src/appuser.ts',
  want: 'reject',
  author: { file: '/app/src/app/user.ts', rootOverride: '/app', nameOverride: 'acme' },
  checker: { file: '/app/src/appuser.ts', rootOverride: '/app', nameOverride: 'acme' },
})
rows.push({
  id: 'I1 /app: raw list from main, later src/appuser.ts',
  want: 'reject',
  raw: true,
  author: { file: '/app/src/app/user.ts', rootOverride: '/app', nameOverride: 'acme' },
  checker: { file: '/app/src/appuser.ts', rootOverride: '/app', nameOverride: 'acme' },
})
rows.push({
  id: 'I1 /app prefix: pasted for /app/2/src/x.ts, later /app2/src/x.ts',
  want: 'reject',
  author: { file: '/app/2/src/x.ts', rootOverride: '/app', nameOverride: 'acme' },
  checker: { file: '/app2/src/x.ts', rootOverride: '/app', nameOverride: 'acme' },
})
rows.push({
  id: 'P5 /app: same file src/app/user.ts in /app and /home/me/app',
  want: 'accept',
  author: { file: '/app/src/app/user.ts', rootOverride: '/app', nameOverride: 'acme' },
  checker: {
    file: '/home/me/app/src/app/user.ts',
    rootOverride: '/home/me/app',
    nameOverride: 'acme',
  },
})

// ---------- run ----------
const out = []
const names = Object.keys(candidates)
out.push(['row', 'want', ...names].join('\t'))
const score = Object.fromEntries(names.map((k) => [k, { greener: 0, portable: 0, portableOf: 0 }]))
for (const r of rows) {
  const cells = []
  for (const k of names) {
    const c = candidates[k]
    const entry = r.raw ? subject(r.author.file) : c.paste(r.author)
    const got = c.accepts([entry], r.checker) ? 'accept' : 'reject'
    const mainGot = candidates.M_main.accepts(
      [r.raw ? subject(r.author.file) : candidates.M_main.paste(r.author)],
      r.checker,
    )
      ? 'accept'
      : 'reject'
    let mark = got === r.want ? 'ok' : 'WRONG'
    if (got === 'accept' && r.want === 'reject') {
      mark = mainGot === 'reject' ? 'GREENER' : 'WRONG'
      if (mainGot === 'reject') score[k].greener++
    }
    if (r.want === 'accept') {
      score[k].portableOf++
      if (got === 'accept') score[k].portable++
    }
    cells.push(`${got}:${mark}`)
  }
  out.push([r.id, r.want, ...cells].join('\t'))
}
out.push('')
out.push(
  [
    'score',
    '',
    ...names.map(
      (k) => `greener=${score[k].greener} portable=${score[k].portable}/${score[k].portableOf}`,
    ),
  ].join('\t'),
)
console.log(out.join('\n'))
fs.rmSync(base, { recursive: true, force: true })
```
