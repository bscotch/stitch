# Bugs to report

- The `MetaData/IDEVersion` value is NOT prefixed with a space, despite all other cases for that level of nesting being prefixed with a space.
- The `%Name` field is missing from `$GMSpriteFramesTrack` objects
- Question: the `Channels` field inside of sprites has newlines for its object, seemingly breaking the logic of all other formatting. Can you provide us a full, correct description of the formatting logic so we can make sure we're implementing it properly?
- Question: What is the key sorting algorithm? It's an ASCII-based sort with partial case-ignoring. We can't find a algorithm that sorts exactly how GameMaker does. For example:
  - If we lowercase and then compare, everything works except that `bboxMode` sorts *before* `bbox_bottom` rather than *after* it, which is where `bboxmode` (all lower-case) would sort.
  - If we only lower-case the first character, we get a bunch of out-of-order keys.
