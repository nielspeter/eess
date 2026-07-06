# eess-mermaid — Class Diagram Grammar (formerly MermaidUnit)

This is the exact subset of Mermaid class-diagram syntax that MermaidUnit v0
accepts. Anything outside this spec produces a parse error of the form:

```
MermaidUnit dialect does not accept '<token>' at <file>:<line>:<col>
```

No silent partial parses. No best-effort fallback. Failing closed keeps the
surface honest.

---

## 1. Header

The diagram MUST start with the literal:

```
classDiagram
```

Optional `direction` modifier on the next line is **out of scope for v0**.

## 2. Comments

```
%% any text until end of line
```

Comments are preserved on AST nodes (so violation messages can quote them). A
comment beginning with `@<name>` is treated as a **directive** — see §7.

## 3. Class declarations

Two equivalent forms:

```
class Foo
class Foo {
  +field: Type
  -privateField: Type
  #protectedField
  ~packageField
  +method(arg: T) ReturnType
  -privateMethod()
  +abstractMethod()*
}
```

Visibility tokens accepted: `+` public, `-` private, `#` protected, `~` package.
Trailing `*` on a method = abstract. Trailing `$` on a method = static.

Members are optional. Member type annotations after `:` are optional.

**Out of scope v0:** generic type params (`Foo~T~`), default values, throws
clauses, multi-line method signatures.

## 4. Stereotypes

```
class Foo {
  <<interface>>
  +method()
}
```

OR shorthand:

```
class Foo
<<interface>> Foo
```

Stereotype names are free-form strings. Standard names recognized for built-in
rule libraries: `interface`, `abstract`, `service`, `repository`, `controller`,
`entity`, `valueObject`, `event`, `command`. Custom stereotypes are accepted
and validated by user rules.

## 5. Relationships

| Mermaid syntax                     | Meaning                          |
| ---------------------------------- | -------------------------------- |
| `Bar --\|> Foo` or `Foo <\|-- Bar` | Bar extends Foo (inheritance)    |
| `Bar ..\|> Foo` or `Foo <\|.. Bar` | Bar implements Foo (realization) |
| `Foo --> Bar`                      | Foo has association to Bar       |
| `Foo ..> Bar`                      | Foo depends on Bar (dashed)      |
| `Foo *-- Bar`                      | Foo composes Bar (composition)   |
| `Foo o-- Bar`                      | Foo aggregates Bar (aggregation) |
| `Foo -- Bar`                       | undirected link                  |

Optional cardinality and label:

```
Foo "1" --> "many" Bar : owns
```

Cardinality strings are preserved on the edge AST node. Labels after `:` are
preserved.

**Out of scope v0:** `lollipop` interface notation, mixed-direction arrows
beyond the table above.

## 6. Notes

```
note for Foo "free-form text"
note "free-floating note"
```

Notes are parsed and attached to their target class (or as floating). They are
ignored by validation but available to AI consumers via `explain`.

## 7. Directives — MermaidUnit extensions

Directives are comments beginning with `@`. Mermaid renders them as plain
comments; MermaidUnit treats them as first-class.

```
%% @schema ./arch.schema.ts
%% @stereotype service { allowedDeps: [repository, valueObject] }
%% @stereotype repository { forbiddenDeps: [controller, service] }
%% @id Foo stable-id-for-refactor-safety
```

Recognized v0 directives:

- `@schema <path>` — links the diagram to a TS schema module
- `@stereotype <name> { ... }` — declares semantics for a stereotype
- `@id <ClassName> <stable-id>` — assigns a refactor-safe identifier to a class

Unknown directives produce a **warning**, not an error, so users can prototype
new directives without blocking the parse. Unknown non-directive syntax
remains a hard error.

## 8. Whitespace and line endings

- LF and CRLF both accepted
- Indentation is significant only inside `{ ... }` blocks (purely cosmetic;
  parser ignores it)
- Tabs and spaces both accepted

## 9. Errors

Every error includes:

- File path
- Line and column
- The offending token
- Suggested fix when the error is a near-miss of accepted syntax

Examples:

```
MermaidUnit dialect does not accept 'graph' at arch.mmd:1:1
  hint: did you mean 'classDiagram'?

MermaidUnit dialect does not accept '~T~' at arch.mmd:4:8
  hint: generic type parameters are out of scope for v0
```

## 10. Hard limits for v0

- One diagram per file. Multiple `classDiagram` headers in one file = error.
- Class names must match `[A-Za-z_][A-Za-z0-9_]*`. Quoted class names out of scope.
- Edge syntax is positional: `<source> <arrow> <target>`. No multi-target on one line.

## 11. Explicitly out of scope (track for v0.x)

- Generic type parameters
- Multiple inheritance arrow types in one statement
- Diagram-level `direction TB` modifier
- `style` directives, `classDef` styling, click handlers
- Nested diagrams
- Other diagram types (sequence, state, ER, flowchart, C4) — separate dialects

---

**Reviewer checklist:**

- [ ] Header rule is acceptable (`classDiagram` only)
- [ ] Visibility/stereotype tokens cover real needs
- [ ] Relationship table covers the inheritance + dependency rules you want to validate
- [ ] Directive set (`@schema`, `@stereotype`, `@id`) is the right starting point
- [ ] Out-of-scope list doesn't block any v0 user story
