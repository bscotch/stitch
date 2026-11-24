# @bscotch/gml-syntax Changelog

## 1.1.0 (2026-11-23)

### Features

- The gml-syntax package can now parse JSDoc comments, including all Feather tags and types plus Stitch extensions (variable typing, templates, mixins, and @see/{@link} references), with source locations for every tag, type, and name.
- Added the (unpublished) @bscotch/gml-syntax package: a lossless, error-tolerant GML lexer and parser that produces a typed syntax tree with proper operator precedence, macro config overrides, and doc-comment lookup.