#macro chr_newline chr(10)

function StitchPerfLib () constructor {
	
	/**
	  * @description Throw an error if a condition is not met.
	  * @param {Any} _condition
	  * @param {String} [_error_message]
	  * @param {Any} [...]
	  */
	static assert = function assert(_condition, _error_message = "Error: Assertion failed.") {
		if(!!_condition){
			return;
		}
		var _callstack = debug_get_callstack();
	  echo("Assertion failed at", _callstack[1]);
	  echo(_callstack);
		
		if argument_count > 2 {
			for ( var i = 2; i < argument_count; i++) {
				_error_message += " " + string(argument[i]);
			}
		}
		
	  show_error(_error_message, true);
	  return false;
	}

	/**
		* @description Throw if the two values are unequal
		* @param {Any} _value0
		* @param {Any} _value1
		*/
	static assert_equals = function assert_equals(_value0, _value1) {
		assert(
			_value0 == _value1,
			string(_value0), "does not equal", string(_value1)
		)
	}

	/// @description Create a string by joining array elements
	/// @param {Array<Any>} _array
	/// @param {String} [_delimiter=", "]
	static array_join = function array_join(_array, _delimiter=", "){
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
	static echo = function echo() {
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
	
	/// @desc Create an array typed as Array<Real>
	/// @returns {Array<Real>}
	static create_real_array = function create_real_array (_size=0, _of=0) {
		return array_create(_size, _of);
	}
	
	/// @desc Get the median of an array by sorting and grabbing the middle value.
	///       (WARNING: mutates the array!)
	/// @param {Array<Real>} _nums
	static array_median = function array_median (_nums) {
		
		var _length = array_length(_nums);
		if(_length == 1){
			return _nums[0];
		}
		self.assert(_length > 0, "Cannot take the median of zero elements");
			
		array_sort(_nums, true);
		var middle_idx = _length / 2 ;
		var _right_idx = floor(middle_idx);
		if(_right_idx != middle_idx){
			// Then it was an odd number and we already have the middle idx
			return _nums[_right_idx];
		}
		// otherwise it was an even number and we also need the left side
		return mean(_nums[_right_idx], _nums[_right_idx - 1]);
	}
	
	/// @param {Array<Any>} _src_array
	static array_clone = function array_clone (_src_array){
		var _length = array_length(_src_array);
		var _new_array = array_create(_length);
		array_copy(_new_array, 0, _src_array, 0, _length);
		return _new_array;
	}
}

