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