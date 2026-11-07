import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { classes, project } from '../src/index.js'

// Spike 0640 (bug 0477): eess-ts's select() carries "the project loaded no source file" with the
// side, so a correspondence over it reports the empty source instead of joining nothing.
const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('select() carries an empty project (spike 0640)', () => {
  it('over a project that loaded no source file, the side says its source is empty', () => {
    const p = project(join(fixtures, 'empty-project/tsconfig.json'))
    expect(p.getSourceFiles()).toHaveLength(0)
    const side = classes(p).select({
      label: 'class',
      identify: (c) => ({ name: c.getName() ?? '' }),
    })
    expect(side.sourceEmpty).toBe(true)
  })

  it('CONTROL: over a project that loaded files, it says nothing, even when it selects nothing', () => {
    const p = project(join(fixtures, 'vacuity-nonempty/tsconfig.json'))
    expect(p.getSourceFiles().length).toBeGreaterThan(0)
    const side = classes(p)
      .that()
      .haveNameMatching(/^NoSuchClass$/)
      .select({ label: 'class', identify: (c) => ({ name: c.getName() ?? '' }) })
    expect(side.elements).toHaveLength(0)
    expect('sourceEmpty' in side).toBe(false)
  })
})
