var lib = new StitchPerfLib();

stitch_perf_run("Structs: Create using constructor", CreateStruct_);
stitch_perf_run("Structs: Create using function", create_struct);


var obj = {"hello": "world"};
var map = ds_map_create();
ds_map_add(map,"hello","world");

// STRUCT GETTERS
stitch_perf_run( "Struct Getters: struct.field",
	function (){return self.hello},
	obj,
	function(){return self});
	
stitch_perf_run( "Struct Getters: struct[$field]",
	function (){return self[$ "hello"]},
	obj,
	function(){return self} );
	
stitch_perf_run( "Struct Getters: variable_struct_get",
	function (){return variable_struct_get(self, "hello")},
	obj,
	function(){return self} );
	
// MAP GETTERS
stitch_perf_run( "Map Getters: ds_map_get",
	function (){return ds_map_find_value(self.map, "hello")},
	{map: map},
	function (){return self.map});
	
stitch_perf_run( "Map Getters: [?]",
	function (){return self.map[? "hello"]},
	{map: map},
	function (){return self.map});

// STRUCT SETTERS
stitch_perf_run( "Struct Setters: struct.field",
	function (i){self.hello = i},
	obj,
	function(){return self.hello});
	
stitch_perf_run( "Struct Setters: struct[$field]",
	function (i){self[$ "hello"]=i},
	obj,
	function(){return self[$ "hello"]} );
	
stitch_perf_run( "Struct Setters: variable_struct_get",
	function (i){return variable_struct_set(self, "hello",i)},
	obj,
	function(){return variable_struct_get(self, "hello")} );

// TODO: MAP SETTERS
	

// DYNAMIC STRUCTS
var lotsa_fields = {};
stitch_perf_run( "Struct Setters: adding fields",
	function (i){ self[$ string(i)] = i },
	lotsa_fields,
	function (i){ return self[$ string(i)] });
	
// DYNAMIC MAPS
var lotsa_map = ds_map_create();
stitch_perf_run( "Struct Setters: adding fields",
	function (i){ ds_map_add(self.lotsa_map, string(i), i) },
	{lotsa_map: lotsa_map},
	function (i){ string(i) });


stitch_perf_run("Functions: Calling cost", double_identity);