import { describe, it, expect } from 'vitest'
import type { PathUniverse, GlobSite, DiskSet } from '@nielspeter/eess'
import {
  syntacticFault,
  diagnoseGlob,
  FAULT_ADVICE,
  ON_DISK_ADVICE,
} from '../../src/core/glob-diagnosis.js'

const universe: PathUniverse = {
  filePaths: ['/root/src/domain/user.ts'],
  parentDirs: ['/root/src/domain'],
  tsconfigRelativeFilePaths: ['src/domain/user.ts'],
  tsconfigRelativeParentDirs: ['src/domain'],
}

function site(glob: string, kind: GlobSite['kind'], base?: GlobSite['base']): GlobSite {
  return { glob, kind, base, position: 'selector', origin: 'test' }
}

describe('syntacticFault', () => {
  it('a "./" anywhere in the glob is dot-segment, for every base', () => {
    expect(syntacticFault('./src/**', 'file-path')).toBe('dot-segment')
    expect(syntacticFault('**/./src/**', 'file-path', 'tsconfig-relative')).toBe('dot-segment')
  })

  it('an unanchored path-kind glob at base "absolute" is unanchored', () => {
    expect(syntacticFault('src/domain/**', 'file-path')).toBe('unanchored')
  })

  it('a non-path kind is exempt from the anchor check', () => {
    expect(syntacticFault('fastify', 'specifier')).toBeUndefined()
  })

  it('a non-absolute base is exempt from the anchor check', () => {
    expect(syntacticFault('src/domain/**', 'file-path', 'tsconfig-relative')).toBeUndefined()
  })

  it('an anchored, dot-free glob has no syntactic fault', () => {
    expect(syntacticFault('**/src/domain/**', 'file-path')).toBeUndefined()
  })
})

describe('diagnoseGlob', () => {
  it('reports the syntactic fault first, without touching disk or the universe', () => {
    const diskSet: DiskSet = {
      classify: () => {
        throw new Error('must not be called for a syntactic fault')
      },
    }
    const diag = diagnoseGlob(site('./src/**', 'file-path'), universe, diskSet)
    expect(diag).toEqual({ fault: 'dot-segment' })
  })

  it('a parent-dir glob matching a FILE and no directory is file-not-folder', () => {
    const diag = diagnoseGlob(site('**/user.ts', 'parent-dir'), universe)
    expect(diag).toEqual({ fault: 'file-not-folder' })
  })

  it('a file-path glob matching a directory and no file is file-not-folder', () => {
    const diag = diagnoseGlob(site('**/domain', 'file-path'), universe)
    expect(diag).toEqual({ fault: 'file-not-folder' })
  })

  it('anchored, well-formed, matches nothing → no-match, classified by the disk set', () => {
    const diskSet: DiskSet = { classify: () => 'holds-typescript' }
    const diag = diagnoseGlob(site('**/ghost/**', 'file-path'), universe, diskSet)
    expect(diag).toEqual({ fault: 'no-match', onDisk: 'holds-typescript' })
  })

  it('no-match with no disk set supplied defaults onDisk to not-determined', () => {
    const diag = diagnoseGlob(site('**/ghost/**', 'file-path'), universe)
    expect(diag).toEqual({ fault: 'no-match', onDisk: 'not-determined' })
  })
})

describe('FAULT_ADVICE / ON_DISK_ADVICE — every enum value has an entry', () => {
  it('every GlobFault has advice text', () => {
    const faults: (keyof typeof FAULT_ADVICE)[] = [
      'dot-segment',
      'unanchored',
      'file-not-folder',
      'no-match',
    ]
    for (const fault of faults) expect(FAULT_ADVICE[fault].length).toBeGreaterThan(0)
  })

  it('every OnDisk classification has an entry (not-determined is deliberately empty)', () => {
    expect(ON_DISK_ADVICE['holds-typescript'].length).toBeGreaterThan(0)
    expect(ON_DISK_ADVICE['no-typescript'].length).toBeGreaterThan(0)
    expect(ON_DISK_ADVICE.absent.length).toBeGreaterThan(0)
    expect(ON_DISK_ADVICE['not-determined']).toBe('')
  })
})
