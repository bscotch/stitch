instance_variable = 10;

global_function(SurpriseEnum.another_surprise);
global.global_function(SurpriseEnum.surprise);

function instance_function (){
	globalvar GLOBAL_FROM_INSTANCE;
}

anonymous_instance_function = function different_name(firstArg, secondArg){
	var a_local_variable = another_global_function();
	
	GLOBAL_FROM_INSTANCE = a_local_variable;
	
	for(a_local_variable=1; a_local_variable < 10; a_local_variable++){
		instance_variable = a_local_variable;
	}
}

self.another_instance_variable = "An instance var";

