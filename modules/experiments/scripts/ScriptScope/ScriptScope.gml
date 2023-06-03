globalvar HELLO; HELLO = 199;

global.BYE = 299;

echo(HELLO, BYE, global.HELLO, global.BYE, self.BYE, self.HELLO);

function ScriptFunc(){return "Exists";}

echo(ScriptFunc(),global.ScriptFunc())

echo(ObjectEnum.zero);

var localvar = "local";

{
	// technically I can put a code block anywhere, but what
	// does that do for scoping?
	echo("localvar", localvar);
	var inner = "inner";
}

echo("INNER", inner);

try{
	echo("TRY");
	echo(localvar, inner);
	var try_inner = "try inner";
	throw(inner)
}
catch(error){
	echo("catch");
	echo(localvar,inner,try_inner);
}

echo("OUTSIDE");
echo(localvar, inner, try_inner);

for(var i=0; i<10; i++){
	var j=i;
}

echo("LOOP", i, j);