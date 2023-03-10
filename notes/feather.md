# Intellisense in GameMaker using Feather

## Tips & Tricks

- (v2023.100.0.287) For autocomplete of struct-owned functions, the function **must be named** and its name must match its variable name. In that case, Feather provides full support (hover info, autocomplete, parameter listing, but no go-to-definition):
  ```js
  function MyConstructor () constructor {
    // ❌ This gets no support
    static nope = function (){}

    // ❌ This gets incorrect support due to name mismatch
    static also_nope = function nope(){}

    // ✅ This gets support since the struct's variable name matches the function's name
    static yep = function yep(){}
  }

