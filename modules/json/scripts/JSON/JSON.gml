function Json () constructor {

	/// @returns {String} JSON string that encodes the struct/array nested data
	/// @param {Array|Struct} _ds Data to encode
	/// Modified from SNAP by @jujuadams
	static stringify = function stringify(_ds) {
	  var _buffer = buffer_create(1024, buffer_grow, 1);
	  self.bufferify(_buffer, _ds);
	  buffer_seek(_buffer, buffer_seek_start, 0);
	  var _string = buffer_read(_buffer, buffer_string);
	  buffer_delete(_buffer);
	  return _string; 
	};

	/// @return {Id.Buffer} JSON string that encodes the struct/array nested data, in a buffer
	/// 
	/// @param {Id.Buffer} _buffer Buffer to write data into
	/// @param {Array|Struct} _ds Data to encode
	/// Modified from SNAP by @jujuadams
	static bufferify = function bufferify(_buffer, _value ){
	    return self.__bufferify_value(_buffer, _value );
	};

	static __bufferify_value = function __bufferify_value(_buffer, _value){
			switch typeof(_value) {
				case "number":
				case "int32":
				case "int64":
					buffer_write(_buffer, buffer_text, string(is_infinity(_value) ? "infinity" : _value));
					break;
				case "string":
	        //Sanitise strings
	        _value = string_replace_all(_value, "\\", "\\\\");
	        _value = string_replace_all(_value, "\n", "\\n");
	        _value = string_replace_all(_value, "\r", "\\r");
	        _value = string_replace_all(_value, "\t", "\\t");
	        _value = string_replace_all(_value, "\"", "\\\"");
        
	        buffer_write(_buffer, buffer_u8,   0x22); // Double quote
	        buffer_write(_buffer, buffer_text, _value);
	        buffer_write(_buffer, buffer_u8,   0x22); // Double quote
					break;
				case "array":
				case "vec3":
				case "vec4":
	        var _array = _value;
	        var _count = array_length(_array);
	        if (_count <= 0){
	            buffer_write(_buffer, buffer_u16, 0x5D5B); //Open then close square bracket
	        }
	        else{
	          buffer_write(_buffer, buffer_u8, 0x5B); //Open square bracket
                
	          var _i = 0;
	          repeat(_count)
	          {
	              __bufferify_value(_buffer, _array[_i]);
	              buffer_write(_buffer, buffer_u8, 0x2C); //Comma
	              ++_i;
	          }
                
	          if (_count > 0) buffer_seek(_buffer, buffer_seek_relative, -1);
	          buffer_write(_buffer, buffer_u8, 0x5D); //Close square bracket
	        }
					break;
				case "method":
	        buffer_write(_buffer, buffer_u8,   0x22); // Double quote
	        buffer_write(_buffer, buffer_text, string(_value));
	        buffer_write(_buffer, buffer_u8,   0x22); // Double quote
					break;
				case "struct":
					// TODO: Add check for a toJSON function
	        var _struct = _value;
        
	        var _names = variable_struct_get_names(_struct);
	        var _count = array_length(_names);
	        if (_count <= 0){
	            buffer_write(_buffer, buffer_u16, 0x7D7B); //Open then close curly bracket
	        }
	        else{
	          buffer_write(_buffer, buffer_u8, 0x7B); //Open curly bracket
                
	          var _i = 0;
	          repeat(_count){
	            var _name = string(_names[_i]);
							if(!is_undefined(_struct[$ _name])){
								buffer_write(_buffer, buffer_u8,   0x22); // Double quote
		            buffer_write(_buffer, buffer_text, _name);
		            buffer_write(_buffer, buffer_u16,  0x3A22); // Double quote then colon
                    
		            __bufferify_value(_buffer, _struct[$ _name]);
                    
		            buffer_write(_buffer, buffer_u8, 0x2C); //Comma
							}
							++_i;
	          }
                
	          buffer_seek(_buffer, buffer_seek_relative, -1);
	          buffer_write(_buffer, buffer_u8, 0x7D); //Close curly bracket
	        }
					break;
				case "undefined":
	        buffer_write(_buffer, buffer_text, "undefined");
					break;
				case "null":
	        buffer_write(_buffer, buffer_text, "undefined");
					break;
				case "bool":
	        buffer_write(_buffer, buffer_text, _value? "true" : "false");
					break;
				case "ptr":
	        //Not 100% sure if the quote delimiting is necessary but better safe than sorry
					if(_value == pointer_null){
						buffer_write(_buffer, buffer_text, "null");
					}
					else{
		        buffer_write(_buffer, buffer_u8,   0x22);
		        buffer_write(_buffer, buffer_text, string(_value));
		        buffer_write(_buffer, buffer_u8,   0x22);
					}
					break;
				default:
	        // YoYoGames in their finite wisdom added a new datatype in GMS2022.5 that doesn't stringify nicely
	        //     string(instance.id) = "ref 100001"
	        // This means we end up writing a string with a space in it to JSON. This is leads to invalid output
	        // We can check <typeof(id) == "ref"> but string comparison is slow and gross
	        // 
	        // Instance IDs have the following detectable characteristics:
	        // typeof(value)       = "ref"
	        // is_array(value)     = false  *
	        // is_bool(value)      = false  *
	        // is_infinity(value)  = false
	        // is_int32(value)     = false  *
	        // is_int64(value)     = false  *
	        // is_method(value)    = false  *
	        // is_nan(value)       = false
	        // is_numeric(value)   = true
	        // is_ptr(value)       = false  *
	        // is_real(value)      = false  *
	        // is_string(value)    = false  *
	        // is_struct(value)    = false  *
	        // is_undefined(value) = false  *
	        // is_vec3(value)      = false  *  (covered by is_array())
	        // is_vec4(value)      = false  *  (covered by is_array())
	        // 
	        // Up above we've already tested the datatypes marked with asterisks
	        // We can fish out instance references by checking <is_numeric() == true> and then excluding int32 and int64 datatypes
        
	        if (is_numeric(_value))
	        {
	            buffer_write(_buffer, buffer_text, string(real(_value))); //Save the numeric component of the instance ID
	        }
	        else
	        {
	            buffer_write(_buffer, buffer_text, string(_value));
	        }
	    }
    
	    return _buffer;
	}
};

