show_debug_message("Distributed callback test");

step = 0;

/// @type {Function.distributed_callback_signature}
var to_distribute = function (results){
  show_debug_message("distributed callback."+
    " Callback Idx: " + string(results.current_callback_idx) +
    " Last value: " + string(results.last_value) +
    " Step: " + string(o_test.step) +
    " Done: " + string(results.done) +
    " Aborted: " + string(results.aborted));
  if(results.current_callback_idx != o_test.step){
    throw("Not being distributed across steps!");
  }
  if(o_test.step > 0 && results.last_value != o_test.step-1){
    throw("Values not being properly passed!");
  }
  return o_test.step;
}

distribute_over_steps([
  to_distribute,
  to_distribute,
  to_distribute,
  to_distribute,
  to_distribute,
  to_distribute,
  to_distribute,
  to_distribute
], {
  /// @param {Struct.DistributedCallbacks} results
  on_done: function(results){
    show_debug_message("Distributed callback test done.");
    if(!results.done){
      throw("Distributed callback test not done!");
    }
    game_end();
  },
});
