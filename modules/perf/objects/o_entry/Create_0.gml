var perf = new StitchPerf();

#region FUNCTIONS
perf.run("Functions: Identity", double_identity);
#endregion

#region CREATING STRUCTS
perf.run("Structs: Create using constructor", function (i){ return new StructConstructor(i)} );
perf.run("Structs: Create using function", function (i){ return struct_creator(i) });
perf.run("Structs: Create using literal", struct_creator);
perf.run("Structs: Init literal with 3 fields", function(i){ return {i:i, a: "hi", b: "hello"}});
perf.run("Structs: Init literal with 6 fields", function(i){ return {i:i, a: "hi", b: "hello", c: "world", d:true, e:1000}});

#endregion

var obj = {"hello": "world"};
var map = ds_map_create();
ds_map_add(map,"hello","world");

#region STRUCT GETTERS
	perf.run( "Struct Getters: struct.field",
		function (){return self.hello},
		function(){return self},
		obj);
	
	perf.run( "Struct Getters: struct[$field]",
		function (){return self[$ "hello"]},
		function(){return self},
		obj );
	
	perf.run( "Struct Getters: variable_struct_get",
		function (){return variable_struct_get(self, "hello")},
		function(){return self},
		obj);
#endregion

#region MAP GETTERS
	perf.run( "Map Getters: ds_map_get",
		function (){return ds_map_find_value(self.map, "hello")},
		function (){return self.map},
		{map: map});
	
	perf.run( "Map Getters: [?]",
		function (){return self.map[? "hello"]},
		function (){return self.map},
		{map: map});
#endregion

#region STRUCT SETTERS
	perf.run( "Struct Setters: struct.field",
		function (i){self.hello = i},
		function(){return self},
		obj);
	
	perf.run( "Struct Setters: struct[$field]",
		function (i){self[$ "hello"]=i},
		function(){return self},
		obj );
	
	perf.run( "Struct Setters: variable_struct_get",
		function (i){return variable_struct_set(self, "hello",i)},
		function(){return self},
		obj );
#endregion

#region MAP SETTERS
	perf.run( "Map Setters: map[?field]",
		function (i){self.map[? "hello"]=i},
		function(){return self.map},
		{map: map} );
	
	perf.run( "Map Setters: ds_map_set",
		function (i){return ds_map_set(self.map, "hello",i)},
		function(){return self.map},
		{map: map} );
#endregion

#region DYNAMIC STRUCTS
	var many_fields = {};
	perf.run( "Dynamic Struct Setters: adding many fields",
		function (i){ self[$ string(i)] = i },
		function (i){ string(i); return self },
		many_fields);
	
	// `many_fields` now has one key per iteration.
	// Accessing each key will prevent GameMaker from caching
	// subsequent accessors, so we can see the no-cache cost
	perf.run("Dynamic Struct Getters: getting many fields",
		function (i){ return self[$ string(i)]},
		function (i){ string(i); return self },
		many_fields);
#endregion

#region DYNAMIC MAPS
	var many_fields_map = ds_map_create();
	perf.run( "Dynamic Map Setters: adding many fields",
		function (i){ ds_map_add(self.many_fields_map, string(i), i) },
		function (i){ string(i); return self.many_fields_map },
		{many_fields_map: many_fields_map});

	// Get each field in turn to prevent caching
	perf.run( "Dynamic Map Getters: getting many fields",
		function (i){ ds_map_find_value(self.many_fields_map, string(i)) },
		function (i){ string(i); return self.many_fields_map },
		{many_fields_map: many_fields_map});
#endregion

#region WITHING
var with_into = {field: "value"};
perf.run("WITH: struct",
	function(){
		var stuff = {a: "hello", b: "world", c: 10, d: undefined};
		with(stuff){
			a = "meh";
			b = "pleh";
			c = "100";
			d = 10;
		}
	},
	function(){
		var stuff = {a: "hello", b: "world", c: 10, d: undefined};
		stuff.a = "meh";
		stuff.b = "pleh";
		stuff.c = "100";
		stuff.d = 10;
	});

perf.run("WITH: object identifier",
	function(){
		with(o_whatever){
			a = 1;
		}
	},
	function(){
		with(struct){
			a = 2;
		}
	},
	{struct: {a:1}});

var objects_count = 50;
var buncha_objects = array_create_ext(objects_count, function(){ return instance_create_depth(0,0,0, o_whatever)});

perf.run("WITH: identifier vs. loop for many objects",
	function(){
		with(o_whatever){
			a = 3;
		}
	},
	function(){
		for(var i=0; i<objects_count; i++){
			objs[i].a = 4;
		}
	},
	{objs: buncha_objects, objects_count: objects_count});

#endregion