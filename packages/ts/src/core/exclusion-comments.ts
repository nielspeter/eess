import {
  parseExclusionComments as parseShared,
  isExcludedByComment as isExcludedShared,
} from '@nielspeter/eess'
import type { ExclusionComment, ExclusionWarning, ParseResult } from '@nielspeter/eess'
import { maskTsLiterals } from './ts-comment-mask.js'

/**
 * Exclusion comments for `eess-ts` — the kernel's parser, with this dialect's
 * lexer.
 *
 * **This file used to be a second parser** (426 lines), and it drifted: bug
 * 0158's fix landed on the kernel copy and never reached here, so a bare
 * `eess-exclude-start` was silent in `eess-ts` and blamed the `-end` line when it
 * did speak. That is bug 0227, and it is why ADR-012 exists.
 *
 * What was ever this package's own is the masker — knowing which spans of a
 * `.ts` file are string literals needs a TypeScript parser, and the kernel
 * cannot have one. That is now the only thing passed across.
 */
export type { ExclusionComment, ExclusionWarning, ParseResult }

export function parseExclusionComments(sourceText: string, filePath: string): ParseResult {
  return parseShared(sourceText, filePath, { mask: maskTsLiterals })
}

export const isExcludedByComment = isExcludedShared
