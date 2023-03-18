functionA(10);

function functionB(counter=0){
	if(counter <=0){
		return;
	}
	return functionA(counter-1);
}
