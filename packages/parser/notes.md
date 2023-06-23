# GameMaker Parser Notes

## Purpose and Design Goals

The purpose of this parser is to enable editor feature support for GameMaker projects, so the approach towards analysis is focused on the kinds of things we'd want to do from an editor.

## Signifiers and Scopes

At root, the parser's job is to identify every signifier (named entity that points to a value) with each scope (region where a specific subset of signifiers are referenceable).

### Scope Ranges

Since so much of what we need to be able to do is based on position, a natural way to describe scope and signifier information is by breaking GameMaker files apart into a series of consecutive "Scope Ranges", where each Scope Range is defined by a specific combination of:

- Local Scope (only changed when entering a new function body or file)
- Self Scope (a struct or instance scope, only changing when entering a struct literal body, a function body, a with statement, a struct accessor, or a new file)
- Global Scope (a particular kind of Self Scope, containing globalvars, global functions, enums, and macros, which is always visibile)

Defining scopes in this way makes it easy to determine which signifiers are visible at a given position.

### Signifier Declarations

To accurately identify all unique signifiers in a project, we operate in two passes:

1. Globals. Identification of all global identifier names, including enums, macros, globalvars and global functions defined in scripts.
2. Non-Globals. Identification of all local and self signifiers. A self variable is identified by exclusion: globals and local variables are unambiguously declared, so any other identifier is a self variable. Note that it's very difficult to tell for sure that an identifier is a valid signifier reference, since unambiguously identifying all signifier declarations is non-trivial!

### Signifier References

Each time we see a signifier's name, we call that a "reference" to that signifier. This includes the reference where the signifier is "declared". We represent each signifier as a data structure that stores a list of all of its references, so that it is easy to find all references to that signifier. Each file includes a list of all signifier references within it, allowing us to list all references in a file for semantic highlighting.

A signifier reference links to the signifier being referenced and the location where the reference occurs.

### Macros

Macros make parsing difficult since their values do not necessarily need be complete expressions.

Stitch takes a strongly opinionated stance on macros to make static analysis less complicated: macros are only allowed to map to valid *expressions*, so that they can be used as if they are variables.

## Types

While a Signifier is a name that points to a value, a "Type" is a description of an allowed range of data values that a given signifier can point to.

We aim to have the Stitch type system keep close parity with the official GameMaker "Feather" type system, though we'll add some extensions as needed.

### Feather Type System

Feather's type system is not documented and has limited expressivity. Our current understanding of Feather's type system is as follows:

- There are a collection of base ("primitive") types, including:
  - `Any`
  - `Array`
  - `Asset`
  - `Bool`
  - `Constant`
  - `Function`
  - `Id`
  - `Pointer`
  - `Real`
  - `String`
  - `Struct`
- Those base types may have additional "specifiers". Specifiers are named subtypes. For example:
  - `Id.Instance`
  - `Asset.GMObject`
  - `Asset.GMObject.o_player`
  - `Id.Instance.o_player`
  - `Struct.MyStruct`
- Some types are generic "containers", meaning they can be parameterized with other types. For example:
  - `Array<Real>`
  - `Id.DsMap<String>`
- There is limited and undocumented support for type unions. For example:
  - `Real | String`
  - `Array<String | Id.Instance>`

Feather is primarily used as a type *inference* toolset, rather than an explicit type system. For example, Feather only supports explicitly typing through JSDocs for function definitions.

### Stitch Type System

The Stitch type system is designed to be a superset of the Feather type system, with the following extensions and modifications:

- All Feather types are supported.
- Additional types are added to represent more scenarios. Namely:
  - `Enum` - A type that represents a specific enum, e.g. `Enum.MyEnum`
  - `EnumMember`
  - `Macro` - A type that represents a specific macro, e.g. `Macro.MY_MACRO`
  - `Union` - An internal type that represents a collection of types. Sort of an implied type, e.g. `Real | String` is implicitly a `Union<Real|String>`
  - `Unknown` - A type that represents an unknown type. This is used when the type cannot be inferred.
  - `Never` - A type that represents a value that can never be assigned. This is useful in particular for functions that throw errors, since they never actually return a value.
- Unions have full support, instead of falling back to a general "Mixed" type.
- Structs can be used as a container type, e.g. `Struct<Real>` is a valid type that indicates a struct whose values are all of type `Real`.
- Stitch will ingest types with a variety of syntaxes, since Feather seems to allow a range as well. They will all be normalized to a single syntax for internal representation, computed hovertext, etc. For example:
  - Unions can be created with `|` (standard), `,`, or ` OR ` separators
  - Container content can be wrapped in `<>` (standard) or `[]` brackets
- Stitch will support additional JSDoc keywords, enabling explicit typing of any signifier rather than only functions
- Stitch will perform minimal type inference, requiring that the developer explicitly add type information wherever there is a conflict.
  - Types can be provided via JSDocs for any signifier
  - Types are also inferred from the RHS of assignments, function calls, return statements, and other expressions. If the inferred type conflicts with an explicit type, an error is thrown. Signifiers that lack an explicit type will be assigned the type of the RHS of the first assignment to that signifier found during parsing.

### JSDocs

Feather uses JSDoc to allow limited explicit typing of functions. Stitch will extend this to allow explicit typing of any signifier, among other features.

How Stitch uses JSDocs:

- JSDocs can be used on function declarations and expressions, and on variable declarations (using `@type`).
- The `@self` keyword can be used to indicate the scope we're stepping into via a `with` statement.
- Descriptions can be added to signifiers at the time they are declared, either with `@description`, with text preceding any other JSDoc keywords, or with text following `@type {}` documenation. Descriptions are added to the Signifier, not the type.

## Accessors

Accessors are operators that allow us to access a member of a container (e.g. a struct, array, or other data structure). Accessors and function calls are practically very similar, in that they essentially "return" a value and that value *could* be another data structure/function which could also have an accessor applied to it.

In essence, accessors create chainable in-line scope changes.

For example, `one.two[$"three"].four().five` creates a series of implied inline scope changes after each accessor. `one.` changes the self scope to `one`, `two` must be a member of `one`, etc.

Collectively, I refer to these as "accessor suffixes".

