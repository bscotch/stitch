# @bscotch/gml-parser Changelog

## 0.61.4 (2023-11-28)

### Fixes

- Sprite editor now only opens upon F12, rather than as a side effect of go-to-definition. This prevents accidental opening of sprite editors.

## 0.61.3 (2023-11-14)

### Fixes

- Resolved issue with refs inside accessors caused by deletion of code with required side effects

## 0.61.2 (2023-11-13)

### Fixes

- Resolved issue where the RHS of an assignment was not processed if the LHS was a dot-accessed variable of an Any-type variable.
- Resolved issue where compound assignment operators cause the RHS to lose references.

## 0.61.1 (2023-11-02)

### Fixes

- Resolved issue where non-watcher functionality was lot from the Sprite Source tree

## 0.61.0 (2023-11-01)

### Features

- Added method for getting the Windows display name for a project

## 0.60.0 (2023-10-30)

### Features

- Go-to-definition on native functions now opens the online GameMaker help for that function

## 0.59.0 (2023-09-29)

### Features

- Drafted asset importer workflow
- Finished draft implementation of asset importing
- Improved support for struct literal autocompletes within function calls

### Fixes

- Resolved issue where imported assets were not fully parsed
- Resolved issue where imports failed to be moved to the correct destination groups
- Resolved issue where import dependencies were not recursively calculated

## 0.58.0 (2023-09-25)

### Features

- Added support for struct literal shorthand assignments

### Fixes

- Resolved issue where JSDocs were being skipped in function arguments
- Resolved conflicts when switching from shorthand to full struct literal syntax

## 0.57.0 (2023-09-20)

### Features

- Bumped all deps

### Fixes

- Resolved issues caused by dependency updates

## 0.56.0 (2023-09-14)

### Features

- Added getters for getting spine info from sprite assets
- Added a Spine JSON file loader with types

## 0.55.2 (2023-09-13)

### Fixes

- No longer deleting assets upon yyp reload

## 0.55.1 (2023-08-29)

### Fixes

- Made the asset kind type-guard more flexible

## 0.55.0 (2023-08-28)

### Features

- Added getter for the list of configs

## 0.54.0 (2023-08-25)

### Features

- Added an option to auto-declare missing globals matching prefix patterns
- Added method to check if an asset is in a given folder

## 0.53.0 (2023-08-24)

### Features

- Added command for setting an object's sprite

## 0.52.0 (2023-08-24)

### Features

- Implemented asset renaming
- Drafted signifier and asset rename functionality in the parser

### Fixes

- Resolved issue where some asset files were not being renamed
- Resolved issue with renamed yyp entries having incorrect path values

## 0.51.0 (2023-08-24)

### Features

- Updated processor to create refs from JSDoc typestring locations
- Added locations to types found in JSDoc strings

### Fixes

- Resolved issue with jsdoc typestring refs starting in the wrong place
- Improved handling of enum members so they are properly connected to parents and display correct hovertext

## 0.50.0 (2023-08-21)

### Features

- Added method to set the IDE version

### Fixes

- Resolved issues caused by assuming that parameters are always defined

## 0.49.2 (2023-08-21)

### Fixes

- Improved information provided by errors

## 0.49.1 (2023-08-21)

### Fixes

- Resolved issue with RHS of assignments not being processed when the LHS was known

## 0.49.0 (2023-08-18)

### Features

- Changed function params to just be special localvars, resolving conflicts between function signatures and variables
- Drafted symbol rename functionality

### Fixes

- Updated in-scope symbols listing to exclude non-uniquely named entries in more-global scopes
- Resolved issue with broken generics
- Resolved issue where the RHS of assignments using non-dot accessors was not being processed
- Resolved issue where janky JSDoc parameters were being propagated into parser logic

## 0.48.0 (2023-08-17)

### Features

- Added drag/drop for assets

### Fixes

- Added check for circularity when moving folders

## 0.47.0 (2023-08-17)

### Features

- Added method for deleting folders

## 0.46.2 (2023-08-17)

### Fixes

- Resolved syntax highlighting issue causing local vars to be highlighted as instance vars

## 0.46.1 (2023-08-17)

### Fixes

- Resolved issue with the RHS of dot-accessor assignments not properly resetting to the outer scope.

## 0.46.0 (2023-08-17)

### Features

- Generics now skip 'Any' types if more specific type are present
- Changed macro parsing to allow them to be set to any valid expression, including expression statements.
- Added normalization function for assignment RHS nodes and expanded argument types for associated helpers

### Fixes

- Resolved issue causing mixin variables to be lost
- Resolved issue where struct functions would have their self default to global instead of the struct
- Resolved issue where signifiers were both global and local
- Resolved issue causing dotting into 'Any' types to generate diagnostics
- Resolved issue with method calls not setting the self on target functions
- Resolved issue with missing references on assignment
- Resolved issue initially dotting into types

## 0.45.0 (2023-08-15)

### Features

- Updated parser to allow switch-case blocks to be wrapped in curlies

## 0.44.0 (2023-08-15)

### Features

- Updated logic for removing a single GML file
- Made 'removeAssetByName' public and added additional cleanup for asset removal
- Definitive variable declarations are now ensured

### Fixes

- Updated all deps
- Prevented struct types from being overridden
- Resolved issue on case-sensitive operating systems where files with incorrect casing would not be loaded
- Removed the warning when event_inherited is not called in an object event

## 0.42.0 (2023-08-03)

### Features

- Added autocompletes for keys in struct literals

## 0.41.2 (2023-08-03)

### Fixes

- Changed how identifiers are discovered to prefer declared identifiers

## 0.41.1 (2023-08-03)

### Fixes

- Resolved wonky error message that sometimes appears in functions regarding duplicate local types

## 0.41.0 (2023-08-02)

### Features

- Workspace symbols now include object, constructor, and mixin variables

## 0.40.0 (2023-08-02)

### Features

- Added tracking of a type's children
- Added a separate setter function for type parents
- Refactored to replace combo of "context" and "constructs" with a single "self" field for function types
- Objects now get their own copies of instance variables, to make go-to-refs more useful

### Fixes

- Resolved issue where using a function type as self can cause that function's params to be added to the current function
- Undeclared variables from mixins no longer supercede local declared variables
- Resolved issues with x, y, and other built-in variables being falsely labeled "undeclared"
- Resolved issue where self-context was not reset when a function toggles between (non)constructor
- Resolved issue with catch blocks not knowing about their parent local scope
- Further improvements to order of ops for variable declarations
- Additional improvements to adding variables
- Added more improvements to how variables are added to scope
- Added override flag to redeclared functions
- Resolved error in parent-extension logic causing variables to disappear immediately after being added
- Changed how members are added to structs to decrease dependency on order-of-operations
- When a variable has its definition location set, all children of its container have that same variable replaced with this one if they exist but are undeclared
- Removed spurious refs created by mixin calls
- Improved reference handling by making local scopes not have to be reconstructed, removing excess function params on reprocess, and preventing native variables from being "added" by mixins

## 0.39.1 (2023-07-28)

### Fixes

- Resolved issue where mixins and other kinds of variable redefinition could cause symbols to become falsely undeclared
- Added diagnostic for attempts to redefine built-ins
- Improved logic for resolution of instance fields

## 0.39.0 (2023-07-28)

### Features

- Added mechanisms for handling addition/removal/change of files on disk

### Fixes

- Undid change that did a full reload of all "dirty" files since that caused a lot of hanging

## 0.38.0 (2023-07-27)

### Features

- Added typing of method() return types to match their function argument

### Fixes

- Resolved some issues with instance variables not being found

## 0.37.1 (2023-07-26)

### Fixes

- Changed hover text for structs to sort underscore-prefixed variables to the bottom
- Resolved error cases where we are indexing into undefined

## 0.37.0 (2023-07-26)

### Features

- Added support for the native displayGetFrequencyType function

### Fixes

- Resolved issue with generics and utility types interfering with each other

## 0.36.0 (2023-07-26)

### Features

- Added improved support for generics, allowing for significant recursion in generic inference
- Added function for inferring generic types, given a type and references

### Fixes

- Resolved non-production issue causing failed tests
- Resolved logic issues with unused-global-function diagnostics

## 0.35.0 (2023-07-24)

### Features

- Made many native generic types functional by overriding their specs
- Added support for multiple GML Spec files, including auto-discovery of module specs

## 0.34.1 (2023-07-24)

### Fixes

- Resolved issue where undefined variables would appear in the autocomplete listing

## 0.34.0 (2023-07-24)

### Features

- Added the ability to set an object's parent via the sidebar

## 0.33.1 (2023-07-24)

### Fixes

- Resolved bug when `other` keyword is used that likely caused a lot of early aborts during code processing

## 0.33.0 (2023-07-22)

### Features

- Added support for the `other` keyword when in `with` statements, and added references to `self` and `other`

## 0.32.0 (2023-07-22)

### Features

- Added support for using @self with function types
- Added the @mixin jsdoc tag

## 0.31.1 (2023-07-22)

### Fixes

- Changed the wording of an error to be more accurate
- Resolved order-of-ops issue preventing JSDocs from working in struct literals

## 0.31.0 (2023-07-22)

### Features

- Updated interpretation of spec to treat ArgumentIdentity type as a generic. It is used inconsistently in the spec so this has limited improvement of types

### Fixes

- Removed redundant warnings about undeclared variables

## 0.30.1 (2023-07-21)

### Fixes

- Resolved some errors caused by indexing into possibly-undefined values

## 0.30.0 (2023-07-21)

### Features

- Added support for the variable created by catch statements

## 0.29.0 (2023-07-21)

### Features

- Constructor inheritance is now parsed and referenced for global constructors
- Implemented Utility types InstanceType and ObjectType
- Implemented basic generic support for functions
- Added prereqs for generics support
- Added @template tag parsing
- Change Feather type parsing to require explicitly choose to add discovered types to globals or not
- Added Asset.GMObject and Id.Instance as pass-through types

### Fixes

- Resolved some issues causing crashes when generic types are not found
- Resolved some order of operations problems around Object types
- Allowed the `id` variable to be referenced anywhere even when not within an instance context
- Resolved issues caused by new pass-through Id.Instance and Asset.GMObject types
- The id keyword now accurately reflects the type it came from

## 0.28.1 (2023-07-20)

### Fixes

- Resources with no yy file now log a warning instead of throwing an error.

## 0.28.0 (2023-07-20)

### Features

- Added support for localvar, globalvar, and instancevar JSDoc tags.

## 0.27.0 (2023-07-19)

### Features

- Added the 'then' keyword to the parser, though I have no idea why anyone would use it
- Added support for legacy 2D array indexing

## 0.26.1 (2023-07-18)

### Fixes

- Resolved potential issue with function contexts
- Improved typing of enum members
- Globalvar declarations can now have their type overridden via changing their JSDocs
- Function overrides in child objects now have their own type instead of the parent type
- Added some additional assertions and logging to get info about missing asset yy files

## 0.26.0 (2023-07-15)

### Features

- Added diagnostics for unused functions, and improved handling of static declarations
- Extensions now have their functions and consants loaded
- Added a schema for extension yy files

### Fixes

- Added a second pass to parsing on initial load to resolve remaining cross-file refs
- Restricted unused-function warnings to global functions
- Made some code more robust when comparing strings

## 0.25.0 (2023-07-13)

### Features

- Added the SpriteInfo type

## 0.24.0 (2023-07-13)

### Features

- AudioGroups are now loaded as assets

### Fixes

- Resolved incorrect parsing of struct literal scope

## 0.23.2 (2023-07-13)

### Fixes

- Resolved a precedence issue causing struct literals to be recreated on every update

## 0.23.1 (2023-07-13)

### Fixes

- Updated YY file saving to ensure consistent key ordering

## 0.23.0 (2023-07-13)

### Features

- Added children to the inspector

## 0.22.0 (2023-07-13)

### Features

- Completed the first draft of the asset inspector widget
- Added missing object user events

## 0.21.0 (2023-07-12)

### Features

- Added groups to object events for better display
- Added Asset type guard and better return values for added events and files

## 0.20.0 (2023-07-12)

### Features

- Drafted method for adding object events
- Added info about object events, including filenames and numeric ids
- Added command to create new object assets

### Fixes

- Resolved order-of-operations problem with object inheritance on first load
- Made object parent-setting more dynamic
- Resolved order of ops problem causing variables to disappear and false errors about variables that did exist
- Resolved issue where DsGrid accessors were only taking a single index value instead of two.

## 0.19.0 (2023-07-10)

### Features

- GameMaker method() calls now use the first argument as the context for the second

### Fixes

- Fixed triggers for autocomplete in JSDocs
- For function types with no associated signifier, we now make no assertions about the number of args the function takes
- Improved annotation of function JSDocs by adding references
- Resolved issue with Id.Instance typing not having references
- Added go-to-def for object names

## 0.18.1 (2023-07-10)

### Fixes

- Resolved order of ops problem that completely breaks the loading process

## 0.18.0 (2023-07-07)

### Features

- JSDocs now create navigatable references
- Added support for type autocompletes in JSDocs
- Added support for JSDoc diagnostics and for checking if a cursor position is within some docs
- Simplified by combining Signifier and MemberSignifier, removing separate global pools, etc

### Fixes

- Object instance types now inherit from a common parent that has all native instance vars
- Indexing into 'any' types no longer generates Undeclared variable errors
- Resolved issue where native instance variables were not found in structs
- Reduced 'problems' noise by interpreting typeless signifiers as being an Any type
- Resolved JSDoc issue for params that have no types
- Reduced the degree of 'derive' calls to make the models easier to reason about
- Some light refactoring, renaming, and legacy code removal
- Resolved some issues with JSDoc computed locations
- JSDoc function contexts now work
- Removed extra pass during init
- Resolved issue where JSDocs were ignored for struct literals
- Resolved issue with types overriding reference types
- Improved type inference for binary operator expressions
- Struct members are now sorted in hovertext
- Fixed Feather typestrings for constants
- Macros are now typed based on their value
- Improved stability of struct literal types while editing
- Resolved missing asset names on hover
- Resolved JSDoc issue in the sample project
- Resolved some issues with 'with' statement contexts
- Added back the double-run of the parser to resolve more cross-file reference issues
- Removed the legacy watcher code
- Resolved issue where JSDocs for function expressions were not used
- Added missing parameter descriptions
- Resolved issue where functions missing return statements showed that they returned Unknown instead of Undefined
- Resolved issue where function types were not always named
- Resolved remaining issues causing test failures
- Resolved issue with function types not gettin g names
- Resolved order of ops issue causing missing references
- Resolved an issue where new item types clobberred prior types
- Updated tests to clear all Typescript errors
- Reworked the accessor visitor with the new type system
- Completed update of functionExpression visitor to account for new type system
- Reworked core visitor logic for the new typing system
- Updated registration of globals to be simpler and more resilient to change
- Removed the obscuring getGlobal method, replacing with separately getting types or signifiers

## 0.17.1 (2023-06-23)

### Fixes

- Added more logging

## 0.17.0 (2023-06-22)

### Features

- Made diagnostics for undeclared variable references dynamic

### Fixes

- Resolved issue where type definitions could disappear on reload
- Global symbols that don't live in `global` are no longer missing from the workspace symbols listing
- Resolved issue with global struct types losing declaration info
- Resolved issues of missing refs on update
- Resolved issue where native functions claimed to be undeclared
- Diagnostics are now updateable across files, at least for some cases.
- Resolved false diagnostic about an object identifier not being defined
- Now truncating the struct member preview for large structs
- Improved synatx highlighting for template strings

## 0.16.0 (2023-06-20)

### Features

- Now inferring function return types when not specified by JSDocs.

### Fixes

- Post-parser processing no longer crashes on error
- Optional hyphens between JSDoc name and descriptions are now ignored.

## 0.15.2 (2023-06-16)

### Fixes

- Removed warnings for dotting into dot-accessible, unknown, and any types
- Now doing a final pass after loading the project to ensure that all cross-references are accounted for in diagnostics
- Resolved issue where legacy yy files were sometimes being chosen over the current ones

## 0.15.0 (2023-06-16)

### Features

- Added ability to create scripts via the sidebar
- Added the ability to add folders via the Stitch sidebar

## 0.14.0 (2023-06-15)

### Features

- Using with statements on object names now properly sets the self context

### Fixes

- Resolved misc.  jank
- Resolved JSDoc return types not being consumed
- Some built-in GML constants were being treated as unknown identifiers

## 0.13.0 (2023-06-15)

### Features

- Added a loading bar for Stitch's project loading progress.
- Added highlighted logs to the VSCode output panel

## 0.12.1 (2023-06-14)

### Fixes

- Resolved a bug causing startup errors in VSCode

## 0.12.0 (2023-06-14)

### Features

- Added type support when accessing arrays and structs
- Added JSDoc processing inside of structs

### Fixes

- Resolved more issues with unstable references after reprocessing
- Resolved issue where variables lose their definition on reprocess
- Resolved a bunch of semantic highlighting wonkiness

## 0.11.0 (2023-06-14)

### Features

- Added improved hover details for functions and structs

## 0.10.0 (2023-06-14)

### Features

- Improved type inference by adding logic for checking whether types are compatible with each other.
- Now ensuring that the native throws function is known to Stitch since it is not in the spec
- Updated fallback GML spec to more recent one

## 0.9.3 (2023-06-13)

### Fixes

- Added missing diagnostics created during CST visits

## 0.9.2 (2023-06-13)

### Fixes

- Improved type inference and merging

## 0.9.1 (2023-06-13)

### Fixes

- Resolved issue with assignments to variables not resolving to their types
- Resolved issue with global types remaining Unknown

## 0.9.0 (2023-06-12)

### Features

- Added a lot more type inference
- JSDocs are now consumed prior to variable declarations and assignments, allowing setting variable types without inference.
- Can now use JSDocs to specify scope for with blocks

### Fixes

- Removed random names for anonymous functions
- Made the params field for function types private

## 0.8.0 (2023-06-12)

### Features

- Function definitions now consume JSDocs
- Replaced JSON parsing as part of code parsing with a later process.
- Completed Feather typestring parser
- Completed JSDoc parser
- JSDoc string parser implemented

### Fixes

- Resolved order of operations issue when checking for diagnostics
- Added assertions to possible error locations
- Added assertion function that logs when in VSCode to get around swallowed errors
- Removed dependency on the regex 'd' flag
- Now checking if we're running in VSCode before bypassing the 'd' regex flag
- VSCode cannot use the regex 'd' flag since it uses Node 16

## 0.7.1 (2023-06-07)

### Fixes

- Dot-accessed variables are now tracked if they are definitely assigned.

## 0.7.0 (2023-06-06)

### Features

- Added diagnostics for too many or too few arguments in function calls.

### Fixes

- Resolved a lookup issue causing global functions to lose type information
- Moved the 'new' keyword into the appropriate parser logic instead of treating it as an arbitrary unary operator

## 0.6.1 (2023-06-06)

### Fixes

- Object functions are now being properly added to their self struct.
- Switched to fetching GameMaker release info using a caching function to improve startup time

## 0.6.0 (2023-06-06)

### Features

- Object types now take into account inheritance from parents unless event_inherited is not called in the create event.
- Object assets now know about their parent, and object struct types reflect parent struct fields.

## 0.5.0 (2023-06-03)

### Features

- Added option to fetch references by line/column to make tests resilient to line endings

### Fixes

- Resolved some misbehavior with in-range checking

## 0.4.0 (2023-06-03)

### Features

- Completed base extension functionality with the full asset tree.
- Added JSDoc parsing
- Renamed the 'program' entrypoint to 'file' to be less confusing
- Added generated GML CST types
- Added improved string parsing
- Added string-specific lexer modes
- Added support for 'repeat' statements
- GML parser now working on all sample files
- Added categories to tokens to simplify parsing logic
- Drafted lexer tokens using Chevrotain. Erroring on a sample file
- Implemented semantic highlighting for globals.

### Fixes

- Resolved order of ops problem causing diagnostics to get wiped
- Resolved go-to-def for params and local vars
- Resolved missing param refs
- Resolved issues with global identifier discovery and with constructors not being labeled as such
- Resolved a bunch of global reference issues
- Resolved issue of missing glboal function type names
- Resolved issue where function params may be unknown when parsing call site
- Resolved Diagnostic interface invalidity after changes to location modeling
- Resolved issue with new symbol undefined types not being overwritten
- Added missing 'await'
- Resolved issue in the visitor caused by a variable name-change
- Resolved more parser issues
- Resolved more parser issues
- Added support for non-terminated multiline comments
- Now parsing a few sample files successfully. Still incomplete
- Got parser working for basic expressions
- Resolved lexer issue in multi-line comments.
- Resolved lexer issue in multi-line comments.

## 0.2.2 (2023-04-12)

### Fixes

- Updated all deps, including a version of Pathy that was not properly using validators
- Updated all deps

## 0.2.1 (2023-03-06)

### Fixes

- Updated the homepage field in all manifests