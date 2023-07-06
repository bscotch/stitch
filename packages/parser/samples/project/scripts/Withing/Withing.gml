// Should be able to with into something and get correction self-scope, autcompletes, etc
with(BSCHEMA){
  force_use_packed = true;
}

with(o_object){
  instance_variable = 100;
}

/// @type {Id.Instance.o_object}
var o_instance = instance_create_depth(0,0,0,o_object);

with(o_instance){
  instance_variable = 200;
}

var could_be_anything;

/// @self {Id.Instance.o_object}
with(could_be_anything){
  instance_variable = 300;
}

var a_struct = {
  hello: "world"
}
with(a_struct){
  hello = "bye!";
}