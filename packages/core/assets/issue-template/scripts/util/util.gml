#macro chr_newline chr(10)

/**
  * @description Throw an error if a condition is not met.
  * @param {Any} condition
  * @param {String} [error_message]
  * @param {Any} [...]
  */
function assert(condition, error_message = "Error: Assertion failed.") {
	if(!!condition){
		return;
	}
	var _callstack = debug_get_callstack();
  echo("Assertion failed at", _callstack[1]);
  echo(_callstack);
		
	if argument_count > 2 {
		for ( var i = 2; i < argument_count; i++) {
			error_message += " " + string(argument[i]);
		}
	}
		
  show_error(error_message, true);
  return false;
}

/**
	* @description Throw if the two values are unequal
	* @param {Any} value0
	* @param {Any} value1
	*/
function assert_equals(value0, value1) {
	assert(
		value0 == value1,
		string(value0), "does not equal", string(value1)
	)
}

/// @description Create a string by joining array elements
/// @param {Array<Any>} _array
/// @param {String} [_delimiter=", "]
function array_join(_array, _delimiter=", "){
	var _text = "";
	for ( var i = 0; i < array_length(_array); i++){
		_text += string(_array[i]);
		if (i < array_length(_array)-1) {
			_text += string(_delimiter);
		}
	}
	return _text;
}

/// @description Write info to the console.
/// @param {Any} [...]
function echo() {
	var _echo_string="";
		
	for(var _echo_item=0 ; _echo_item<argument_count ; _echo_item++){
		_echo_string+=string(argument[_echo_item]) + " ";
	}
	var _echo_coming_from_struct = is_struct(self);
	var _final_string = _echo_coming_from_struct ? "Struct" : object_get_name(object_index);
		
	_final_string += "|" + string(get_timer()/1000000) + "| " + _echo_string;
	
	if debug_mode {
		_final_string = string_replace_all(_final_string, "%", "*");
	}
		
	show_debug_message(_final_string);
}