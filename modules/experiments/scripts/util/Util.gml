#macro chr_newline chr(10)

/// @returns {Array<Struct.MemoryUsage>}
function array_of_memory_usage (length=0){
	return array_create_ext(length, function(){ return new MemoryUsage()});
}

function random_letter(){
	static characters = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
	var idx = irandom_range(0,array_length(characters)-1);
	return characters[idx];
}

function MemoryUsage () constructor {
	totalUsed = 0
	peakUsage = 0
}

function MemoryTrace () constructor {
	snapshots = array_of_memory_usage();
	
	static mark = function mark(){
		array_push(snapshots, debug_event("DumpMemory",true));
	}
	
	static diffs = function diffs(normalize_by=1){
		var _diffs = array_of_memory_usage(array_length(snapshots)-1);
		for(var i=0; i<array_length(_diffs); i++){
			var _diff = _diffs[i];
			var _first = snapshots[i];
			var _second = snapshots[i+1];
			_diff.totalUsed = (_second.totalUsed - _first.totalUsed)/normalize_by;
			_diff.peakUsage = (_second.peakUsage - _first.peakUsage)/normalize_by;
		}
		return _diffs;
	}
}

/// @returns {Struct.MemoryTrace}
function start_memory_trace (){
	var _trace = new MemoryTrace();
	_trace.mark();
	return _trace;
}


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
