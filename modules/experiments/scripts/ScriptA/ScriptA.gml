functionB(10);

enum hello {
	hi = 0,
	ho = 0
}

function functionA(counter=0){
	if(counter <=0){
		return;
	}
	return functionB(counter-1);
}

function Extender () constructor {
	static counter = 0;
	counter += 1;
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
echo("A",json_stringify(a)); // { something_static : "YES", changeStatic : function gml_Script_changeStatic_Extender_gml_GlobalScript_ScriptA, internal : 10 }
echo("B",json_stringify(b), b.something_static); // { internal : 10 } noooo

// Statics only appear if a static has been overwritten
show_debug_message(json_stringify(a));
show_debug_message(json_stringify(b));

// How to struct functions differ betweened static and owned?
echo("A", variable_struct_get_names(a), variable_struct_exists(a,"internal_undefined"), variable_struct_exists(a,"static_undefined"))

var c = new Extender();
b.changeStatic("HUH");
echo(b.something_static,c.something_static); // HUH noooo 
echo("COUNTER", b.counter, c.counter); // COUNTER 3 3 
echo(is_undefined(b.something_static), is_undefined(c.something_static)); // 0 0


echo("STATIC GET",json_stringify(static_get(Extender)));
