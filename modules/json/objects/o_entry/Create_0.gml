var json = new Json();

var stringified = json.stringify({
	hello: "world",
	an_array: [
		undefined,
		{
			defined: true,
			un_defined: undefined,
			nullish: pointer_null
		},
		10,
		33.3433435,
		"five million",
		infinity,
		NaN
	],
	nested: {
		another_array: [],
		we_did_it: {yep:"trueee"}
	}
});
var expected = @'{"hello":"world","an_array":[undefined,{"defined":true,"nullish":null},10,33.34,"five million",infinity,NaN],"nested":{"another_array":[],"we_did_it":{"yep":"trueee"}}}'
assert_equals(stringified,expected);

echo(stringified);

game_end();
