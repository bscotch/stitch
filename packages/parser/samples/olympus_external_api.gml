/**
@desc Starts a named test suite
@param {string} suite_name The name of the suite
@param {function} function_to_add_tests_and_hooks a function that adds all the tests and hooks 
@param {struct.Olympus_Suite_Options} [olympus_suite_options] Optional configuration to pass in
*/
function olympus_run(suite_name, function_to_add_tests_and_hooks, olympus_suite_options = new Olympus_Suite_Options()) {
	function_to_add_tests_and_hooks_with_context = method(self, function_to_add_tests_and_hooks);
	return new _Olympus_Suite(suite_name,function_to_add_tests_and_hooks_with_context, olympus_suite_options);
}

/*
@desc configuration to pass to olympus_run()
@typedef {struct} Olympus_Suite_Options 
	@property {boolean}	[abandon_unfinished_record=false] - Enabling this disables the suite from resuming unfinished records that are caused by runner existing during the test.
	@property {boolean}	[skip_user_feedback_tests=false] - Enabling this skips tests that requires user feedback.
	@property {boolean}	[suppress_debug_logging=false] - Enabling this suppresses Olympus from logging to the IDE Output tab.
	@property {number}	[test_interval_millis=0.01] - Adds a delay between each test. Can be used to allow an audio or a visual cue to be played between tests.
	@property {string}		[global_resolution_callback_name="callback"] - Name of the instance variable for the resolution callback
	@property {string}		[global_rejection_callback_name="reject"] - Name of the instance variable for the rejection callback
	@property {boolean}	[bail_on_fail_or_crash=false] - Enabling this will skip the rest of the tests if an earlier test fails or crashes
	@property {struct} [context] The binding context for function_to_add_tests_and_hooks. The default uses the calling context.
	@property {number} [global_timeout_millis=60000] If any test is not able to resolve within this many milliseconds, the test will be failed.
	@property {boolean} [allow_uncaught=false] By default, Olympus catches uncaught error and record it. Enabling this allows uncaught error to be thrown instead and will stop recording test summaries or resuming unfinished records. 
	@property {boolean} [ignore_if_completed=false] Enabling this will ignore re-running the suite if the suite has been completed previously. 
	@property {boolean} [forbid_only=false] Forbid test that uses the olympus_test_options_only option.
	@property {boolean} [forbid_skip=false] Forbid skipping tests.
	@property {boolean} [exit_on_completion=false] Call game_end() when suite completes.
	@property {boolean} [bypass_only=false] Run all tests and bypass the olympus_test_options_only option.
	@property {boolean} [allow_uncaught_silent_termination=false] Allow uncaught errors to exit the runner instead of serving the error report window.
*/
function Olympus_Suite_Options() constructor{
	abandon_unfinished_record = false
	skip_user_feedback_tests = false
	suppress_debug_logging = false
	test_interval_millis = 0
	global_resolution_callback_name = "callback"
	global_rejection_callback_name = "reject"
	bail_on_fail_or_crash = false
	context = undefined
	global_timeout_millis = 60000
	allow_uncaught = false
	ignore_if_completed = false
	forbid_only = false
	forbid_skip = false
	exit_on_completion = false
	bypass_only = false
	allow_uncaught_silent_termination = false
}

#region olympus_suite_options
	#macro olympus_suite_options_abandon_unfinished_record abandon_unfinished_record
	#macro olympus_suite_options_skip_user_feedback_tests skip_user_feedback_tests
	#macro olympus_suite_options_suppress_debug_logging suppress_debug_logging
	#macro olympus_suite_options_test_interval_millis test_interval_millis
	#macro olympus_suite_options_global_resolution_callback_name global_resolution_callback_name
	#macro olympus_suite_options_global_rejection_callback_name global_rejection_callback_name
	#macro olympus_suite_options_bail_on_fail_or_crash bail_on_fail_or_crash
	#macro olympus_suite_options_context context
	#macro olympus_suite_options_global_timeout_millis global_timeout_millis 
	#macro olympus_suite_options_allow_uncaught allow_uncaught
	#macro olympus_suite_options_ignore_if_completed ignore_if_completed
	#macro olympus_suite_options_forbid_only forbid_only
	#macro olympus_suite_options_forbid_skip forbid_skip
	#macro olympus_suite_options_exit_on_completion exit_on_completion
	#macro olympus_suite_options_bypass_only bypass_only
	#macro olympus_suite_options_allow_uncaught_silent_termination allow_uncaught_silent_termination
#endregion

/** 
@desc Adds a unit test with a name and a function with synchronous logic to execute
@param {string} name Name of the test
@param {function} function_to_execute_synchronous_logic The function to execute the synchronous logic
@param {struct.Olympus_Test_Options} [olympus_test_options] optional configurations to pass in
 */
function olympus_add_test(name, function_to_execute_synchronous_logic, olympus_test_options = new Olympus_Test_Options()){	
	function_to_execute_synchronous_logic = method(self, function_to_execute_synchronous_logic);
	olympus_test_options[$ "_olympus_suite_ref"] = _olympus_suite_ref;
	var this_test = new _Olympus_Test(name, function_to_execute_synchronous_logic, undefined, undefined, olympus_test_options);
	return this_test;
}

/*
@desc Optional configurations to pass to olympus_add_*()
@typedef {struct} Olympus_Test_Options 
	@property {string} [resolution_callback_name] If you have not defined a global_resolution_callback_name or want to overwrite that, specify it here
	@property {string} [rejection_callback_name] If you have not defined a global_rejection_callback_name or want to overwrite that, specify it here
	@property {string | string[]} [dependency_names] Names of tests whose failure will cause this test to be skipped
	@property {struct} [contex] The binding context for function_to_spawn_object. The default uses the calling context.
	@property {struct} [resolution_context] The binding context for function_to_execute_at_resolution. The default uses the calling context.	
	@property {number} [timeout_millis]  If this test is not able to resolve within this many milliseconds, the test will be failed. Default to the suite's default global timeout millis.
	@property {boolean} [only] Enabling this option will disable other tests that don't have this option enabled
	@property {enum} [importance=olympus_test_importance.normal] The importance level of the test.
 */
function Olympus_Test_Options() constructor{
	resolution_callback_name = undefined
	rejection_callback_name = undefined
	dependency_names = undefined
	context = undefined
	resolution_context = undefined
	timeout_millis = undefined
	only = false
	importance = olympus_test_importance.normal
}

#region olympus_test_options
	#macro olympus_test_options_resolution_callback_name resolution_callback_name
	#macro olympus_test_options_rejection_callback_name rejection_callback_name
	#macro olympus_test_options_dependency_names dependency_names
	#macro olympus_test_options_context context
	#macro olympus_test_options_resolution_context resolution_context
	#macro olympus_test_options_timeout_millis timeout_millis
	#macro olympus_test_options_only only
	#macro olympus_test_options_importance importance
#endregion

/** 
@desc Adds a unit test with a name and a function that spawns an object that mediates async logic
@param {string} name Name of the test
@param {function} function_to_spawn_object The function to spawn the mediator object
@param {function} [function_to_execute_at_resolution] The function to be executed when the async function resolves. The async result can be passed to this function for consumption.
@param {struct.Olympus_Test_Options} [olympus_test_options] optional configurations to pass in
 */
function olympus_add_async_test(name, function_to_spawn_object, function_to_execute_at_resolution = function(){} , olympus_test_options = new Olympus_Test_Options()){
	function_to_spawn_object = method(self, function_to_spawn_object);
	function_to_execute_at_resolution = method(self, function_to_execute_at_resolution);
	olympus_test_options[$ "_olympus_suite_ref"] = _olympus_suite_ref;
	var this_test = new _Olympus_Test(name, function_to_spawn_object, function_to_execute_at_resolution, undefined, olympus_test_options);
	return this_test;
}


/** 
@desc Similar to olympus_add_async_test, but also specifies a text prompt to user to allow the user to fail the test and provide feedback
@param {string} name Name of the test
@param {string} prompt The text prompt to instruct the user about the pass/fail creteria
@param {function} function_to_spawn_object The function to spawn the mediator object
@param {function} [function_to_execute_at_resolution] The function to be executed when the async function resolves. The async result can be passed to this function for consumption.
@param {struct.Olympus_Test_Options} [olympus_test_options] optional configurations to pass in
 */
function olympus_add_async_test_with_user_feedback(name, prompt, function_to_spawn_object, function_to_execute_at_resolution = function(){}, olympus_test_options = new Olympus_Test_Options()){	
	function_to_spawn_object = method(self, function_to_spawn_object);
	function_to_execute_at_resolution = method(self, function_to_execute_at_resolution);
	olympus_test_options[$ "_olympus_suite_ref"] = _olympus_suite_ref;
	var this_test = new _Olympus_Test(name, function_to_spawn_object, function_to_execute_at_resolution, prompt, olympus_test_options);
	return this_test;
}

/** 
@desc Syntactic sugar to omit running a suite
@param {string} suite_name Name of the suite
@param {any} [...] 
 */
function xolympus_run(suite_name) {
	show_debug_message("Skipped running the suite: " + suite_name);
}

/** 
@desc Syntactic sugar to skip a test added by olympus_add_test
@param {string} name Name of the test
@param {any} [...] 
 */
function xolympus_add_test(name){	
	var this_test = olympus_add_test(name, function(){});
	this_test.disabled = true;
	return this_test;
}

/** 
@desc Syntactic sugar to skip a test added by olympus_add_async_test
@param {string} name Name of the test
@param {any} [...] 
 */
function xolympus_add_async_test(name){
	var this_test = xolympus_add_test(name);
	return this_test;
}

/** 
@desc Syntactic sugar to skip a test added by olympus_add_async_test_with_user_feedback
@param {string} name Name of the test
@param {any} [...] 
 */
function xolympus_add_async_test_with_user_feedback(name){	
	var this_test = xolympus_add_async_test(name);
	return this_test;
}

/**
@desc Set a function to be excuted before each test starts. The test summary struct is passed to this function as the first argument.
@param {function} function_to_execute The function to execute
@param {Struct} [context] The optional context to bind the function to. The default uses the calling context.
*/
function olympus_add_hook_before_each_test_start(function_to_execute, context = undefined){
	var function_with_setup = _olympus_hook_set_up(function_to_execute, context);
	_olympus_suite_ref.function_to_call_on_test_start = function_with_setup;
}

/** 
@desc Set a function to be excuted after each test finishes. The test summary struct is passed to this function as the first argument.
@param {function} function_to_execute The function to execute
@param {Struct} [context] The optional context to bind the function to. The default uses the calling context.
*/
function olympus_add_hook_after_each_test_finish(function_to_execute, context = undefined){
	var function_with_setup = _olympus_hook_set_up(function_to_execute, context);
	_olympus_suite_ref.function_to_call_on_test_finish = function_with_setup;
}

/**
@desc Set a function to be excuted before the suite starts. The suite summary struct is passed to this function as the first argument.
@param {Function} function_to_execute The function to execute
@param {Struct} [context] The optional context to bind the function to. The default uses the calling context.
*/
function olympus_add_hook_before_suite_start(function_to_execute, context = undefined){
	var function_with_setup = _olympus_hook_set_up(function_to_execute, context);
	_olympus_suite_ref._function_to_call_on_suite_start = function_with_setup;
}

/** 
@desc Set a function to be excuted after the suite finishes. The suite summary struct is passed to this function as the first argument.
@param {function} function_to_execute The function to execute
@param {Struct } [context] The optional context to bind the function to. The default uses the calling context.
 */
function olympus_add_hook_after_suite_finish(function_to_execute, context = undefined){
	var function_with_setup = _olympus_hook_set_up(function_to_execute, context);
	_olympus_suite_ref._function_to_call_on_suite_finish = function_with_setup;
}

/** 
@desc Return a copy of the up-to-date suite summary struct. 
@return {Struct._Olympus_Summary_Manager._summary}
*/
function olympus_get_current_suite_summary(){
	return global._olympus_suite_manager.current_suite._my_summary_manager_ref.get_summary();
}

/**
@desc Return a boolean of whether the current suite contains failed or crashed tests
*/
function olympus_current_suite_summary_has_failure_or_crash(){
	return global._olympus_suite_manager.current_suite._my_summary_manager_ref.has_failure_or_crash();
}

/**
@desc Return an array of test summaries for the tests that failed or crashed
*/
function olympus_get_failed_or_crashed_tests(){
	return global._olympus_suite_manager.current_suite._my_summary_manager_ref.get_failed_or_crashed_tests();
}

/** 
@desc Return a copy of the array that contains all the up-to-date test summaries. 
*/
function olympus_get_current_test_summaries(){
	return global._olympus_suite_manager.current_suite._my_summary_manager_ref.get_summary().tests;
}

/** 
@desc Return the status of a unit test. 
@param {struct} test_summary The test summary struct
*/
function olympus_get_test_status(test_summary){	
	return test_summary.status;
}

/** 
@desc Return the name of a unit test. 
@param {struct} test_summary The test summary struct
*/
function olympus_get_test_name(test_summary){
	return test_summary.name;
}

/** 
@desc Tests added between olympus_test_dependency_chain_begin() and olympus_test_dependency_chain_end() are sequentially dependent on each self
*/
function olympus_test_dependency_chain_begin(){
	_olympus_suite_ref.dependency_chain_begin();
}

/** 
@desc Tests added between olympus_test_dependency_chain_begin() and olympus_test_dependency_chain_end() are sequentially dependent on each self
*/
function olympus_test_dependency_chain_end(){
	_olympus_suite_ref.dependency_chain_end();
}

/**
@desc Allows setting the global option olympus_suite_options_test_interval_millis in the mid of a suite  
@param {Real}	[test_interval_millis=0.01] - Adds a delay between each test. Can be used to allow an audio or a visual cue to be played between tests.
*/
function olympus_set_interval_millis_between_tests(test_interval_millis = olympus_test_interval_millis_default){
	var current_suite = global._olympus_suite_manager.current_suite;
	if (is_struct(current_suite)){
		current_suite.test_interval_millis = test_interval_millis;
	}
}

/**
@desc Spawn an awaiter object that wait for the creation of a target object. If the target is created, the awaiter is destroyed, and the target's instance ID is returned. 
@param {Id.Instance | Asset.GMObject}	_object_to_wait The target object to wait for
*/
function olympus_spawn_object_creation_awaiter(_object_to_wait){
	//Feather ignore GM1013 Need to detect variables from enclosing context
	//Feather ignore GM1041 Need to support union types
	return olympus_spawn_awaiter(function(){return instance_exists(object_to_wait)}, {object_to_wait: _object_to_wait});
}

/**
@desc Spawn an awaiter object that wait for the absence of a target object. If the target no longer exists, the awaiter is destroyed. 
@param {Id.Instance | Resource.GMObject}	_object_to_wait The object to wait for
*/
function olympus_spawn_object_absence_awaiter(_object_to_wait){
	//Feather ignore GM1013 Need to detect variables from enclosing context
	//Feather ignore GM1041 Need to support union types
	return olympus_spawn_awaiter(function(){return !instance_exists(object_to_wait)}, {object_to_wait: _object_to_wait});
}

/**
@desc Spawn an awaiter object that evaluate the return of a function at every step. When the function evaluates true, the awaiter is destroyed.
@param {function} function_to_wait_for The function to evaluate.
@param {Struct} [context = self] The binding context for function_to_wait_for. The default uses the calling context. 
*/
function olympus_spawn_awaiter(function_to_wait_for, context = self){
	function_to_wait_for = method(context, function_to_wait_for);
	var awaiter = instance_create_depth(0,0,0, _olympus_async_awaiter);
	awaiter._function_to_wait_for = function_to_wait_for;
	return awaiter;
}

#region Macros
/**
@desc Calls the resolution function of the current test
@arg {*} [args...] Can take any arguments
 */
#macro olympus_test_resolve \
var olympus_resolve_callback_handle = _olympus_get_resolve_function_handle(); \
olympus_resolve_callback_handle

/**
@desc Calls the rejection function of the current test
@arg {*} [args...] Can take any arguments
 */
#macro olympus_test_reject \
var olympus_reject_callback_handle = _olympus_get_reject_function_handle(); \
olympus_reject_callback_handle


/** 
@desc In the test summary struct, the "status" key uses the following macros 
 */
 #macro olympus_test_status_unstarted  "unstarted"
 #macro olympus_test_status_running  "running"
 #macro olympus_test_status_getting_user_feedback "getting_user_feedback"
 #macro olympus_test_status_passed  "passed"
 #macro olympus_test_status_failed  "failed"
 #macro olympus_test_status_skipped  "skipped"
 #macro olympus_test_status_crashed "crashed"

/** 
@desc In the error struct, the "code" field uses the following enums
 */
enum olympus_error_code{
	unhandled_exception = 0,
	uncaught_crash = 1,
	skip_with_x = 2,
	skip_with_suppress = 3,
	skip_with_dependency = 4,
	skip_with_bail = 5,
	timeout = 6,
	user_rejection = 7,
	user_cancellation = 8,
	failed_resolution = 9,
	failed_async_mediator_spawning = 10,
	failed_sync = 11,
	user_defined = 12
}

enum olympus_test_importance{
	low = 100,
	normal = 200,
	high = 300
}

#endregion