/// @template {String} T
/// @param {T} value
/// @return {T}
function identity(value) {
  return value;
}

var an_array = [1, 2, 3];
var a_string = "hello";

var array_identity = identity(an_array);
var string_identity = identity(a_string);
