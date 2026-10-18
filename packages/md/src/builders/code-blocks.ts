import {
  ArchConfigError,
  RuleBuilder,
  collectResult,
  type ArchViolation,
  type CollectResult,
  type Condition,
} from '@nielspeter/eess'
import {
  isParsedCodeBlocks,
  type ParsedCodeBlock,
  type ParsedCodeBlocks,
} from '../model/code-block-parse.js'
import { resideInFile, resideInFolder } from '../predicates/document.js'
import { liftToDocument, scopeDiagnosis } from '../predicates/in-documents.js'
import { mdViolation } from '../model/violation.js'
import type { SelectorFault } from '@nielspeter/eess/internal'
import { mdNotExist } from '../conditions/not-exist.js'
import { mdSelectorFault } from './selector-fault.js'

/** The instrument's identity: one constant, so several rules over one failed parse dedupe to one. */
export const CODE_BLOCK_PARSER_INSTRUMENT = 'eess-md: code-block parser'

function bodyLineCount(value: string): number {
  return value === '' ? 0 : value.split('\n').length
}

/** Condition: every selected block's verdict is `valid`. */
function parse(parsed: ParsedCodeBlocks): Condition<ParsedCodeBlock> {
  const by = `${parsed.parser.name} ${parsed.parser.version}`
  return {
    description: `parse with ${by}`,
    evaluate: (elements, ctx) =>
      elements.flatMap((e): ArchViolation[] => {
        const v = e.verdict
        // No verdict is never a pass: it exists only beside a failure, which the builder reports.
        // `parseCodeBlocks` guarantees that pairing by construction (every path yields one verdict
        // per text or a failure), so no second check here: one that can never fire proves nothing.
        if (v === null || v.outcome === 'valid') return []
        const where = `${e.doc.relPath}:${String(e.block.line)}`
        if (v.outcome === 'unrecognised') {
          return [
            {
              ...mdViolation({
                element: where,
                file: e.doc.file,
                line: e.block.line,
                message: `${by} does not recognise this \`${parsed.language}\` block: ${v.message}`,
                sourceText: e.doc.text,
                context: ctx,
              }),
              suggestion: v.remedy,
            },
          ]
        }
        const lines = bodyLineCount(e.block.value)
        const inner = v.line
        const inside = inner !== null && inner >= 1 && inner <= lines
        const line = inside ? e.block.line + inner : e.block.line
        const note = inside
          ? ''
          : inner === null
            ? ' (the line inside the block is unknown)'
            : ` (the parser gave line ${String(inner)} for a ${String(lines)}-line block)`
        return [
          {
            ...mdViolation({
              element: where,
              file: e.doc.file,
              line,
              message: `this \`${parsed.language}\` block does not parse with ${by}: ${v.message}${note}`,
              sourceText: e.doc.text,
              context: ctx,
            }),
            suggestion: v.remedy,
          },
        ]
      }),
  }
}

/**
 * Rule builder over the blocks `parseCodeBlocks` parsed. Its elements are the parsed set, so a
 * predicate can only narrow what a parser saw, never select a block no parser saw.
 *
 * No rule surface here is async: the parse happens once in `parseCodeBlocks`, and this builder reads
 * its facts synchronously (plan 0412; an async `check()` would need an ADR).
 */
export class CodeBlockRuleBuilder extends RuleBuilder<ParsedCodeBlock, ParsedCodeBlocks> {
  constructor(parsed: ParsedCodeBlocks) {
    super(parsed)
    if (!isParsedCodeBlocks(parsed)) {
      throw new ArchConfigError(
        'codeBlocks',
        "codeBlocks() takes the object this copy of eess-md's parseCodeBlocks() returned. A " +
          'hand-built object would let any verdict through unchecked. If you built it with ' +
          'parseCodeBlocks, two copies of @nielspeter/eess-md are installed; dedupe them.',
      )
    }
  }

  protected getElements(): ParsedCodeBlock[] {
    return [...this.project.blocks]
  }

  /** No Markdown file loaded at all outranks everything, `.expectEmpty()` included (ADR-010). */
  protected override sourceEmpty(): boolean {
    return this.project.documentsLoaded === 0
  }

  /**
   * Bug 0460: the glob text only. `ParsedCodeBlocks` carries no file index, so
   * the unloaded-Markdown and separator checks cannot run here.
   */
  protected override cardinalitySelectorFault(): SelectorFault | undefined {
    return mdSelectorFault(this.globs(), undefined)
  }

  /**
   * Plan 0457: a positive rule emptied by an `inDocuments` scope names it, counted against every
   * document the corpus loaded, not only those holding a block of the language.
   */
  protected override deadGlobDiagnosis(): string | undefined {
    return scopeDiagnosis(this._predicates, this.getElements(), this.project.documents, 'blocks')
  }

  /** The kernel's verdict, plus the instrument finding once per rule when the parser failed. */
  protected override collectViolations(): CollectResult {
    const base = super.collectViolations()
    const failure = this.project.failure
    if (failure === null) return base
    const { name, version } = this.project.parser
    const instrument: ArchViolation = {
      rule: CODE_BLOCK_PARSER_INSTRUMENT,
      ruleId: CODE_BLOCK_PARSER_INSTRUMENT,
      element: `${name}@${version}`,
      file: '',
      line: 0,
      message:
        `the ${this.project.language} blocks were not checked: ${failure.cause.replace(/\.$/, '')}. No block of the ` +
        `language has a verdict, so this rule cannot pass.`,
      suggestion: failure.remedy,
      bypassFilters: true,
    }
    // The kernel's evidence, passed through whole, so no field it adds later can be dropped here.
    return collectResult([...base, instrument], base)
  }

  /** Filter to blocks in documents whose repo-relative path matches the file glob. */
  resideInFile(glob: string): this {
    const p = resideInFile(glob)
    return this.addPredicate(liftToDocument<ParsedCodeBlock>(p, p.description))
  }

  /** Filter to blocks in documents whose repo-relative path matches the folder glob. */
  resideInFolder(glob: string): this {
    const p = resideInFolder(glob)
    return this.addPredicate(liftToDocument<ParsedCodeBlock>(p, p.description))
  }

  /** The selection must be empty: each selected block is a finding, at its opening fence. */
  notExist(): this {
    return this.addCondition(
      mdNotExist((b: ParsedCodeBlock) => ({
        doc: b.doc,
        line: b.block.line,
        name: `${b.doc.relPath}:${String(b.block.line)}`,
      })),
    )
  }

  /** Assert every selected block parses: an `invalid` or `unrecognised` verdict is a finding. */
  parse(): this {
    return this.addCondition(parse(this.project))
  }
}

/**
 * Entry point: rules over the code blocks one `parseCodeBlocks` call parsed.
 *
 * ```ts
 * const parsed = await parseCodeBlocks(corpus, { language: 'mermaid', parser })
 * codeBlocks(parsed).should().parse().check()
 * ```
 */
export function codeBlocks(parsed: ParsedCodeBlocks): CodeBlockRuleBuilder {
  return new CodeBlockRuleBuilder(parsed)
}
