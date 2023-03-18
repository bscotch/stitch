
var stuff = {hello:"world"};

echo(stuff);
echo(stuff.hello);
echo(stuff[$"hello"]);
echo(stuff[$"nope"]);
echo(hello.hi, hello.ho);
variable_struct_remove(stuff, "nope");
functionA(4);

var a_struct = {};

if(a_struct){
	echo("STRUCTS ARE TRUTHY");	
}

var me = {};
if(NaN == NaN){
	echo("THIS DOES HAPPEN");
}

game_end();