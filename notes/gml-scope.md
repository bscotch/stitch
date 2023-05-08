# GameMaker Language Scoping

## Local vs Self

GameMaker describes GML as having 4 scopes with their own rules for access:

1. Local
2. Instance
3. Global
4. Constants

While true, there is another way to break this down. Symbols fall into 3 categories:

1. Local
2. Self
3. Independent

Where local symbols exist ephemerally in a scoped section of code, self symbols exist as members of a data structure (e.g. the global instance, object instances, or struct instances), and independent symbols are globally available but not members of any accessible data structure (e.g. enums, macros, asset IDs, and built-in function identifiers).

Local variable contexts are created inside function bodies, scripts, and object event bodies. Unlike other languages, you do NOT create new local contexts within other code blocks -- vars created within for loops, try-catch statements, etc are all available to the parent local context!

Therefore the only way to create a new local context within a body of code is to create a new function body.

While the local context does not change often, the value of "self" can change in multiple ways throughout a code block:

- Within a struct literal body, "self" is that struct.
- Within a function body, "self" is the instance that the function is called on or bound to.
- The `with` statement changes the self context to whatever its argument evaluates to.
- An accessor on a symbol changes the inline self context for subsequent accessors.