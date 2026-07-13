grammar ErDiagramGrammar

entry ErDiagram:
    {infer ErDiagram}
    'erDiagram'
    (
        entities+=ErEntityDef
        | relationships+=ErRelationship
        | notes+=ErNote
    )*;

ErNote:
    'note' ('for' target=ID)? text=STRING;

// An entity block. Mermaid also declares entities *implicitly* as relationship
// endpoints — that union is assembled by the model layer, not the grammar.
ErEntityDef:
    name=ID
    ('{'
        attributes+=ErAttribute*
    '}')?;

// `type name PK, FK "comment"` — types/names are IDs; keys and the trailing
// quoted comment are optional, per the Mermaid ER attribute syntax.
ErAttribute:
    type=ID name=ID (keys+=ErKey (',' keys+=ErKey)*)? (comment=STRING)?;

ErKey returns string:
    'PK' | 'FK' | 'UK';

// Endpoints are plain names (not cross-references): Mermaid allows
// relationship-only diagrams where no entity block exists.
ErRelationship:
    lhs=ID cardinality=CARDINALITY rhs=ID (':' label=(ID | STRING))?;

// ||--o{ and friends: zero/one/many markers on both ends, identifying (--)
// or non-identifying (..) line.
terminal CARDINALITY: /(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)/;
terminal ID: /[A-Za-z_][A-Za-z0-9_-]*/;
terminal STRING: /"[^"]*"/;
hidden terminal WS: /\s+/;
hidden terminal SL_COMMENT: /%%[^\n\r]*/;
