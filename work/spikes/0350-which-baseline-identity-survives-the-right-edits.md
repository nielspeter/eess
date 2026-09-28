# Spike 0350: which baseline identity survives the right edits

Measured 2026-09-28 for
[bug 0338](../bugs/0338-a-match-with-no-enclosing-declaration-has-a-positional-identity.md).
**Filed because the table was cited as evidence in three records while its script
had been deleted** — method review of that work refused it on the repo's own
standard, correctly: an unreproducible measurement is a claim, whatever was
actually run.

## The question

A baseline identity has two duties that pull against each other. It must
**survive** an edit that does not change the finding, and **break** when the
finding changes. 0338's ruling — derived from the manifesto, ADR-009 Rule 3,
ADR-010 and `packages/core/src/violation.ts`'s slot-versus-reference paragraph —
rules out position and line. It does **not** say which form of reference to use.
That is what this measures.

## Method

Real `ts-morph` parsing, a real fixture rewritten in place so the file path is
constant, four candidate identity derivations computed over the actual matched
nodes, and seven edits applied one at a time. Each edit is labelled with whether
the identity **must** survive it.

The candidates:

| candidate  | derivation                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| `position` | what eess does today — an ordinal within `getElementName(node)::matcher`                                          |
| `line`     | the node's start line                                                                                             |
| `text`     | the matched node's source text, whitespace collapsed by regex                                                     |
| `shape`    | the node's **kind plus its leaf tokens' text**, joined — `CallExpression\|Identifier(eval)\|OpenParenToken(()\|…` |

The script, so the table can be rechecked. Drop it at
`packages/ts/tests/core/zz-identity-spike.test.ts`, run it, delete it:

```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import { Project, type Node } from 'ts-morph'

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'id-0338-'))
const root = fs.mkdtempSync(path.join(base, 'p-'))
fs.mkdirSync(path.join(root, 'src'), { recursive: true })
fs.writeFileSync(
  path.join(root, 'tsconfig.json'),
  JSON.stringify({ compilerOptions: { strict: true }, include: ['src'] }),
)
const tsConfigPath = path.join(root, 'tsconfig.json')

/** The node's shape: every token, formatting removed, string contents preserved. */
function canonical(node: Node): string {
  const parts: string[] = []
  const walk = (n: Node): void => {
    const kids = n.getChildren()
    if (kids.length === 0) {
      parts.push(`${n.getKindName()}(${n.getText()})`)
      return
    }
    parts.push(n.getKindName())
    for (const k of kids) walk(k)
  }
  walk(node)
  return parts.join('|')
}

function identify(body: string): Record<string, string[]> {
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), body)
  const tsm = new Project({ tsConfigFilePath: tsConfigPath })
  const sf = tsm.getSourceFiles()[0]!
  const found: Node[] = []
  sf.forEachDescendant((n) => {
    if (n.getKindName() === 'CallExpression' && n.getText().startsWith('eval(')) found.push(n)
  })
  const ord = new Map<string, number>()
  const bump = (k: string): number => {
    const n = (ord.get(k) ?? 0) + 1
    ord.set(k, n)
    return n
  }
  const out: Record<string, string[]> = { position: [], line: [], text: [], shape: [] }
  for (const n of found) {
    const text = n.getText().replace(/\s+/g, ' ').trim()
    out.position.push(`kind#${String(bump('pos'))}`)
    out.line.push(`line ${String(n.getStartLineNumber())}`)
    out.text.push(`text:${text}#${String(bump(`t:${text}`))}`)
    out.shape.push(`c:${canonical(n)}#${String(bump(`c:${canonical(n)}`))}`)
  }
  return out
}

const ORIGINAL = `eval('alpha')\nconst x = 1\neval('beta')\nexport const y = x\n`

/** [label, edited body, must the FIRST match keep its identity?] */
const EDITS: [string, string, boolean][] = [
  [
    'reformat (whitespace)',
    `eval(  'alpha'  )\nconst x = 1\neval('beta')\nexport const y = x\n`,
    true,
  ],
  [
    'insert a line above',
    `const z = 0\neval('alpha')\nconst x = 1\neval('beta')\nexport const y = x\n`,
    true,
  ],
  [
    'add a comment above',
    `// note\neval('alpha')\nconst x = 1\neval('beta')\nexport const y = x\n`,
    true,
  ],
  [
    'rename an unrelated binding',
    `eval('alpha')\nconst renamed = 1\neval('beta')\nexport const y = renamed\n`,
    true,
  ],
  ['move the match down', `const x = 1\neval('alpha')\neval('beta')\nexport const y = x\n`, true],
  [
    'CHANGE the matched code',
    `eval('CHANGED')\nconst x = 1\neval('beta')\nexport const y = x\n`,
    false,
  ],
  [
    'fix the first, add a new one',
    `const x = 1\neval('beta')\neval('gamma')\nexport const y = x\n`,
    false,
  ],
]

it('spike', () => {
  const before = identify(ORIGINAL)
  const keys = ['position', 'line', 'text', 'shape']
  for (const [label, body, mustSurvive] of EDITS) {
    const after = identify(body)
    const cells = keys.map((k) => {
      const survived = after[k]!.includes(before[k]![0]!)
      return `${k}=${survived ? 'kept' : 'broke'}${survived === mustSurvive ? '' : ' WRONG'}`
    })
    console.log(`${label} | must survive: ${String(mustSurvive)} | ${cells.join(' ')}`)
  }
  console.log(
    'twins:',
    JSON.stringify(identify(`eval(x)\nconst q = 1\neval(x)\nexport const r = q\n`).shape),
  )
  console.log(
    'space in string:',
    JSON.stringify(identify(`eval('a b')\nconst q = 1\neval('ab')\nexport const r = q\n`).shape),
  )
})
```

## Result

| edit                         | must survive? | position | line      | text      | **shape** |
| ---------------------------- | ------------- | -------- | --------- | --------- | --------- |
| reformat (whitespace)        | yes           | kept     | kept      | **broke** | kept      |
| insert a line above          | yes           | kept     | **broke** | kept      | kept      |
| add a comment above          | yes           | kept     | **broke** | kept      | kept      |
| rename an unrelated binding  | yes           | kept     | kept      | kept      | kept      |
| move the match down          | yes           | kept     | **broke** | kept      | kept      |
| **change the matched code**  | **no**        | **kept** | **kept**  | broke     | broke     |
| **fix the first, add a new** | **no**        | **kept** | broke     | broke     | broke     |
| **score**                    |               | **5/7**  | **3/7**   | **6/7**   | **7/7**   |

Two further observations from the same run:

- **Byte-identical twins** get the same shape and are separated by the ordinal:
  `…CallExpression|Identifier(eval)|…|Identifier(x)|…#1` and `#2`. That residue is
  correct — two identical matches are interchangeable, so no fact distinguishes
  them.
- **Whitespace inside a string is preserved**: `eval('a b')` and `eval('ab')`
  produce different shapes, both `#1`. This is why the shape is derived from the
  AST rather than from normalised source text, and it is the whole difference
  between the `text` and `shape` columns — a whitespace regex cannot tell code from
  string contents, which is the one edit `text` fails.

## What this does and does not establish

**Establishes:** among these four, the node's shape is the only derivation that
satisfies both duties on every edit tried.

**Does not establish:** that shape is the _only_ form that would. The documents
require a producer identity rather than a coordinate; a different derivation
scoring 7/7 would satisfy them equally. Two candidates here (`text`, `shape`) exist
in no shipped code — this measures proposed derivations, not the tree.

**Does not measure** the key's length, or whether embedding ts-morph's kind names
couples an adopter's baseline to a ts-morph upgrade. Both are open in
[plan 0346](../plans/0346-a-finding-is-identified-by-the-code-it-matched.md)
Phase 1.
