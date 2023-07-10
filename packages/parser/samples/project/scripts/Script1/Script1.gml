/// @desc This is a global variable defined at a script root.
globalvar GLOBAL_SCRIPT_VAR; GLOBAL_SCRIPT_VAR = "HELLO";

/// @desc A global function!
/// @param {Enum.SurpriseEnum} something
function global_function(something, something_else=undefined){
	global.GLOBAL_FUNCTION_VAR = true;
	#macro surprise_macro "SURPRISE!"
}

global.global_function();

/**
	* @desc A global constructor!
	* @param {String} _name
	* @param {String} _description
	*/
function GlobalConstructor (_name, _description) constructor {
	name = _name;
	description = _description;
	var local;
	enum SurpriseEnum { surprise, another_surprise }

	static something_static = function different_name (first,second){
		GLOBAL_SCRIPT_VAR = first;
	}
}

var const = new GlobalConstructor();

function another_global_function(){

}

const.name.hello[0].nope();

/// @param {Real} _whatever
function AnotherConstructor (_whatever) {
	self.whatever = _whatever;
	
	constructed = new GlobalConstructor("nerp", "derp");
}

with o_parent {
	parent_var = "hello";
}

var a_template_string = $"hello {const} {const.name}";

BSCHEMA.force_use_packed = true;

/// @arg hello
function untyped_param_function(){}

/// @arg {Struct.GlobalConstructor} hello
function typed_param_function(){}

var bound = method({a:1,b:2}, function(c,d){
	return a + b + c + d;
});
