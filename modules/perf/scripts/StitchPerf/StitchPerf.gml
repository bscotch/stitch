function StitchPerf () constructor {
	
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
		self.assert(
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
		return self.array_create(_size, _of);
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
	
	static StitchTimer = function StitchTimer() constructor {
		static lib = new StitchPerf();
	
		self._start_time = get_timer();
		self._marks = self.lib.create_real_array();
		self._end_time = infinity;
	
		static start = function start (){
			self.lib.assert( array_length(self._marks) == 0, "Cannot restart a timer after the first mark()" );
			self._start_time = get_timer();
		}
	
		static mark = function mark (){
			var _time = get_timer();
			array_push(self._marks, _time);
			self._end_time = _time;
		}
	
		static stats = function stats (){
			var _marks_count = array_length(self._marks);
			var _diffs = lib.create_real_array(_marks_count);
			for( var i=0 ; i<_marks_count ; i++ ){
				_diffs[i] = self._marks[i] - (i>0 ? self._marks[i-1] : self._start_time);
			}
			var _middle = self.lib.array_median( self.lib.array_clone( _diffs ) );
			return {
				"median": _middle,
				"intervals": _diffs
			}
		}
	
		/// @desc Total time between instantiation and the last mark
		static duration = function duration (){
			return self._end_time - self._start_time;	
		}
	}
	
	/// @param {String} _description
	/// @param {Function} _test
	/// @param {Function} _baseline_function The time to run this function will be subtracted from the _test function
	/// @param {Struct} [_context]
	static run = function(
		_description,
		_test,
		_baseline_function=function(_i){},
		_context={},
		_runs=5,
		_iterations_per_run=10000
	) {

		var _baseline_medians = self.create_real_array(_runs,0);
		var _run_medians = self.create_real_array(_runs,0);
		_baseline_function = method(_context, _baseline_function);
		_test = method(_context, _test);
	
		var _baseline_timer = new self.StitchTimer();
		for(var _run = 0 ; _run < _runs ; _run++){
			for(var _i = 0 ; _i < _iterations_per_run ; _i++){
				_baseline_function(_i);
			}
			_baseline_timer.mark();
		}
	
		var _test_timer = new self.StitchTimer();
		for(var _run = 0 ; _run < _runs ; _run++){
			for(var _i = 0 ; _i < _iterations_per_run ; _i++){
				_test(_i);
			}
			_test_timer.mark();
		}
	
		// Diff the values
		var _time_cost = _test_timer.stats().median - _baseline_timer.stats().median ;
		var _normalized_time_cost = _time_cost / _iterations_per_run ;
		self.echo("PERF |", _normalized_time_cost, "|", _description );
		return {
			baseline_timer: _baseline_timer,
			test_timer: _test_timer,
			normalized_iteration_time: _normalized_time_cost
		}
	}
}

