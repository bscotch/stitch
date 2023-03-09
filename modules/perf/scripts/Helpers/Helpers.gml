function create_struct (_i){
	return {
		name: "Hello!",
		i: _i
	}
}

function CreateStruct_ (_i){
	name = "Hello!";
	i = _i;
}

function identity (_i){
	return _i;
}

function double_identity (_i){
	return identity(_i);
}