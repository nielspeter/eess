import type { OutputFormat } from '@nielspeter/eess'

export interface CliConfig {
  rules?: string[]
  format?: OutputFormat | 'auto'
  watchDirs?: string[]
}

export function defineConfig(config: CliConfig): CliConfig {
  return config
}
