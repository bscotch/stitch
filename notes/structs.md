# Structs in GML

## Memory Usage

*(In runtime v2023.100.0.287, on Windows 11)

- An empty struct uses ~720 bytes
- An empty construct uses ~500 bytes

## Statics have non-obvious behaviors

```js
function Extender () constructor {
	static counter = 0;
	counter += 1;
	static props = {};
	internal = 10;
	internal_undefined = undefined;
	static static_undefined = undefined;
	static something_static = "noooo";
	static changeStatic = function changeStatic(to){
		static_get(Extender).something_static = to;
	}
	static array_of_extenders = [];
	array_push(array_of_extenders, self);
}

var a = new Extender();
a.something_static = "YES";
var b = new Extender();

echo("A",a.something_static); // A YES
echo("B",b.something_static); // B noooo
echo("Keys", variable_struct_get_names(a)) //  Keys [ "something_static","changeStatic","internal","internal_undefined" ] 

a.props[$ "NEW KEY"] = 100;
echo("Static struct prop", a.props, b.props); //  Static struct prop { NEW KEY : 100 } { NEW KEY : 100 }

show_debug_message(json_stringify(a)); // { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "noooo", "array_of_extenders": [ null, { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "noooo", "array_of_extenders": null, "counter": 2.0 } ], "counter": 2.0 }
show_debug_message(json_stringify(b)); // { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "noooo", "array_of_extenders": [ { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "noooo", "array_of_extenders": null, "counter": 2.0 }, null ], "counter": 2.0 }

// How to struct functions differ betweened static and owned?
echo("A", variable_struct_get_names(a), variable_struct_exists(a,"internal_undefined"), variable_struct_exists(a,"static_undefined")) // A [ "something_static","changeStatic","internal","internal_undefined" ] 1 1 

var c = new Extender();
b.changeStatic("HUH");
echo(b.something_static,c.something_static); //  HUH HUH
echo("COUNTER", b.counter, c.counter); // COUNTER 3 3 
echo(is_undefined(b.something_static), is_undefined(c.something_static)); // 0 0


echo("STATIC GET",json_stringify(static_get(Extender))); // STATIC GET { "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "HUH", "array_of_extenders": [ { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "HUH", "array_of_extenders": null, "counter": 3.0 }, { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "HUH", "array_of_extenders": null, "counter": 3.0 }, { "internal": 10.0, "internal_undefined": null, "<unknown built-in variable>": 1.0, "props": { "NEW KEY": 100.0 }, "static_undefined": null, "something_static": "HUH", "array_of_extenders": null, "counter": 3.0 } ], "counter": 3.0 }
```