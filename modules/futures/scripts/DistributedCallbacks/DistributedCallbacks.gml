function DistributedCallbacks () constructor {
  done = false;
  aborted = false;

  current_callback_idx = -1;
  /// @type {Array<Function.distributed_callback_signature>}
  callbacks = [];
  /// @type {Struct.DistributeOverStepsOptions|Undefined}
  options = undefined;

  /// The values returned by all prior callbacks, in order
  /// @type {Array<Any>}
  values = [];
  /// The value returned by the prior callback
  /// @type {Any}
  last_value = undefined;

  static __done = function(){
    if(self.done){
      return;
    }
    self.done = true;
    if( is_struct(self.options) &&
        is_callable(self.options[$ "on_done"])
    ){
      self.options.on_done(self);
    }
  }

  static next = function(){
    var this = self;

    self.current_callback_idx++;
    if (self.current_callback_idx >= array_length(self.callbacks)){
      return self.__done();
    }
    var next_callback = self.callbacks[self.current_callback_idx];
    // Unset to prevent memory leaks
    self.callbacks[self.current_callback_idx] = undefined;

    // If we're already aborted, we're done!
    if(self.aborted){
      self.callbacks = []; // Unset to remove refs to functions
      return;
    }

    // If this callback doesn't exist, go ahead to the next one.
    if(is_undefined(next_callback)){
      return self.next();
    }

    // Call the callback
    try{
      // Add an entry to the values prior to calling, in case it fails (so we don't get wonky indexes)
      array_push(self.values, undefined);
      self.last_value = next_callback(this);
      self.values[array_length(self.values)] = self.last_value;
    }
    catch(err){
      self.last_value = undefined;
      if(is_struct(self.options) && self.options[$ "bail"]){
        self.abort();
      }
      if(is_struct(self.options) && is_callable(self.options[$ "on_error"])){
        self.options.on_error(err);
      }
      else{
        throw err;
      }
    }

    var was_last = self.current_callback_idx >= array_length(self.callbacks) - 1;
    
    // If we haven't aborted, punt the next callback to the next step
    if(was_last){
      self.__done();
    }
    else if(!self.aborted){
      var _next = method(this, self.next);
      call_later(1, time_source_units_frames, _next);
    }
  }

  static abort = function(){
    self.aborted = true;
    self.callbacks = []; // Unset to remove function refs for GC

  }
}

/// Signature for functions that can be distributed over steps.
///
/// @param {Struct.DistributedCallbacks} results The cumulative results of all prior callbacks
function distributed_callback_signature(results) {}

/// Distrubute a sequence of callbacks across steps. Callbacks
/// are executed one at a time, in order, with a single-step wait
/// in between. Callbacks are passed a `results` object, which
/// includes cumalative info about the process along with an `abort`
/// function to terminate the distribution.
///
/// @param {Array<Function.distributed_callback_signature>} callbacks
/// @param {Struct.DistributeOverStepsOptions} [options]
/// @returns {Struct.DistributedCallbacks}
function distribute_over_steps(callbacks, options){
  var results = new DistributedCallbacks();
  results.callbacks = callbacks;
  results.options = options;
  results.next();
  return results;
}

function DistributeOverStepsOptions () constructor {
  /// An optional function to call when all callbacks have been called.
  /// @type {Function.distributed_callback_signature|Undefined}
  on_done = undefined;

  /// If true, the distribution will abort if any callback throws
  /// an error. Else the distribution will continue to the
  /// next callback on error, assuming the error was handled with on_error
  /// @type {Boolean|Undefined}
  bail = undefined;
  
  /// If provided, this function will be called with the error
  /// thrown by any callback. If not provided, errors will be
  /// thrown. If `bail` is true AND this function is provided,
  /// the distribution will abort on error.
  /// @type {Function|Undefined}
  on_error = undefined;
}