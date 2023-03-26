var count = 10_000;
function MyConstructor () constructor {}

function MyStaticyConstructor () constructor {
	static whatever = undefined;
	static weeooo = "nope";
	static oh_geez = [];

  static a = undefined;
  static b = undefined;
  static c = undefined;
  static d = undefined;
  static e = undefined;
  static f = undefined;
  static g = undefined;
  static h = undefined;
  static i = undefined;
  static j = undefined;
  static k = undefined;
  static l = undefined;
  static m = undefined;
  static n = undefined;
  static o = undefined;
  static p = undefined;
  static q = undefined;
  static r = undefined;
  static s = undefined;
  static t = undefined;
  static u = undefined;
  static v = undefined;
  static w = undefined;
  static z = undefined;
	
	static my_func = function (){};
	static a_func = function (){};
	static b_func = function (){};
	static c_func = function (){};
}

function MyChild () : MyStaticyConstructor () constructor {
	static another_func = function(){}
	static aa = undefined;
	static bb = undefined;
}

// EMPTY STRUCT
var memory = start_memory_trace();
for(var i=0; i<count; i++){
	var a = {}
}
memory.mark();
echo("Empty structs", memory.diffs(count));

// EMPTY CONSTRUCTOR
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var a = new MyConstructor();
}
memory.mark();
echo("Empty constructs", memory.diffs(count));

// ONLY STATICS
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var a = new MyStaticyConstructor();
}
memory.mark();
echo("Staticy constructs", memory.diffs(count));

// CHILDREN
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var a = new MyChild();
}
memory.mark();
echo("Child constructs", memory.diffs(count));

// PLAIN STRUCT WITH VARIABLE VALUES
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = {
		a: "a",
		b: false
	}
}
memory.mark();
echo("Non-empty POJOs", memory.diffs(count));

// CONSTRUCTED EMPTY, THEN ADDING FIELDS
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = new MyConstructor();
	val[$ "a"] = "a";
	val[$ "b"] = false;
}
memory.mark();
echo("Non-empty empty-constructor", memory.diffs(count));

// CONSTRUCTED WITH STATICS, THEN SETTING FIELDS
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = new MyStaticyConstructor();
	val[$ "a"] = "a";
	val[$ "b"] = false;
}
memory.mark();
echo("Non-empty staticy-constructor", memory.diffs(count));

// CONSTRUCTED WITH CHILDREN, THEN SETTING FIELDS
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = new MyChild();
	val[$ "a"] = "a";
	val[$ "b"] = false;
}
memory.mark();
echo("Non-empty child-constructor", memory.diffs(count));

// POJO with random fields
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = {};
	repeat(10){
		val[$ random_letter()] = random_letter();
	}
}
memory.mark();
echo("POJO with random fields", memory.diffs(count));

// Empty constructor with random fields
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = new MyConstructor();
	repeat(10){
		val[$ random_letter()] = random_letter();
	}
}
memory.mark();
echo("Empty constructor with random fields", memory.diffs(count));

// Staticy constructor with random fields
memory = start_memory_trace();
for(var i=0; i<count; i++){
	var val = new MyStaticyConstructor();
	repeat(10){
		val[$ random_letter()] = random_letter();
	}
}
memory.mark();
echo("Staticy constructor with random fields", memory.diffs(count));

// Can I dot into a function?
function plain_func(){
	static counter = 0;
	counter++;
}
plain_func();


var plain_method = method({hello:"world"}, plain_func);
plain_method();

var secondary_method = method({hmmm:"what?"}, plain_method);
repeat(10){ secondary_method() }

plain_method.nope = "yes";
repeat(10){ plain_method() }

function AStruct () constructor {
	echo("AStruct:",self);
	static count = 0;
	count+=1;
	ok = "great";
	
	return ok + string(count)
}

/// @returns {Struct.AStruct}
var constructor_method = method({how: "does this work?"}, AStruct);

repeat(10){ AStruct() }
repeat(10){ var _ = new AStruct() }
echo("AStruct", static_get(AStruct).count)

echo("PLAIN FUN STATIC",
	static_get(plain_func),
	static_get(plain_func) == static_get(plain_method));
echo("PLAIN METHOD",
	plain_method,
	plain_method.nope,
	typeof(plain_method),
	typeof(static_get(plain_method)),
	static_get(plain_method),
	static_get(static_get(plain_method))
	);
echo("CONSTRUCTOR FUNCTION",
	new AStruct(),
	AStruct(),
	static_get(AStruct),
);
echo("CONSTRUCTOR METHOD",
	new constructor_method(),
	new constructor_method().count
)



game_end();