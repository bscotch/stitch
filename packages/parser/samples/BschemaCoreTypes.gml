

function _bschema_setup_core_types() {
	#macro bschema_type_any		"any"
	_bschema_create_core_type(bschema_type_any, [], function() { return true; });
	
	#macro bschema_type_null "null"
	_bschema_create_core_type(bschema_type_null, [],
		function(data, schema, error_collector, json_path) {
			return _bschema_condition_met(!exists(data), error_collector, json_path, ["Is not null."]);
		}
	);
	
	#macro bschema_type_const "bConst"
	_bschema_create_core_type(bschema_type_const, [bschema_type_const],
		function(data, schema, error_collector, json_path) {
			var _const_value = schema[$ bschema_type_const];
			var _is_equal = _bschema_condition_met(is_equal(data, _const_value), error_collector, json_path, ["Data must be", _const_value, "but it is", data], ["Is not", _const_value]);			
			return _is_equal;
		}
	);
	
	#macro bschema_type_allof	"allOf"
	_bschema_create_core_type(bschema_type_allof, [bschema_type_allof],
		function(data, schema, error_collector, json_path) {
			var schemas_to_check = schema[$ bschema_type_allof];
			var all_are_valid = true;
			for (var i = 0; i < array_length(schemas_to_check); i++) {
				if !bschema_data_is_valid(data, schemas_to_check[i], error_collector, json_path) {
					all_are_valid = false;
				}
			}
			
			if !all_are_valid {
				_bschema_error_trace(error_collector, json_path, "Not all of the data is valid in this allOf.");
			}
			return all_are_valid;
		}
	);
		
	#macro bschema_type_oneof	"oneOf"
	_bschema_create_core_type(bschema_type_oneof, [bschema_type_oneof],
		function(data, schema, error_collector, json_path) {
			var schemas_to_check	= schema[$ bschema_type_oneof];
			var num_matches			= 0;
			var temp_collector		= [];
				
			for (var i = 0; i < array_length(schemas_to_check); i++) {
				num_matches += bschema_data_is_valid(data, schemas_to_check[i], temp_collector, json_path);
			}
				
			if (num_matches == 1) {
				return true;
			}
			else {
				array_merge(error_collector, temp_collector);
				_bschema_error_trace(error_collector, json_path, ["There must be only one match for the schema. Number of matches:", num_matches]);
				return false;
			}
		}
	);
	
	#macro bschema_type_anyof	"anyOf"
	_bschema_create_core_type(bschema_type_anyof, [bschema_type_anyof],
		function(data, schema, error_collector, json_path) {
			var schemas_to_check	= schema[$ bschema_type_anyof];
			var num_matches			= 0;
			var temp_collector		= [];
				
			for (var i = 0; i < array_length(schemas_to_check); i++) {
				num_matches += bschema_data_is_valid(data, schemas_to_check[i], temp_collector, json_path);
			}
				
			if (num_matches > 0) {
				return true;
			}
			else {
				array_merge(error_collector, temp_collector);
				_bschema_error_trace(error_collector, json_path, ["There must be at least one match for the schema. Number of matches:", num_matches]);
				return false;
			}
		}
	);
	
	#macro bschema_type_not		"not"
	_bschema_create_core_type(bschema_type_not, [bschema_type_not],
		function(data, schema, error_collector, json_path) {
			var schema_that_should_be_invalid = schema[$ bschema_type_not];
				
			if !bschema_data_is_valid(data, schema_that_should_be_invalid, [], json_path) {
				return true;
			}
			else {
				_bschema_error_trace(error_collector, json_path, [data, "should not have matched the schema, but it did. Schema:", schema_that_should_be_invalid], ["Field is invalid."]);
				return false;
			}
		}
	);
		
	#macro bschema_type_enum	"enum"
	_bschema_create_core_type(bschema_type_enum, [bschema_type_enum],
		function(data, schema, error_collector, json_path) {
			var enum_items = schema[$ bschema_type_enum];
			return _bschema_condition_met(deep_contains(enum_items, data), error_collector, json_path, [data, "is not contained in the enum:", string(enum_items)]);
		}
	);
	
	#macro bschema_type_string				"string"
		#macro bschema_string_min_length	"minLength"
		#macro bschema_string_max_length	"maxLength"
		#macro bschema_string_contains		"stringContains"
		#macro bschema_stringformat_snake	"snake-case"
			#macro bschema_stringformat_mote_id "moteId"
		
	_bschema_create_core_type(bschema_type_string, [bschema_string_min_length, bschema_string_max_length],
		function(data, schema, error_collector, json_path) {
			if !_bschema_condition_met(is_string(data), error_collector, json_path, [data, "is not a string."]) {
				return false;
			}
			
			var _string_length	= string_length(data);
			var format_rules	= schema[$ bschema_format_rules];
			var minlength		= undefined_default(schema[$ bschema_string_min_length], 0);
			var maxlength		= undefined_default(schema[$ bschema_string_max_length], infinity);
			var _contains		= schema[$ bschema_string_contains]
			
			if is_defined(_contains) {
				if !_bschema_condition_met(string_count(_contains, data), error_collector, json_path, ["String", data, "does not contain", _contains]) { return false; }
			}
			
			if !_bschema_condition_met((_string_length >= minlength), error_collector, json_path, [data, "is too short. Min characters:", minlength, "... Current characters:", _string_length], ["Must be at least", minlength, "characters."]) { return false; }
			if !_bschema_condition_met((_string_length <= maxlength), error_collector, json_path, [data, "is too long. Max characters:", maxlength, "... Current characters:", _string_length], ["Cannot be more than", maxlength, "characters. Currently", _string_length, "characters long."]) { return false; }
			
			var format = schema[$ bschema_format];
			if !is_undefined(format) {
				switch format {
					case bschema_stringformat_snake:
						if !_bschema_condition_met(string_is_snake_case(data), error_collector, json_path, [data, "is not in snake case."], ["Must be in snake case."]) {
							return false;
						}
						break;
					case bschema_stringformat_mote_id:
						var _mote_id = data;
						if !_bschema_condition_met(bschema_mote_exists(_mote_id), error_collector, json_path, ["Mote", _mote_id, "doesn't exist."]) { return false; }
						
						if exists(format_rules) {
							var block_types = format_rules[$ "blockSchemas"];
							var allow_types = format_rules[$ "allowSchemas"];
							var block_ids = format_rules[$ "blockMotes"];
							var allow_ids = format_rules[$ "allowMotes"];
							var allow_looping = undefined_default(format_rules[$ "allowLooping"], true);
							var _validation_schema = format_rules[$ "validationSchema"];
								
							var _schema_id = bschema_mote_get_schema_id(_mote_id);
							
							var _explicitly_allowed = is_defined(allow_ids) && array_contains(allow_ids, _mote_id);
							var _explicitly_blocked = is_defined(block_ids) && array_contains(block_ids, _mote_id);
							
							if !_explicitly_allowed {
								if !_bschema_condition_met(!_explicitly_blocked, error_collector, json_path,["Mote", data, "is explicitly blocked. It cannot be set here."]) {
									return false;
								}
								if is_defined(block_types) {
									if !_bschema_condition_met(!array_contains(block_types, _schema_id), error_collector, json_path,["Mote", data, "cannot be set here. Its type is blocked."]) {
										return false;
									}
								}
								if is_defined(allow_types) {
									if !_bschema_condition_met(array_contains(allow_types, _schema_id), error_collector, json_path,["Mote", data, "cannot be set here. Its type is not allowed."]) {
										return false;
									}
								}
							}
							
							if is_defined(_validation_schema) {
								if is_struct(_validation_schema) {
									var _mote_ref_data = bschema_mote_get_data(_mote_id);
									//echo("Checking mote", _mote_id, "against validation schema", _validation_schema);
									var _mote_ref_is_valid = bschema_data_is_valid(_mote_ref_data, _validation_schema, error_collector, _mote_id);
									if !_mote_ref_is_valid {
										var _last_error = array_last(error_collector);
										//var _new_message = ["Cannot use mote", bschema_mote_get_name(_mote_id), "here. Reason:", _last_error.short_message];
										var _linked_mote_name = bschema_mote_get_name(_mote_id);
										_bschema_error_trace(error_collector, json_path,
										
											["Cannot link to mote", _mote_id, "here. Reason:", _last_error.message],
											["Cannot link to '" +  _linked_mote_name + "' here. Error from '" + _linked_mote_name + "':", _last_error.short_message]);
										//_bschema_error_trace()
										return false;
									}
									//if !_bschema_condition_met(bschema_data_is_valid(_mote_ref_data, _validation_schema, error_collector, _mote_id), error_collector, json_path, ["Cannot use mote", bschema_mote_get_name(_mote_id), "here."]) {
										//echo("   Mote", _mote_id, "doesn't validate against", _validation_schema);
									//	return false;
									//}
									//else echo("   Mote", _mote_id, "checks out.");
								}
							}
							
							if !allow_looping {
								var _looping_mote = bschema_mote_reference_get_looping_mote_id(json_path);
								if !_bschema_condition_met((_looping_mote == ""),	error_collector, json_path, ["Mote '", bschema_mote_get_name(_looping_mote), "' is causing an infinite loop"]) {
									return false;
								}
							}
						}
						break;
				}
			}
			
			return true;
		}
	);
	
	#macro bschema_type_bool	"boolean"
	_bschema_create_core_type(bschema_type_bool, [],
		function(data, schema, error_collector, json_path) {
			return _bschema_condition_met(is_bool(data) || (is_numeric(data) && (data == 1 || data == 0)), error_collector, json_path, [data, "is not a bool."]);
		}
	);
	
	_bschema_init_integer_type();
	_bschema_init_number_type();
	_bschema_init_array_type();
	_bschema_init_object_type();
}

function _bschema_create_core_type(type_string, unique_fields_array, validator_function, hydration_function=undefined) {
	unique_fields_array = to_array(unique_fields_array);
	BSCHEMA.core_types[$ type_string] = {
		type			: type_string,
		unique_fields	: unique_fields_array,
		validate		: validator_function,
		hydrate			: is_undefined(hydration_function) ? function(data, schema, json_path) { return clone(data); } : hydration_function
	}
	
	for ( var i = 0; i < array_length(unique_fields_array); i++){
		var _field = unique_fields_array[i];
		BSCHEMA.type_lookup[$ _field] = type_string;
	}
}