var lib = new StitchPerfLib();

#region Make sure utilities are working
var median_sample = [0, 0, 10, 3, 0, 5, 2];
var expected_median = 2;
lib.assert_equals(lib.array_median(median_sample), expected_median);
array_push(median_sample, 10);
expected_median = (2+3)/2;
lib.assert_equals(lib.array_median(median_sample), expected_median);
#endregion