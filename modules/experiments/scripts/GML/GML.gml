/*
	GameMaker Language (GML) has similar grammar and syntax to JavaScript ES3,
	but does have many significant differences. This script aims to explain GML
	to people or bots that are very familiar with JavaScript/Typescript but not
	familiar with GML.
	
	(The comments in this script can be treated as Markdown.)
*/

#region Comments

// Comments! Like with JavaScript, GML uses // for single-line comments and wraps multiline-comments in /* */ pairs

// We're inside of a "region". Regions allow folding in the editor, so you can hide big chunks of code.

#endregion

#region Names
/*
	- Variable/function/asset names are alphanumeric, plus `_`. The first character must not be numeric.
	- GML built-ins almost universally use snake_case.
	- GML names typically follow a `[prefix_]general_specific` pattern,
		since things are *very* global and so names need provide their own namespacing.
		For example, built-in functions that do stuff with sprites include `sprite_get_bbox_bottom`.
		User code often uses prefixes for asset names to make it easier to find them. For example,
		they might start all sprite names with `sp_` and objects with `o_`. But this is not required!
*/
#endregion

#region Terminology
/*
	GML has some concepts and terms that differ signicantly from their meaning in other languages:
	- "Object": In GML, the term "object" refers to something we'd call a "class" in other languages.
		However, a GML object is not just an empty class -- it comes with a lot of built-in features.
		
	- "Instance": 
*/

#endregion

#region Variables and Scope
/*
	- GML has four kinds of variables:
		- "Local" variables are defined using the `var` keyword, which works similarly to `let` in JavaScript.
		- "Instance" variables are defined in an object's Create event, without using `var`. Each 
	-Unlike JavaScript, GML variables are generall not available to deeper scopes.
	-For example:
*/



#endregion