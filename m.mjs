import { workspace } from '/Users/nps/Documents/Projects/NielsPeter/eess/packages/ts/dist/index.js'
import { linesOfCode } from '/Users/nps/Documents/Projects/NielsPeter/eess/packages/ts/dist/helpers/complexity.js'
const p = workspace([
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/core/tsconfig.build.json',
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/ts/tsconfig.build.json',
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/mermaid/tsconfig.build.json',
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/md/tsconfig.build.json',
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/gherkin/tsconfig.build.json',
  '/Users/nps/Documents/Projects/NielsPeter/eess/packages/crossvalidate/tsconfig.build.json',
])
const GEN = /\/parser\/generated\//
const files = p
  .getSourceFiles()
  .filter((sf) => sf.getFilePath().includes('/src/') && !GEN.test(sf.getFilePath()))
const classes = files.flatMap((sf) => sf.getClasses())
const over = classes
  .map((c) => ({ c, loc: linesOfCode(c) }))
  .filter((r) => r.loc > 150)
  .sort((a, b) => b.loc - a.loc)
console.log('CLASSES > 150:', over.length)
for (const r of over)
  console.log(
    `   ${String(r.loc).padStart(4)}  ${r.c.getName()}  (${r.c.getSourceFile().getFilePath().split('/packages/')[1]})`,
  )
const m = classes
  .flatMap((c) => c.getMethods().map((x) => ({ x, o: c.getName() })))
  .map((r) => ({ ...r, loc: linesOfCode(r.x) }))
  .filter((r) => r.loc > 30)
  .sort((a, b) => b.loc - a.loc)
console.log('METHODS > 30:', m.length)
for (const r of m) console.log(`   ${String(r.loc).padStart(4)}  ${r.o}.${r.x.getName()}`)
