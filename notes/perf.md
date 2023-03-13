# GameMaker Performance

## Structs and Maps

*As of Runtime 2023.200.0.312*

- Accessing a named Struct field gets highly optimized after the first access, but only when using the `.` accessor (e.g. `my_struct.some_field`). In my performance tests it's roughly 10X faster than using other accessors. This suggests that optimal GML should:
  - Use Structs instead of DsMaps
  - Instead of using sparse Structs, initialized them with all fields to allow use of `.` accessors and caching.
  - Use `.` accessors instead of `[$ "field"]` or `variable_struct_...` functions.
- The cost of adding each unique struct field names increases quickly each time (globally, across all structs!), but the cost of getting fields increases slowly with the number of fields.
  - For write-heavy cases with many unique keys, ds_maps may be more performant
  - Unique keys should either be used rarely over time, or in batches during load operations, to reduce impact of the initial use of unique keys
  - Since the impact is *global*, you should avoid having *any* struct that has many arbitrary keys
  - Re-using field names across structs can yield significant performance gains for initial insertion of keys with those names.
- For small structures, structs and DsMaps have very similar accessor speeds, excluding the caching mentioned above, with a slight advantage for Structs.
- For large, dynamic structures (thousands of keys), structs are ~2x more performant than maps, even without the use of cached `.` accessors.
- The `with` keyword is much more performant than alternative ways of accessing struct or object variables