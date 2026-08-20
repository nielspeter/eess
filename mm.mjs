import { Project } from 'ts-morph'
import { linesOfCode } from '/Users/nps/Documents/Projects/NielsPeter/eess/packages/ts/dist/helpers/complexity.js'
const p = new Project({ skipAddingFilesFromTsConfig: true })
p.addSourceFilesAtPaths(process.argv[2])
for (const sf of p.getSourceFiles())
  for (const c of sf.getClasses()) {
    if (c.getName() !== process.argv[3]) continue
    console.log(`${c.getName()}: ${linesOfCode(c)} code lines, ${c.getMethods().length} methods`)
    for (const m of c.getMethods())
      console.log(`   ${String(linesOfCode(m)).padStart(3)}  ${m.getName()}`)
  }
