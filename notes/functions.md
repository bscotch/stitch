# Functions in GML

## Hoisting

Script functions are *hoisted* during the bootup sequence (during `ScriptPrepare()`, specifically), prior to executing any script statements. So you can do a wacky thing like this:

```js
// ScriptA
functionB(10);

function functionA(counter=0){
	if(counter <=0){
		return;
	}
	return functionB(counter-1);
}
```

```js
// ScriptB
functionA(10);

function functionB(counter=0){
	if(counter <=0){
		return;
	}
	return functionA(counter-1);
}
```

Without hoisting, this circular dependency wouldn't work. But it does work: hence, hoisting!

Notably, hoisting only occurs in Script assets -- functions defined in Objects or in non-Script-root locations appear not to be hoisted.

## Static structs

Every function has an associated "static struct", enabling storing static variables within functions.

A function's static struct can be retrieved with `static_get` and overwritten with `static_set`.

## Methods

A "method" is a sort of JavaScript-style Function + Struct hybrid, created by binding a function to a context:

`method(context, function(){})`

To compare and contrast to Functions:

- Methods share the same static struct as the function they're based on. Methods created from methods *also* share the original function's static struct.
- While methods share the same static struct, that struct cannot be retrieved using `static_get(the_method)`. A struct is returned, but it does not equal the original static.
- Methods can have variables attached to them using the `.`-accessor. It's unclear where these are actually stored, since they cannot be found in the static structs. E.g.
	```js
	var my_method = method({}, function(){});
	my_method.some_variable = "hello";
	```

## Constructors

GML includes "Constructor Functions" that return structs, and inside of which `self` refers to said struct. The `new` keyword is used to call these functions to retrieve the struct, similar to JavaScript.

