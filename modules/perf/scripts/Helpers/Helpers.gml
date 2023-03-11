function struct_creator (_i){
	return {
		name: "Hello!",
		i: _i
	}
}

function StructConstructor (_i) constructor {
	name = "Hello!";
	i = _i;
}

function identity (_i){
	return _i;
}

function double_identity (_i){
	return identity(_i);
}

function generate_consonumeric_string(_length, _must_start_with_letter=false) {
	var valid_chars = "0123456789bcdfghjklmnpqrstvwxz";
	var num_valid_chars = string_length(valid_chars);
	var the_string = "";
	
	while string_length(the_string) < _length {
		var _next_character = string_char_at(valid_chars, irandom(num_valid_chars));
		
		if _must_start_with_letter {
			if (string_length(the_string) == 0) {
				if char_is_numeric(_next_character) {
					continue;
				}
			}
		}
		
		the_string += _next_character;
	}
	
	return the_string;
}
