/// @template {Any} T
/// @param {T} value
/// @return {T}
function identity(value) {
  return value;
}

var an_array = [1, 2, 3];
var a_string = "hello";

var array_identity = identity(an_array);
var string_identity = identity(a_string);

/// @template {Asset.GMObject} T
/// @param {T} obj
/// @returns {InstanceType<T>}
function instance_create(obj){}

/// @template {Id.Instance} T
/// @param {T} instance
/// @returns {ObjectType<T>}
function object_get(instance){}

var obj = instance_create(o_object);
var inst = object_get(obj);

/// @type {Id.DsMap<Asset.GMObject>}
var map = ds_map_create();
ds_map_add(map, "hello", "world");
var value = ds_map_find_value(map, "hello");
