// Script assets have changed for v2.3.0 see
// https://help.yoyogames.com/hc/en-us/articles/360005277377 for more information
function Script1(something){
	var whatever = "something";
	return something + whatever;
}

function Script2(){
	// Call Script1 so that we can test our ability to discover it as a function
	return Script1("whatever");
}

// function doesNotExist(){}

/* function alsoDoesNotExist(hello){
	return "WEEEE";
}*/