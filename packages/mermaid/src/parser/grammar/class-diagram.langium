grammar ClassDiagramGrammar

entry Diagram:
    {infer Diagram}
    'classDiagram'
    (
        classes+=ClassDef
        | stereotypeAssignments+=StereotypeAssignment
        | relationships+=Relationship
        | notes+=Note
        | directives+=Directive
    )*;

Note:
    'note' ('for' target=[ClassDef:ID])? text=STRING;

Directive:
    text=DIRECTIVE;

ClassDef:
    'class' name=ID
    ('{'
        (
            members+=ClassMember
            | stereotypes+=StereotypeMarker
        )*
    '}')?;

StereotypeAssignment:
    stereotype=StereotypeMarker classRef=[ClassDef:ID];

StereotypeMarker:
    '<<' name=ID '>>';

ClassMember:
    visibility=Visibility?
    name=ID
    (
        method?='(' (params+=Param (',' params+=Param)*)? ')' (returnType=ID)? (abstract?='*' | static?='$')?
        |
        (':' type=ID)?
    );

Param:
    name=ID (':' type=ID)?;

Relationship:
    lhs=[ClassDef:ID]
    (lhsCard=STRING)?
    arrow=Arrow
    (rhsCard=STRING)?
    rhs=[ClassDef:ID]
    (':' label=ID)?;

Arrow returns string:
    '<|--' | '<|..' | '--|>' | '..|>' | '-->' | '..>' | '*--' | 'o--' | '--';

Visibility returns string:
    '+' | '-' | '#' | '~';

terminal ID: /[A-Za-z_][A-Za-z0-9_]*/;
terminal STRING: /"[^"]*"/;
terminal DIRECTIVE: /%%[ \t]*@[^\n\r]*/;
hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /%%(?![ \t]*@)[^\n\r]*/;
