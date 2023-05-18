# GameMaker Parser Notes

## Purpose and Design Goals

The purpose of this parser is to enable editor feature support for GameMaker projects, so the approach towards analysis is focused on the kinds of things we'd want to do from an editor. Examples include:

- Given a file:
  - List all symbol references in the file with type information (allowing semantic highlighting)
- Given a position within a file:
  - Find the symbol reference at that position, if any
  - Get the list of in-scope symbols that could be used for autocomplete
  - Determine if we are within a function call argument and, if so, which argument (to provide argument-specific autocompletes and documentation, and function signature helpers)
- Given a symbol reference:
  - Get documentation for the symbol
  - Find where the symbol is declared
  - Find all other references to the symbol
  - Determine the symbol's type *at that reference* since many symbols are writeable and their type can change by position

Ideally the features could be extended to include linting, code formatting, and other niceties, but the focus is on the above for now.

## Symbols and Scopes

At root, the parser's job is to identify every symbol (unique identifier) and scope (region where a specific subset of symbols are referenceable).

Symbols and scopes are defined together and circularly.

### Scope Ranges

Since so much of what we need to be able to do is based on position, a natural way to describe scope and symbol information is by breaking GameMaker files apart into a series of consecutive "Scope Ranges", where each Scope Range is defined by a specific combination of:

- Local Scope (only changed when entering a new function body or file)
- Self Scope (a struct or instance scope, only changing when entering a struct literal body, a function body, a with statement, a struct accessor, or a new file)
- Global Scope (a particular kind of Self Scope, containing globalvars, global functions, enums, and macros, which is always visibile)

Defining scopes in this way makes it easy to determine which symbols are visible at a given position.

### Symbol Declarations

To accurately identify all unique symbols in a project, we operate in two passes:

1. Globals. Identification of all global identifier names, including enums, macros, globalvars and global functions defined in scripts.
2. Non-Globals. Identification of all local and self symbols. A self variable is identified by exclusion: globals and local variables are unambiguously declared, so any other identifier is a self variable. Note that it's very difficult to tell for sure that an identifier is a valid symbol reference, since unambiguously identifying all symbol declarations is non-trivial!

### Symbol References and Types

Each time we see a symbol's identifier, we call that a "reference" to that symbol. This includes the reference where the symbol is "declared". We represent each symbol as a data structure that stores a list of all of its references, so that it is easy to find all references to that symbol. Each file includes a list of all symbol references within it, allowing us to list all references in a file for semantic highlighting.

A symbol reference links to the symbol being referenced and the location where the reference occurs.

If the reference is the left hand side of an assignment operation, we can infer the type/value of the symbol at that reference. Each time we discover a new type/value, we can add that to the symbol's list of possible types.

Within a given local scope we can use assignments to determine a symbol's possible value at any point within that local scope, however we can not infer things between scopes via static analysis.

By tracking a symbol's possible types, we can identify certain kinds of errors and provide features like autocomplete of accessible members and values (when that type is a container, like a struct or array).

### Accessors

Accessors are operators that allow us to access a member of a container (e.g. a struct, array, or other data structure). Accessors and function calls are practically very similar, in that they essentially "return" a value and that value *could* be another data structure/function which could also have an accessor applied to it.

In essence, accessors create chainable in-line scope changes.

For example, `one.two[$"three"].four().five` creates a series of implied inline scope changes after each accessor. `one.` changes the self scope to `one`, `two` must be a member of `one`, etc.

Collectively, I refer to these as "accessor suffixes".

