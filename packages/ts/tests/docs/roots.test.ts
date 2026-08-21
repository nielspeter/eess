/**
 * The root discovery in `tests/roots.ts` fails loudly, and that is now provable.
 *
 * [Bug 0179](../../../../work/bugs/fixed/0179-adopted-doc-tests-resolve-the-repo-root-one-level-short.md)
 * is about doc gates handed the wrong root: they read zero documents and pass,
 * which looks exactly like finding nothing wrong. `repoRoot` answers that by
 * throwing rather than guessing.
 *
 * That argument was made in a docstring over an inline IIFE, so no test could
 * reach it — an unfalsifiable claim about failing honestly, in the file whose
 * subject is unfalsifiable claims. Review caught it. The walk is a named export
 * now, and these rows are the break class.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findWorkspaceRoot, packageRoot, repoRoot } from '../roots.js'

describe('workspace-root discovery', () => {
  it('finds the monorepo root from this package', () => {
    // Non-vacuity for the row below: the happy path must actually resolve, or
    // "it throws when it cannot find one" is true for uninteresting reasons.
    expect(findWorkspaceRoot(packageRoot)).toBe(repoRoot)
    expect(fs.existsSync(path.join(repoRoot, 'package.json'))).toBe(true)
  })

  it('throws rather than guessing when no workspace manifest is above it', () => {
    // A temp dir under the OS root has no `workspaces` manifest anywhere above it,
    // so the walk runs to the filesystem root and must refuse. Returning a guess
    // here is precisely bug 0179: the caller would read an empty corpus and pass.
    const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'eess-roots-'))
    try {
      expect(() => findWorkspaceRoot(isolated)).toThrow(/no workspace root above/)
    } finally {
      fs.rmSync(isolated, { recursive: true, force: true })
    }
  })
})
