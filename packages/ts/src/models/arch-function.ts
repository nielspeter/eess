import { ArchConfigError } from '@nielspeter/eess'
import {
  type ClassDeclaration,
  type ClassExpression,
  type ModuleDeclaration,
  type ConstructorDeclaration,
  type FunctionDeclaration,
  type GetAccessorDeclaration,
  type PropertyDeclaration,
  type SetAccessorDeclaration,
  type VariableDeclaration,
  type MethodDeclaration,
  type ArrowFunction,
  type FunctionExpression,
  type SourceFile,
  type ParameterDeclaration,
  type Type,
  type Node,
  Node as NodeClass,
  Scope,
  SyntaxKind,
} from 'ts-morph'
import { collectObjectLiteralFunctions } from '../core/object-literal-functions.js'
import { throughWrappers } from '../core/through-wrappers.js'

/**
 * Unified representation of a TypeScript function.
 *
 * Wraps every function `collectFunctions` collects: a FunctionDeclaration (`function foo() {}`), a
 * VariableDeclaration holding a function (`const foo = () => {}`), a class member — a method, the
 * constructor, an accessor or a property holding a function (bug 0315) — or, when asked, a function
 * value in an object literal. {@link functionKindOf} says which.
 *
 * Satisfies Named, Located, and Exportable interfaces from identity predicates.
 */
export interface ArchFunction {
  /** Function name, or undefined for anonymous functions. */
  getName(): string | undefined

  /** Source file containing this function. */
  getSourceFile(): SourceFile

  /** Whether this function is exported from its module. */
  isExported(): boolean

  /** Whether this function is declared async. */
  isAsync(): boolean

  /** Parameter declarations of this function. */
  getParameters(): ParameterDeclaration[]

  /** Return type of this function (resolved by the type checker). */
  getReturnType(): Type

  /** Function body node, for body analysis (plan 0011). */
  getBody(): Node | undefined

  /**
   * Underlying ts-morph node for violation reporting: the FunctionDeclaration, the
   * VariableDeclaration, the class member's declaration (method, constructor, accessor or property),
   * or an object-literal function itself.
   */
  getNode(): Node

  /**
   * Start line number in the source file.
   * Used for violation reporting.
   */
  getStartLineNumber(): number

  /**
   * Visibility scope of this function.
   *
   * - Standalone functions and arrow functions are always `'public'` (module-level).
   * - Class members return their actual modifier (`public`, `protected`, or `private`).
   *   A member with no explicit modifier defaults to `'public'`.
   */
  getScope(): 'public' | 'protected' | 'private'
}

/**
 * Wrap a callable node as an `ArchFunction`, taking its name from the caller.
 *
 * Four adapters wrote this object out by hand — `fromArrowExpression`,
 * `fromFunctionExpression` and `fromMethodDeclaration` in
 * `helpers/callback-extractor.ts`, plus the object-literal branch below —
 * which `no-copy-paste` reported at 100%. Every field but the name reads the
 * same way off any of the three node kinds, and `getName` is the caller's
 * because only the caller knows: a callback argument is anonymous, a function
 * expression may name itself, and an object-literal value is named by its
 * property-key path.
 *
 * `isExported: false` and `getScope: 'public'` are facts about this shape
 * rather than defaults: none of these nodes is a declaration that `export` can
 * precede, and none carries an access modifier. Reading them off the node
 * would return the enclosing declaration's answer, which is a different
 * subject from the one the violation names.
 */
export function fromCallableNode(
  node:
    | ArrowFunction
    | FunctionExpression
    | MethodDeclaration
    | GetAccessorDeclaration
    | SetAccessorDeclaration,
  getName: () => string | undefined,
): ArchFunction {
  return {
    getName,
    getSourceFile: () => node.getSourceFile(),
    isExported: () => false,
    // An accessor cannot be `async`, and ts-morph gives it no `isAsync` to ask (bug 0321).
    isAsync: () =>
      NodeClass.isGetAccessorDeclaration(node) || NodeClass.isSetAccessorDeclaration(node)
        ? false
        : node.isAsync(),
    getParameters: () => node.getParameters(),
    getReturnType: () => node.getReturnType(),
    getBody: () => node.getBody(),
    getNode: () => node,
    getScope: () => 'public',
    getStartLineNumber: () => node.getStartLineNumber(),
  }
}

/**
 * Create an ArchFunction from a FunctionDeclaration.
 */
export function fromFunctionDeclaration(decl: FunctionDeclaration): ArchFunction {
  return {
    getName: () => decl.getName(),
    getSourceFile: () => decl.getSourceFile(),
    isExported: () => decl.isExported(),
    isAsync: () => decl.isAsync(),
    getParameters: () => decl.getParameters(),
    getReturnType: () => decl.getReturnType(),
    getBody: () => decl.getBody(),
    getNode: () => decl,
    getStartLineNumber: () => decl.getStartLineNumber(),
    getScope: () => 'public',
  }
}

/**
 * Create an ArchFunction from a VariableDeclaration whose initializer is a function — an arrow
 * function or a function expression, directly or behind parentheses, `as`, `<T>`, `satisfies` or `!`
 * (bug 0315).
 *
 * Precondition: caller must verify the initializer is one, with {@link functionValueOf}.
 */
export function fromFunctionInitializerDeclaration(decl: VariableDeclaration): ArchFunction {
  const arrow = functionValueOf(decl.getInitializer())
  if (!arrow)
    throw new ArchConfigError(
      'fromFunctionInitializerDeclaration',
      'Expected an arrow function or function expression initializer',
    )
  return {
    getName: () => decl.getName(),
    getSourceFile: () => decl.getSourceFile(),
    isExported: () => {
      // VariableDeclaration itself doesn't have isExported —
      // check the parent VariableStatement.
      const varStatement = decl.getVariableStatement()
      return varStatement?.isExported() ?? false
    },
    isAsync: () => arrow.isAsync(),
    getParameters: () => arrow.getParameters(),
    getReturnType: () => arrow.getReturnType(),
    getBody: () => arrow.getBody(),
    getNode: () => decl,
    getStartLineNumber: () => decl.getStartLineNumber(),
    getScope: () => 'public',
  }
}

/**
 * Create an ArchFunction from a class MethodDeclaration.
 *
 * Method name is prefixed with the class name for clarity in violation messages:
 * "Space.getWebhooks" instead of just "getWebhooks".
 */
export function fromMethodDeclaration(method: MethodDeclaration): ArchFunction {
  const parent = method.getParent()
  const className =
    NodeClass.isClassDeclaration(parent) || NodeClass.isClassExpression(parent)
      ? classNameOf(parent)
      : '<anonymous>'
  return {
    getName: () => {
      const methodName = method.getName()
      return `${className}.${methodName}`
    },
    getSourceFile: () => method.getSourceFile(),
    isExported: () => {
      // A method is "exported" if its class is exported (ADR-005: use type guard)
      const cls = method.getParent()
      if (NodeClass.isClassDeclaration(cls)) {
        return cls.isExported()
      }
      return false
    },
    isAsync: () => method.isAsync(),
    getParameters: () => method.getParameters(),
    getReturnType: () => method.getReturnType(),
    getBody: () => method.getBody(),
    getNode: () => method,
    getStartLineNumber: () => method.getStartLineNumber(),
    getScope: () => accessOf(method.getScope()),
  }
}

/**
 * What an `ArchFunction` is (bug 0315): `'function'` — a function declaration, a variable holding a
 * function, or a function value in an object literal; `'method'` — of a class, or an object literal's
 * shorthand; `'constructor'`; `'getter'`; `'setter'`; or `'property'` — a class property whose value
 * is a function.
 */
export type FunctionKind = 'function' | 'method' | 'constructor' | 'getter' | 'setter' | 'property'

/** The kind of function an `ArchFunction` is, read off the node it reports at. */
export function functionKindOf(fn: ArchFunction): FunctionKind {
  const node = fn.getNode()
  if (NodeClass.isMethodDeclaration(node)) return 'method'
  if (NodeClass.isConstructorDeclaration(node)) return 'constructor'
  if (NodeClass.isGetAccessorDeclaration(node)) return 'getter'
  if (NodeClass.isSetAccessorDeclaration(node)) return 'setter'
  if (NodeClass.isPropertyDeclaration(node)) return 'property'
  return 'function'
}

/** A member's access modifier as an `ArchFunction` reports it; no modifier is `'public'`. */
function accessOf(scope: Scope): 'public' | 'protected' | 'private' {
  if (scope === Scope.Protected) return 'protected'
  if (scope === Scope.Private) return 'private'
  return 'public'
}

/**
 * The function a node holds, read through the wrappers that leave it unchanged at run time —
 * parentheses, `as`, `<T>`, `satisfies` and `!` — or `undefined` when it holds something else.
 * A variable's initializer and a class property's value are read this way (bugs 0306, 0315).
 */
export function functionValueOf(
  node: Node | undefined,
): ArrowFunction | FunctionExpression | undefined {
  const current = throughWrappers(node)
  return NodeClass.isArrowFunction(current) || NodeClass.isFunctionExpression(current)
    ? current
    : undefined
}

/**
 * A class member that is a function but not a method, as an `ArchFunction` (bug 0315): the
 * constructor, an accessor, or a property whose value is a function. Named by its class, as a method
 * is; reported at the member, and read through `fn` — the member itself, or the property's function.
 */
function fromClassMember(
  cls: ClassDeclaration | ClassExpression,
  member:
    | ConstructorDeclaration
    | GetAccessorDeclaration
    | SetAccessorDeclaration
    | PropertyDeclaration,
  name: string,
  fn:
    | ConstructorDeclaration
    | GetAccessorDeclaration
    | SetAccessorDeclaration
    | ArrowFunction
    | FunctionExpression,
): ArchFunction {
  const className = classNameOf(cls)
  return {
    getName: () => `${className}.${name}`,
    getSourceFile: () => member.getSourceFile(),
    isExported: () => (NodeClass.isClassDeclaration(cls) ? cls.isExported() : false),
    isAsync: () =>
      NodeClass.isArrowFunction(fn) || NodeClass.isFunctionExpression(fn) ? fn.isAsync() : false,
    getParameters: () => fn.getParameters(),
    getReturnType: () => fn.getReturnType(),
    getBody: () => fn.getBody(),
    getNode: () => member,
    getStartLineNumber: () => member.getStartLineNumber(),
    getScope: () => accessOf(member.getScope()),
  }
}

/**
 * The class's function members other than its methods. The constructor with a body, as
 * `Class.constructor` — ts-morph lists an overloaded constructor by its implementation alone, and an
 * ambient class's constructor has no body. Each accessor as `Class.get x` or `Class.set x`: a
 * getter and its setter share a name, and a metric's identity keys on the function's name. Each
 * property whose value is a function, as `Class.handler`.
 */
/**
 * The name a class's members are reported under: the class's own, else the binding that holds it —
 * `const Expr = class { m() {} }` reports `Expr.m` — else `<anonymous>`, as a default-exported
 * class's members have read since bug 0315.
 */
function classNameOf(cls: ClassDeclaration | ClassExpression): string {
  return cls.getName() ?? owningBindingName(cls) ?? '<anonymous>'
}

function classMemberFunctions(cls: ClassDeclaration | ClassExpression): ArchFunction[] {
  const members: ArchFunction[] = []
  for (const ctor of cls.getConstructors()) {
    if (ctor.getBody() !== undefined) members.push(fromClassMember(cls, ctor, 'constructor', ctor))
  }
  for (const getter of cls.getGetAccessors()) {
    members.push(fromClassMember(cls, getter, `get ${getter.getName()}`, getter))
  }
  for (const setter of cls.getSetAccessors()) {
    members.push(fromClassMember(cls, setter, `set ${setter.getName()}`, setter))
  }
  for (const property of cls.getProperties()) {
    const value = functionValueOf(property.getInitializer())
    if (value !== undefined) members.push(fromClassMember(cls, property, property.getName(), value))
  }
  return members
}

/**
 * Options for {@link collectFunctions} / the `functions()` entry point.
 *
 * A named declaration is collected by default — a function, a variable holding a function, and a class
 * member (bug 0315) — because each is a subject a rule is written about. An anonymous function value in
 * an object literal is opt-in (proposal 016), because collecting every inline callback would flood every
 * rule with subjects nobody named.
 */
// eess-exclude eess/no-unused-exports: re-exported from `src/index.ts`; this gate does not count a barrel `export … from` re-export as usage — see work/bugs/0168
export interface FunctionCollectionOptions {
  /**
   * Include class members (pattern 3): methods, the constructor, accessors and function-valued
   * properties. Default: `true`.
   */
  includeMethods?: boolean
  /**
   * Include object-literal function property values — arrows, function
   * expressions, and method shorthand (`{ GET: () => {} }`, `{ GET(){} }`).
   * Default: `false`. Opt-in because it widens the "named unit" default set
   * (proposal 016). Each is named by its qualified property-key path.
   */
  includeObjectLiteralFunctions?: boolean
}

/**
 * Scan a source file for functions.
 *
 * Returns ArchFunction wrappers for these *named* shapes by default:
 * 1. FunctionDeclarations — `function foo() {}`
 * 2. VariableDeclarations whose initializer is a function — `const foo = () => {}`, also behind
 *    parentheses, `as`, `<T>`, `satisfies` or `!`
 * 3. Class members, when includeMethods is true — methods (`Foo.bar`), the constructor
 *    (`Foo.constructor`), accessors (`Foo.get x`, `Foo.set x`) and function-valued properties
 *    (`Foo.handler`)
 *
 * Plus, when `includeObjectLiteralFunctions` is set (default off):
 * 4. Object-literal function property values (arrows / function expressions /
 *    method shorthand), named by their qualified property-key path.
 *
 * @param sourceFile - The source file to scan
 * @param options - {@link FunctionCollectionOptions}
 */
export function collectFunctions(
  sourceFile: SourceFile,
  options?: FunctionCollectionOptions,
): ArchFunction[] {
  const includeMethods = options?.includeMethods ?? true
  const includeObjectLiteralFunctions = options?.includeObjectLiteralFunctions ?? false
  const functions: ArchFunction[] = []

  // Patterns 1 to 3 run over the file AND over every namespace body in it (bug 0321). A namespace
  // is a scope that holds the same declarations a file does, and `getFunctions()`,
  // `getVariableDeclarations()` and `getClasses()` answer only for the node they are asked. So
  // `export namespace N { export function g() { eval('…') } }` — an ordinary function, in an
  // ordinary place — reached no function rule at all, and the `recommended` floor with it.
  //
  // A namespace inside a FUNCTION is left out: everything in it is already part of that function's
  // body, and collecting it again would report one `eval` twice.
  collectFromScope(sourceFile, functions, includeMethods)
  for (const namespace of namespaceScopes(sourceFile)) {
    // Qualified by the namespace path — `N.Inner.m`, not `Inner.m`. Two namespaces in one file may
    // hold a class of the same name, and an unqualified name would make the violation ambiguous,
    // `.excluding()` hit both, and one accepted finding silently accept the other — bug 0010's
    // collision, which the object-literal collection already prefixes against.
    const prefix = namespacePathOf(namespace)
    const collected: ArchFunction[] = []
    collectFromScope(namespace, collected, includeMethods)
    functions.push(...collected.map((fn) => qualifiedBy(prefix, fn)))
  }

  // Pattern 4: object-literal function property values (opt-in, proposal 016).
  // Collect from top-level object literals only; the shared traversal recurses
  // into nested ones, so each function is collected exactly once.
  if (includeObjectLiteralFunctions) {
    const roots = sourceFile
      .getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)
      .filter((objectLiteral) => !isNestedInObjectLiteral(objectLiteral))
    for (const root of roots) {
      // Prefix the binding that owns the literal, so two object literals in one
      // file that share a key name (`routeA.handler` and `routeB.handler`) are
      // distinguishable. Without it both are just `handler`: the rendered
      // violation is ambiguous, `.excluding('handler')` hits both, and — since
      // duplicate-pair identity is built from these names — accepting one
      // finding silently accepts the other (bug 0010 collision, measured 3
      // findings collapsing to 2 identities). The documented example
      // (`routes["/x"].GET`) always implied this prefix; the code never added it.
      const owner = owningBindingName(root)
      for (const found of collectObjectLiteralFunctions(root, { includeAccessors: true })) {
        const keyPath = owner === undefined ? found.keyPath : [owner, ...found.keyPath]
        const fn = fromObjectLiteralFunction(found.node, keyPath)
        if (fn) functions.push(fn)
      }
    }
  }

  return functions
}

/**
 * Every namespace body in a file that is not inside a function, innermost ones included — the
 * scopes bug 0321 added beside the file itself.
 */
function namespaceScopes(sourceFile: SourceFile): ModuleDeclaration[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.ModuleDeclaration)
    .filter((namespace) => !isInsideAFunction(namespace))
}

/** The dotted path of a namespace, outermost first: `N` for `N`, `A.B` for `namespace A { namespace B {} }`. */
function namespacePathOf(namespace: ModuleDeclaration): string {
  const names: string[] = []
  for (const node of [namespace, ...namespace.getAncestors()]) {
    if (NodeClass.isModuleDeclaration(node)) names.unshift(node.getName())
  }
  return names.join('.')
}

/** The same function, reported under a qualified name. */
function qualifiedBy(prefix: string, fn: ArchFunction): ArchFunction {
  return {
    ...fn,
    getName: () => {
      const name = fn.getName()
      return name === undefined ? undefined : `${prefix}.${name}`
    },
  }
}

/** Whether a node lies inside a function's body, where an enclosing function already reads it. */
function isInsideAFunction(node: Node): boolean {
  return node
    .getAncestors()
    .some(
      (ancestor) =>
        NodeClass.isFunctionDeclaration(ancestor) ||
        NodeClass.isFunctionExpression(ancestor) ||
        NodeClass.isArrowFunction(ancestor) ||
        NodeClass.isMethodDeclaration(ancestor) ||
        NodeClass.isConstructorDeclaration(ancestor) ||
        NodeClass.isGetAccessorDeclaration(ancestor) ||
        NodeClass.isSetAccessorDeclaration(ancestor),
    )
}

/** Patterns 1 to 3 over one scope — a file, or a namespace body in it (bug 0321). */
function collectFromScope(
  scope: SourceFile | ModuleDeclaration,
  functions: ArchFunction[],
  includeMethods: boolean,
): void {
  // Pattern 1: FunctionDeclarations
  for (const fn of scope.getFunctions()) {
    functions.push(fromFunctionDeclaration(fn))
  }

  // Pattern 2: const arrow functions
  for (const varDecl of scope.getVariableDeclarations()) {
    // ArrowFunction and FunctionExpression both. `const a = function () {}` is
    // an ordinary shape and was collected by nothing — bug 0224 measured `eval`
    // passing the `recommended` floor inside one, because the element never
    // reached the rule at all. (Distinct from the concise-arrow half of that
    // bug, which was a traversal gap, not a collection gap.)
    // Read through parentheses, `as`, `<T>`, `satisfies` and `!` too: `const f = ((x) => …) as F` is
    // the same function, and was collected by nothing (bug 0315).
    if (functionValueOf(varDecl.getInitializer()) !== undefined) {
      functions.push(fromFunctionInitializerDeclaration(varDecl))
    }
  }

  // Pattern 3: class members — each class's methods, then its other function members, which no
  // function rule read before bug 0315. A class EXPRESSION holds the same members as a
  // declaration, so `const Expr = class { m() {…} }` is read too, its members named by the binding
  // that holds it (bug 0321). One held by anything else — passed to a call, chosen by a
  // conditional — stays out, with the inline functions bug 0315 left out on purpose.
  if (includeMethods) {
    const classExpressions = scope
      .getVariableDeclarations()
      .map((varDecl) => throughWrappers(varDecl.getInitializer()))
      .filter((initializer) => NodeClass.isClassExpression(initializer))
    for (const cls of [...scope.getClasses(), ...classExpressions]) {
      for (const method of cls.getMethods()) {
        functions.push(fromMethodDeclaration(method))
      }
      functions.push(...classMemberFunctions(cls))
    }
  }
}

/**
 * The name of the binding an object literal is assigned to, if any.
 *
 * Only the immediate parent is considered: `const routes = {...}` and
 * `class C { routes = {...} }` name the literal, whereas a literal passed as a
 * call argument or returned from a factory genuinely has no binding, and
 * inventing one from a distant ancestor would be a guess.
 */
function owningBindingName(objectLiteral: Node): string | undefined {
  const parent = objectLiteral.getParent()
  if (!parent) return undefined
  if (NodeClass.isVariableDeclaration(parent) || NodeClass.isPropertyDeclaration(parent)) {
    return parent.getName()
  }
  if (NodeClass.isPropertyAssignment(parent)) {
    const nameNode = parent.getNameNode()
    if (NodeClass.isStringLiteral(nameNode)) return nameNode.getLiteralValue()
    if (!NodeClass.isComputedPropertyName(nameNode)) return nameNode.getText()
  }
  return undefined
}

/** True if `node` is nested inside another object literal (so a root walk covers it). */
function isNestedInObjectLiteral(node: Node): boolean {
  let current = node.getParent()
  while (current) {
    if (NodeClass.isObjectLiteralExpression(current)) return true
    current = current.getParent()
  }
  return false
}

/**
 * Build an ArchFunction for an object-literal function value (arrow / function
 * expression / method shorthand), named by its qualified property-key path
 * (e.g. `routes["/x"].GET`) so violations identify the subject uniquely.
 */
export function fromObjectLiteralFunction(
  node: Node,
  keyPath: readonly string[],
): ArchFunction | undefined {
  const name = qualifiedName(keyPath)
  if (
    NodeClass.isArrowFunction(node) ||
    NodeClass.isFunctionExpression(node) ||
    NodeClass.isMethodDeclaration(node) ||
    // An object literal's accessors, the counterpart of the class accessors bug 0315 collected.
    NodeClass.isGetAccessorDeclaration(node) ||
    NodeClass.isSetAccessorDeclaration(node)
  ) {
    return fromCallableNode(node, () => name)
  }
  return undefined
}

/** Render a property-key path: `a.b`, bracketing non-identifier keys (`a["/x"].c`). */
function qualifiedName(keyPath: readonly string[]): string {
  if (keyPath.length === 0) return '<anonymous>'
  return keyPath
    .map((key, index) => {
      const isIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
      if (index === 0) return key
      return isIdentifier ? `.${key}` : `[${JSON.stringify(key)}]`
    })
    .join('')
}

/**
 * @deprecated Use {@link fromFunctionInitializerDeclaration} — it handles
 * `function () {}` initializers as well as arrows (bug 0224).
 */
export const fromArrowVariableDeclaration = fromFunctionInitializerDeclaration
