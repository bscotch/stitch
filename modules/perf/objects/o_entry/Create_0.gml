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
//var random_keys = array_map(array_create(perf.default_iterations,""), function(){ generate_consonumeric_string(6)});

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
	perf.run( "Dynamic Struct Setters: adding many fields",
		function (i,_iterations,_run){ self[$ string(i)] = i },
		function (i,_iterations,_run){ string(i); return self },
		function(){
			return {}
		});
	
	// `many_fields` now has one key per iteration.
	// Accessing each key will prevent GameMaker from caching
	// subsequent accessors, so we can see the no-cache cost
	perf.run("Dynamic Struct Getters: getting many fields",
		function (i){ return self[$ string(i)]},
		function (i){ string(i); return self },
		function(_run,_runs,_iterations){
			var struct = {};
			for(var i=0; i<_iterations; i++){
				struct[$ string(i)] = i;
			}
			return struct;
		});
	
	perf.run("Struct shared keys: get (dot-accessor)",
		function(){
			// Create a new struct each time
			var s = {shared_key: 100};
			// Access it with `.` accessor
			return s.shared_key;
		},
		function(){
			var s = {shared_key: 100};
			return s;
		});
	
	perf.run("Struct shared keys: get ($ accessor)",
		function(){
			// Create a new struct each time
			var s = {shared_key: 100};
			// Access it with `.` accessor
			return s[$ "shared_key"];
		},
		function(){
			var s = {shared_key: 100};
			return s;
		});
	
	perf.run("Struct non-shared keys: get ($ accessor)",
		function(){
			// Create a new struct each time
			var key = generate_consonumeric_string(6);
			var s = {};
			s[$ key] = 100;
			return s[$ "shared_key"];
		},
		function(){
			var key = generate_consonumeric_string(6);
			var s = {};
			s[$ key] = 100;
			return s;
		});
#endregion

#region DYNAMIC MAPS
	perf.run( "Dynamic Map Setters: adding many fields",
		function (i,_iterations,_run){ ds_map_add(dynamic_setters, string(i + _run * _iterations), i) },
		function (i,_iterations,_run){ string(i + _run * _iterations); return dynamic_setters },
		function(){ return {dynamic_setters: ds_map_create()}});

	// Get each field in turn to prevent caching
	perf.run( "Dynamic Map Getters: getting many fields",
		function (i){ return ds_map_find_value(dynamic_getters, string(i)) },
		function (i){ string(i); return dynamic_getters },
		function(_run,_runs,_iterations){
			var dynamic_getters = ds_map_create();
			for(var i=0; i<_iterations; i++){
				ds_map_add(dynamic_getters, string(i), i)
			}
			return {dynamic_getters:dynamic_getters};
		});
#endregion

#region WITHING
var with_into = {field: "value"};
perf.run("With: struct",
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

#region ARRAYS
perf.run("Array: [] getter",
	function(i){ return arr[i] },
	function(i,_iterations){ return arr },
	{arr: array_create(perf.default_iterations,0)});
perf.run("Array: array_get",
	function(i){ return array_get(arr,i) },
	function(i,_iterations){ return arr },
	{arr: array_create(perf.default_iterations,0)});

perf.run("Array: Preallocate vs Push (10 items)",
	function(){
		var arr = array_create(len,0);
		for(var i=0; i<len; i++){};
	},
	function(){
		var arr = [];
		for(var i=0; i<len; i++){ array_push(arr,0) };
	},
	{len: 10});

perf.run("Array: Preallocate vs Push (100 items)",
	function(){
		var arr = array_create(len,0);
		for(var i=0; i<len; i++){}
	},
	function(){
		var arr = [];
		for(var i=0; i<len; i++){ array_push(arr,0) }
	},
	{len: 100});

perf.run("Array: Push vs. Overwrite (large array)",
	function(i){ arr[i] = 100 },
	function(i){ arr[i] = 100 },
	function(_run,_runs,_iterations, _is_runner){
		return {
			arr: _is_runner ? array_create(_iterations, 0) : []
		}
	});
	
perf.run("Array: Push vs. Overwrite (many small arrays)",
	function(){
		var arr = array_create(len,0);
		for(var i=0; i<len; i++){ arr[i] = 100 }
	},
	function(){
		var arr = [];
		for(var i=0; i<len; i++){ arr[i] = 100 }
	},
	{len: 10});


perf.run("Array: Deleting 1st entry of 10-item array",
	function(){
		var arr = array_create(len,0);
		array_delete(arr,5,1);
	},
	function(){
		var arr = array_create(len,0);
	},
	{len: 10});
	


perf.run("Array: Deleting 1st entry of 1000-item array",
	function(){
		var arr = array_create(len,0);
		array_delete(arr,50,1);
	},
	function(){
		var arr = array_create(len,0);
		return arr[0];
	},
	{len: 1000});
#endregion