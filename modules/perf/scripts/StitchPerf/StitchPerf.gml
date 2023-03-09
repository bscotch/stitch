var lib = new StitchPerfLib();

function StitchTimer() constructor {
	static lib = new StitchPerfLib();
	
	self._start_time = get_timer();
	self._marks = lib.create_real_array();
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
/// @param {Struct} [_context={}]
function stitch_perf_run(
	_description,
	_test,
	_context={},
	_baseline_function=function(_i){},
	_runs=5,
	_iterations_per_run=10000
) {
	static lib = new StitchPerfLib();
	var _baseline_medians = lib.create_real_array(_runs,0);
	var _run_medians = lib.create_real_array(_runs,0);
	_baseline_function = method(_context, _baseline_function);
	_test = method(_context, _test);
	
	var _baseline_timer = new StitchTimer();
	for(var _run = 0 ; _run < _runs ; _run++){
		for(var _i = 0 ; _i < _iterations_per_run ; _i++){
			_baseline_function(_i);
		}
		_baseline_timer.mark();
	}
	
	var _test_timer = new StitchTimer();
	for(var _run = 0 ; _run < _runs ; _run++){
		for(var _i = 0 ; _i < _iterations_per_run ; _i++){
			_test(_i);
		}
		_test_timer.mark();
	}
	
	// Diff the values
	var _time_cost = _test_timer.stats().median - _baseline_timer.stats().median ;
	var _normalized_time_cost = _time_cost / _iterations_per_run ;
	lib.echo("PERF      | " + _description );
	lib.echo("MICROSECS | " + string(_normalized_time_cost));
	return {
		baseline_timer: _baseline_timer,
		test_timer: _test_timer,
		normalized_iteration_time: _normalized_time_cost
	}
}