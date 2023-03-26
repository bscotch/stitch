# GameMaker Language (GML) for JavaScript/Typescript developers

GameMaker Language (GML) has similar grammar and syntax to JavaScript (ES3 in particular) but does have significant differences. This post aims to explain GML to people (or bots!) that are very familiar with JavaScript/Typescript but not familiar with GML.

## Comments

```js
// Comments! Like with JavaScript, GML uses // for single-line comments and wraps multiline-comments in /* */ pairs

/// GML uses a subset of JSDocs to describe functions, but instead of
/// using `/** */` to wrap the JSDoc it uses the single-line comments with `///`
/// in front of each JSDoc line.
```

## Naming Things

Variable/function/asset names are alphanumeric, plus `_`. (The first character must not be numeric.)

GML built-ins are nearly always snake_case. GML names typically follow a `[prefix_]general_specific` pattern, since things are *very* global and so names need to provide their own namespacing. For example, built-in functions that do stuff with sprites include `sprite_get_bbox_bottom`.

User code often uses prefixes for asset names to make it easier to find them. For example, they might start all sprite names with `sp_` and objects with `o_`. But this is not required!

## Shared Terminology

GML has some concepts and terms that differ significantly from their meaning in JavaScript:

- **Object**: In GML, the term "object" refers to something we'd call a "class" in other languages. However, a GML object is not just *any* class -- it comes with a lot of built-in features.
- **Instance**: An "instance" refers specifically to a GML Object instance.
- **Script**: We often use "script" to refer to some fuzzy kind of collection of code (e.g. a single file, or a small application). In GML a "script" is specifically a particular type of asset that contains code.
- **Struct**: A "struct" in GML is basically an "object" in JavaScript.
- **Method**: In JavaScript, we typically use "method" to refer to class functions, but in GML a "method" is a function bound to a particular context using the `method(context, function)` built-in.
- **self**: The `self` keyword is roughly the same as the JavaScript `this` keyword.

## Assets

GameMaker projects consist of a collection of assets, also called "resources", falling into a number of types (like sounds, sprites, objects, scripts, etc). All assets are globally referenceable and therefore have globally unique names.

This post is about the GameMaker *Language*, so we're mostly only interested in Scripts and Objects since that's where the vast majority of GML code ends up.

### Scripts

A "Script" is a uniquely-named asset containing code. Functions and enums defined in any script are *globally* available.

Scripts are loaded very early in the bootup process for a GameMaker game. Script functions are hoisted, and then all non-function-definition script code is run.

### Objects

An "Object" is a class-like asset from which "Instances" can be created. Objects have built-in events to which you can add code, such as the create, destroy, and draw events.

## Variables and Scope

GML has four kinds of variables:

- **Local**: Local variables are defined using the `var` keyword, which works similarly to `let` in JavaScript. Local variables are only available within their function, script, or object event scope.
- **Instance**: Instance variables are object "self"-variables defined without a keyword. They are available to object code in any event. GML includes a handful of built-in instance variables that are always present, such as `x` and `y` (coordinates of the object instance).
	```js
	// E.g. within an object's Create event:
	var local = 100; // A local variable only available within this event
	instance_var = true; // An instance variable that is always reachable on the instance
	self.instance_var = false; // An alternative syntax to using an instance variable -- the `self` is implicit if not specified.
	```
- **Global**: Global variables are available everywhere. 
- **Constants**: 

#endregion