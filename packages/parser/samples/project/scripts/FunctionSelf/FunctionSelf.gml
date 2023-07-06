/// @self Struct.Bschema
function insideBschemaGlobal(){
  force_use_packed = true; 
}

/// @self Asset.GMObject.o_object
function insideObject(){
  instance_variable = 100;
}

/// @self Id.Instance.o_object
function insideInstance(){
  instance_variable = 200;
}
