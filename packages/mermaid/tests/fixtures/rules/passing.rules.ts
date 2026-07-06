import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagram, classes } from '../../../src/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const d = diagram(path.resolve(here, '../classes/layered.mmd'))

export default [
  classes(d).that().haveStereotype('service').should().extend('BaseService').rule({
    id: 'arch/services-extend-base',
    because: 'Every service must inherit shared behavior',
    suggestion: 'Extend BaseService',
  }),
  classes(d).that().haveStereotype('service').should().notExtendStereotype('repository').rule({
    id: 'arch/no-service-from-repo',
    because: 'Services may depend on repositories, never inherit from them',
  }),
]
