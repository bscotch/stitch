/// @arg condition
/// @arg [error_message]
/// @arg [...]
function assert() {
	var condition = argument[0];
	
    if !condition {
        echo("Assertion failed.");
        echo(debug_get_callstack());
		var error_message = "Error: Assertion failed.";
		
		if argument_count > 1 {
			error_message = "";
			for ( var i = 1; i < argument_count; i++) {
				error_message += string(argument[i]) + " ";
			}
		}
		
        show_error(error_message, true);
        return false;
    }
    return true;
}

function assert_equals(value0, value1) {
    if (value0 != value1) {
        echo("Equality assertion failed.");
		var _callstack = debug_get_callstack();
        echo(_callstack);
		var error_message = array_join( ["Error: Equality assertion failed at " + string(_callstack[1]), "-----", "Value0:", string(value0), "-----", "Value1:", string(value1), "-----"], chr(10));
		
        show_error(error_message, true);
        return false;
    }
    return true;	
}

function array_join(){
	var array	= argument[0];
	var divider = argument_count > 1 ? argument[1] : ",";
	var text = "";
	for ( var i = 0; i < array_length(array); i++){
		text += string(array[i]);
		if (i < array_length(array)-1) {
			text += string(divider);
		}
	}
	return text;
}

function echo() {
	var echo_item;
	var echo_string="";
		
	for(echo_item=0;echo_item<argument_count;echo_item++){
		echo_string+=string(argument[echo_item])+" ";
	}
	var echo_coming_from_struct = is_struct(self);
	var final_string = echo_coming_from_struct ? "Struct" : object_get_name(object_index);
		
	final_string += "|" + string(get_timer()/1000000) + "| " + echo_string;
	
	if debug_mode {
		final_string = string_replace_all(final_string, "%", "*");
	}
		
	show_debug_message(final_string)
	
}