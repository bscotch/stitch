# TODO

## MVP Features
- [x] Generate concrete syntax tree from GML
- [x] Track all project global declarations
    - [x] macros
    - [x] enums
    - [x] globalvars
    - [x] script-functions
    - [x] assets
- [x] Track all project global references
    - [x] macros
    - [x] enums
    - [x] globalvars
    - [x] script-functions
    - [x] built-ins
    - [x] asset IDs
- [x] Global function signatures
- [x] 🆕 Track all localvar declarations
- [x] 🆕 Track all localvar references
- [ ] 🆕 Track all enum member references
- [x] Watch files for changes (e.g. for catching external changes)
- [x] Force a virtual file-change (e.g. for current, unsaved edits)
- [ ] 🆕 Fault-tolerant parsing
- [x] Re-parse a single file on change
- [ ] List all symbol locations and types in a given file (for semantic highlighting)
    - [x] 🆕 vars
    - [x] built-in functions
    - [x] built-in constants
    - [ ] 🆕 enum members
- [ ] For a given file and position, list all in-scope (for autocomplete)
    - [x] 🆕 vars
    - [x] globals
    - [ ] 🆕 enum members
    - [x] built-ins
- [x] For a given file and position, get the symbol at that position if there is one (for hovers etc)
- [x] 🆕 Create diagnostics based on parser errors
- [ ] 🆕 Create diagnostics based on unknown variables

### Next Features

- [ ] Add JSDoc info to symbols
- [ ] Add [Document Symbol Highlighting](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#highlight-all-occurrences-of-a-symbol-in-a-document)
- [ ] Add [symbol renaming](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#rename-symbols)
