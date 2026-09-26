---
'@nielspeter/eess-ts': minor
---

A path glob is no longer decided by where the project sits on disk (bug 0339)

**Breaking (@nielspeter/eess-ts):** a rule can select more subjects than before, so
findings may appear in a build that was green, and baseline entries may go unmatched.

picomatch's default `dot: false` stops `**` crossing a path segment that begins with
a `.`, and path globs are matched against the **absolute** file path. So in a
checkout under a dot-directory — a git-worktree manager's layout, a cache
directory, some CI workspaces — every `'**/…'` glob matched nothing, and
`'**/…'` is the spelling the tool's own glob advice tells you to write. Measured
over one fixture copied to two paths: `resideInFile('**/src/**')` examined 0
subjects under a dot-segment and 1 beside it. ADR-010's guard then reported
correct rules as enforcing nothing, with a remedy that says to widen the selector
or declare it empty — so the honest way out of the false red was a fake green.

The root-relative view of a path was already tried, but only for a
project-relative glob, which made the anchored spelling the one spelling that
never got it. Every path glob now reads both views: the absolute path, and the
same path named from the project root. Two exclusions are kept deliberately — a
glob carrying a `./` or `../` segment, and `'*/x/**'` — because both are reported
as faults elsewhere and matching them here would make the tool contradict itself.

Four surfaces were reading the absolute path **only**, so this also fixes a
project-relative glob at each of them: the `resideInFile`/`resideInFolder`
**conditions** (which reported every subject as a violation rather than selecting
none), the `inconsistentSiblings` detector's `inFolder`/`ignorePaths`, and
`strictBoundaries`' `folders` and `shared` discovery.

`diskSet.classify` reads both views too. It is the one producer that states a fact
about the filesystem, and under a dot-segment it reported a directory that exists
and holds TypeScript as `absent`, whose advice says no such path was found.

**What you may see on upgrade.** If your project sits under a dot-directory, rules
that reported nothing now report; read the findings before regenerating a
baseline. If you spell a `shared` glob relative-to-the-root in `strictBoundaries`,
the `preset/boundaries/shared-discovery` finding that used to explain why it did
not work is gone, because it now works — an accepted baseline entry for it will be
unmatched.
