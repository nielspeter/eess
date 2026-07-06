import { diagram, classes } from '../../../src/index.js'

const d = diagram(
  [
    'classDiagram',
    'class FooService',
    '<<service>> FooService',
    'class BarRepo',
    '<<repository>> BarRepo',
    'BarRepo <|-- FooService',
  ].join('\n'),
)

export default [
  classes(d).that().haveStereotype('service').should().notExtendStereotype('repository').rule({
    id: 'arch/no-service-from-repo',
    because: 'Services may depend on repositories, never inherit from them',
  }),
]
