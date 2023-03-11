function StitchPerf () constructor {

	self.default_runs = 5;
	self.default_iterations = 10000;
	
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
	
	/// @desc Get the mean of an array of numbers
	/// @param {Array<Real>} _nums
	static array_mean = function array_mean (_nums) {
		var sum = 0;
		var count = array_length(_nums);
		for(var i=0; i<count; i++){
			sum += _nums[i];
		}
		return sum/count;
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
	
	/// @param {String} _title
	/// @param {Function} _runner
	/// @param {Function} [_baseline_runner] The time to run this function will be subtracted from the _runner function
	/// @param {Function|Struct} [_setup] A function that returns the struct to use as the function's `self` context prior to each run, or a struct to use for all runs
	static run = function(
		_title,
		_runner,
		_baseline_runner=function(_current_iteration, _total_iterations, _current_run, _total_runs){},
		_setup=function(_current_run, _total_runs, _total_iterations){return {}},
		_runs=self.default_runs,
		_iterations_per_run=self.default_iterations
	) {
		var _create_array = self.create_real_array;
		var _summary = {
			title: _title,
			iteration_difference: 0,
			runner: {
				runs: _create_array(_runs, 0),
				run_average: 0,
				iteration_average: 0
			},
			baseline: {
				runs: _create_array(_runs, 0),
				run_average: 0,
				iteration_average: 0,
			}
		};
		
		for(var _scenario=0 ; _scenario < 2 ; _scenario++ ){
			var _stats  = _scenario == 0 ? _summary.baseline : _summary.runner ;
			var _to_run = _scenario == 0 ? _baseline_runner : _runner ;
			for(var _run = 0 ; _run < _runs ; _run++){
				var _context = is_callable(_setup)
					? _setup(_run, _runs, _iterations_per_run)
					: _setup;
				var _with_context = method(
					_context,
					_to_run
				);
				var _start = get_timer();
				for(var _i = 0 ; _i < _iterations_per_run ; _i++){
					_with_context( _i, _iterations_per_run, _run, _runs );
				}
				_stats.runs[_run] = get_timer() - _start;
			}
			_stats.run_average = self.array_mean(_stats.runs);
			_stats.iteration_average = _stats.run_average / _iterations_per_run ;
			if(_scenario == 1){
				_summary.iteration_difference = _summary.runner.iteration_average - _summary.baseline.iteration_average;	
			}
		}
	
		// Diff the values
		self.echo("PERF |", _summary.iteration_difference, "|", _title, "|", _summary.runner.runs );
		return _summary
	}
}

