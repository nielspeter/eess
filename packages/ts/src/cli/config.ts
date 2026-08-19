import type { OutputFormat } from '@nielspeter/eess'

export interface CliConfig {
  /** Path to tsconfig.json. Default: 'tsconfig.json' */
  project?: string
  /** Rule files to load. Default: discovered via glob */
  rules?: string[]
  /** Baseline file path */
  baseline?: string
  /** Output format. 'auto' uses detectFormat() */
  format?: OutputFormat | 'auto'
  /** Directories to watch in --watch mode. Default: ['src'] */
  watchDirs?: string[]
}

/**
 * Define a CLI configuration with type safety.
 *
 * @example
 * ```ts
 * // eess-ts.config.ts
 * import { defineConfig } from '@nielspeter/eess-ts'
 *
 * export default defineConfig({
 *   project: 'tsconfig.json',
 *   rules: ['arch.rules.ts'],
 *   baseline: 'arch-baseline.json',
 *   format: 'auto',
 * })
 * ```
 */
export function defineConfig(config: CliConfig): CliConfig {
  return config
}
