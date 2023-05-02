# Stitch for VSCode

This extension provides language features for GameMaker Language (GML), among other helpers for GameMaker project development.

**⚠️ IN EARLY DEVELOPMENT, EXPECT BUGS AND INSTABILITY ⚠️**

*Stitch and its logo are Trademarks of [Butterscotch Shenanigans](https://www.bscotch.net) (a.k.a. "Bscotch"). Stitch and Bscotch are unaffiliated with GameMaker.*

## 💡 Features

- `Stitch: Open in GameMaker` command available via the palette while editing `.yyp`, `.yy`, or `.gml` files, and via the file explorer context menu for the same file types. This command opens the project in the GameMaker IDE version last used by the same project, automatically installing that IDE version if necessary.
- `Stitch: Run Project` command available via the command palette. This command directly runs your project in the GameMaker runtime associated with your IDE version. It overrides the F5 hotkey when you are actively editing a GameMaker project file.
- `Stitch: New GameMaker Project` command available via the file explorer context menu for folders. This command clones a template GameMaker project into that folder. A very basic built-in template is used by default, but can be overridden with the `stitch.template.path` configuration option.
- Tasks for running your project right from VSCode
- GML syntax highlighting, including semantic highlighting for built-in functions and project globals
- Workspace Symbol Search via the command palette.
- Autocomplete for built-in GameMaker functions and constants
- Editor support for a project's global symbols (macros, script functions, script enums, and globalvars)
  - Autocomplete
  - Go-to-definition
  - Find all references
- Autocomplete for a project's resources ( sprite IDs, object IDs, ...)
- JSDoc helpers
  - Snippets to speed up adding JSDocs
  - Autocomplete for global types in JSDocs (built-in and project-specific)
- Format and validate `.yy`/`.yyp` project files. (To use it, set it as your default formatter for those filetypes.)

## Running Projects from VSCode

If you have task autodiscovery turned on, you may be able to find `stitch` listed in your tasks just by opening up your Palette and finding "Tasks: Run Task".

There's still a little jank in the task configuration, so mileage may vary!

<details>
<summary>
💡 Example GML script for getting clickable links from runtime errors.
</summary>

```js
function write_parseable_exception (err){
	var as_string = "FATAL: " + string_trim(err.message);

	var definition_files = ds_map_create();
	var script_functions_string = environment_get_variable("VSCODE_STITCH_SCRIPT_FUNCTIONS");
	if(is_string(script_functions_string) && string_length(script_functions_string) > 0){
		try{
			var pairs = string_split(script_functions_string, ",");
			for(var i=0; i<array_length(pairs); i++){
				if(string_length(pairs[i]) == 0){
					continue;
				}
				var pair = string_split(pairs[i], ":");
				if(array_length(pair) != 2){
					continue;
				}
				definition_files[? pair[0]] = pair[1];
			}
		}
		catch(__err){
			echo(__err);
		}
	}

	for(var i=0; i<array_length(err.stacktrace); i++){
		var _trace = err.stacktrace[i];
		// Example start "gml_Object_o_entry_Create_0 (line 2) - die();"
		if(string_starts_with(_trace, "gml_")){
			var _asset_type = "";
			var _call = "";
			var _line = "";
			var _asset_and_event = "";
			
			_trace = string_delete(_trace,1,4);
			// => "Object_o_entry_Create_0 (line 2) - die();"
			var __parts = string_split(_trace, "_", true, 1);
			// => ["Object","o_entry_Create_0 (line 2) - die();"]
			_asset_type = __parts[0];
			// => "Object"
			var __rest = string_split(__parts[1], " ", true, 1);
			// => ["o_entry_Create_0","(line 2) - die();"]
			_asset_and_event = __rest[0]; // Not all asset types have events, and not all events have numbers
			// => "o_entry_Create_0"
			var __line_and_call = string_split(__rest[1], " - ", true, 1);
			// => ["(line 2)","die();"] // Not all traces have the call entry
			_line = string_replace(string_split(__line_and_call[0], " ", true, 1)[1],")","");
			_call = array_length(__line_and_call)>1 ? __line_and_call[1] : "";
			
			_trace = string_lower(_asset_type) + "s/";
			
			if( ! array_contains(["Object","Script"], _asset_type) ){
				continue;
			}
			
			var folder = _asset_and_event;
			var file = _asset_and_event;
			if(_asset_type == "Object"){
				// Need to separate the asset name from the event info
				__parts = string_split(_asset_and_event, "_");
				var __event_number = array_pop(__parts);
				var __event_name   = array_pop(__parts);
				folder = array_join(__parts, "_");
				file = __event_name + "_" + __event_number;
			}
			else if(is_string(definition_files[? _asset_and_event])){
				folder = definition_files[? _asset_and_event];
				file = folder;
			}
			_trace += folder + "/" + file + ".gml:" + _line;
			if(_call != ""){
				_trace += "  " + _call;
			}
		}
		as_string += "\n" + string_repeat("  ",i+1) + "⇨ " + string_trim(_trace);
	}
	var sep = "\n\n#####################\n\n";
	show_debug_message(sep + as_string + sep);
	ds_map_destroy(definition_files);
	game_end(1);
}

var vscode_stitch_version = environment_get_variable("VSCODE_STITCH_VERSION");
if(is_string(vscode_stitch_version) && vscode_stitch_version != ""){
	exception_unhandled_handler(write_parseable_exception);
}
```

</details>


## 🛣️ Roadmap

- Add dynamic syntax highlighting for the different resource types so they can be color-coded in the theme
- Add tree for project resources, including object events
  - Organized based on the same in-game folder view
  - Add ability to create, delete, and rename resources (sprites, etc)
- Improve autocomplete for global enums (the `.` trigger should check to the left to see what we're dotting into)
- Add resource-specific built-in autocompletes (e.g. `x` in objects)
- Differentiate the different types and scopes of variables during parsing
- Add go-to-definition and find-references for non-global identifiers
- Add commands for running projects directly through the Runtime
- Add commands for changing the target IDE & runtime version
- Rename project-specific globals
- Add mechanism to dynamically load syntax definitions that match the project's runtime version

## ⚙️ Supported GameMaker versions

Different GameMaker versions may have different features and built-in functions, constants, etc. This extension will still work with many other GameMaker project versions, but it might give you incorrect autocompletes or surprising command outcomes!

This extension uses the GameMaker syntax definitions provided by the `GmlSpec.xml` file from GameMaker Runtime `2023.200.0.312`. You can configure this extension to use a different spec file.

## Requirements

- A GameMaker project created with a recent version of GameMaker

<!-- ## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something. -->

## ⁉️ Known Issues

- 🔥 When using `Find all references`, not all references are found
