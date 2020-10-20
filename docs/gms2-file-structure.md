# GameMaker Studio 2.3+ Project File Structure

## File types

The main organizational content of a GameMaker project is in JSON-like files,
typically with extensions `.yyp` or `.yy`. In GMS2.3 these files have trailing
commas (meaning standard JSON parsers cannot read them) and can have Int64 values
(depending on parsing language, meaning data will be lost during save/load).

Each resource, of any type, typically includes a `.yy` file and may also include
files of various resource-specific types.

## Folders

+ "Groups" (folders) in GMS2.3 do not also create folders in the local
  file structure.
+ Every resource ends up in a flat file structure inside a per-resource-type root folder.
+ There is one file folder per resource type.
+ Organization of resource files within each resource folder seems to be unchanged relative
  to GMS2.2. *Mosty* conists of `type/name/name.yy`, sometimes with additional files of various types.
+ Which folder an asset is in is determined by that asset's `.yy` file via the `"parent"` field.

Examples:

```jsonc
// For assets in the root level (no parent folder)
// (Just refers to the project itself)
"parent": {
  "name": "sample-project",
  "path": "sample-project.yyp",
},
```

```jsonc
// For assets in folders
// (The "name" is the folder name)
// (The "path" is to a non-existent file and the root is always "folders";
//  dropping ^folders and .yy$ yields the visible path in the tree )
// (Exactly matches name/path in an entry in the .yyp file)
"parent": {
  "name": "level3",
  "path": "folders/sample_resources/level2/level3.yy",
},
```

## Tags

In GMS2.3 resources, folders, etc can have tags. These are used for filtering
content in the resource tree. They are always present as a "tags" field with a
simple list of strings.

## Colors

**Colors are not saved.** You can color-code assets, but these are only stored
at the IDE level.

## GUIDs

GMS2 projects use Globally Unique Identifiers (<abbr title="Global Unique Identifier">GUID</abbr>s)
-- also called [<abbr title="Universal Unique Identifier">UUID</a>s](https://en.wikipedia.org/wiki/Universally_unique_identifier)
-- in some places when unique
identifiers are needed but user-provided names are not available.

We don't know what algorithm is used to generate these identifiers, but all our experiments show
that as long as they are dash-separated hex strings with the exact same number of characters as
GUIDs created by GMS2 itself they'll work just fine. We use either random UUIDs (v4) or
generate them based on well-defined parameters (v3), depending on context.

## YYP <a id="yyp"></a>

Each game project has a root `*.yyp` file that describes all of its resources
and some of its high-level metadata. This is the entrypoint for GameMaker projects.

The root contents of the GMS2.3 `yyp` file are these:

+ `resources`: Lists resources of every type except for folders, options, included files, texture groups, and audio groups
  + example entry: `{"id":{"name":"object","path":"objects/object/object.yy",},"order":4,}`
  + (note the complete absence of IDs)
  + (note trailing commas)
  + (note the use of POSIX-style path separators)
+ `Options`: Example `{"name":"Amazon Fire","path":"options/amazonfire/options_amazonfire.yy",}`
+ `configs`: Example:

```json
{
  "name": "Default",
  "children": [
    {"name":"steam","children":[],},
    {"name":"ps5","children":[],},
  ],
}
```

+ `RoomOrder`: `[{"name":"the_room","path":"rooms/the_room/the_room.yy",}]`
+ `Folders`: `{"folderPath":"folders/sample_resources/level2/level3.yy","order":1,"resourceVersion":"1.0","name":"level3","tags":[],"resourceType":"GMFolder",}`
  + (resourceType is always GMFolder)
  + (resourceVersion is always "1.0")
+ `AudioGroups`: Example `{"targets":461609314234257646,"resourceVersion":"1.0","name":"audiogroup_default","resourceType":"GMAudioGroup",}`
  + (always type "GMAudioGroup")
  + (always "resourceVersion":"1.0")
  + The targets list is binary mask of some sort identify platforms
+ `TextureGroups`: Example `{"isScaled":true,"autocrop":true,"border":2,"mipsToGenerate":0,"targets":461609314234257646,"resourceVersion":"1.0","name":"Default","resourceType":"GMTextureGroup",}`
  + (always type "GMTextureGroup")
  + (always "resourceVersion":"1.0")
  + The targets list is binary mask of some sort identify platforms
+ `IncludedFiles`: Example `{"CopyToMask":-1,"filePath":"datafiles/level_1","resourceVersion":"1.0","name":"discoverable_datafile.txt","resourceType":"GMIncludedFile",}`
  + (always type "GMIncludedFile")
  + (always "resourceVersion":"1.0")
  + "CopyToMask":-1 means "deploy to all targets". We use different masks based on config and target platform.

## Resources

Resources are found in `resourceType/resource_name` folders, always with a file
called `resourceType/resource_name/resource_name.yy`. These are JSON files whose contents
vary by asset type, but that have the common fields:

```jsonc
{
  "name": "resource_name",
  "resourceType": "GMShader",
  "tags": [],
  // Location in the visible heirarchy (not on disk)
  "parent": {
    "name": "sample_resources",
    "path": "folders/sample_resources.yy",
  },
  "resourceVersion": "1.0" // constant
}
```

Each asset type may include additional files and folders besides the `.yy` file.
Naming conventions for these other files varies by resource type.

### Sprites

Sprites are the most complex content within the GMS2 project file structure.
As with all other resources all their data is defined in a `.yy` file.

#### New (simple) Sprites

A brand new sprite (`sampleSprite`), without adding a custom image or changing any details,
results in the following files:

+ `sprites/sampleSprite/`
+ `sprites/sampleSprite/sampleSprite.yy`
+ `sprites/sampleSprite/{frameId1}.png` Composite image (actually rendered by the game)
+ `sprites/sampleSprite/layers/`
+ `sprites/sampleSprite/layers/{frameId1}/`
+ `sprites/sampleSprite/layers/{frameId1}/{layerId1}.png`

(`frameId1`, `layerId1`, <i>etc</i> are placeholders for random GMS2-generated GUIDs.)

<details>
  <summary><code>.yy</code> file content of a brand new sprite</summary>

For details on what each of these fields mean and their allowed values, see
[the Typescript typings](../src/types/YySprite.ts).

```jsonc
{
	"For3D": false,
	"HTile": false,
	"VTile": false,
	"bboxMode": 0,
	"bbox_bottom": 0,
	"bbox_left": 0,
	"bbox_right": 0,
	"bbox_top": 0,
	"collisionKind": 1,
	"collisionTolerance": 0,
	"edgeFiltering": false,
	"frames": [
		{
			"compositeImage": {
				"FrameId": {
					"name": "{frameId1}",
					"path": "sprites/sampleSprite/sampleSprite.yy"
				},
				"layerId1": null,
				"name": "",
				"resourceType": "GMSpriteBitmap",
				"resourceVersion": "1.0",
				"tags": []
			},
			"images": [
				{
					"FrameId": {
						"name": "{frameId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"layerId1": {
						"name": "{frameId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				}
			],
			"name": "{frameId1}",
			"parent": {
				"name": "sampleSprite",
				"path": "sprites/sampleSprite/sampleSprite.yy"
			},
			"resourceType": "GMSpriteFrame",
			"resourceVersion": "1.0",
			"tags": []
		}
	],
	"gridX": 0,
	"gridY": 0,
	"height": 64,
	"layers": [
		{
			"blendMode": 0,
			"displayName": "default",
			"isLocked": false,
			"name": "{layerId1}",
			"opacity": 100,
			"resourceType": "GMImageLayer",
			"resourceVersion": "1.0",
			"tags": [],
			"visible": true
		}
	],
	"name": "sampleSprite",
	"origin": 0,
	"parent": {
		"name": "Sprites",
		"path": "folders/Sprites.yy"
	},
	"preMultiplyAlpha": false,
	"resourceType": "GMSprite",
	"resourceVersion": "1.0",
	"sequence": {
		"autoRecord": true,
		"backdropHeight": 768,
		"backdropImageOpacity": 0.5,
		"backdropImagePath": "",
		"backdropWidth": 1366,
		"backdropXOffset": 0,
		"backdropYOffset": 0,
		"eventStubScript": null,
		"eventToFunction": {},
		"events": {
			"Keyframes": [],
			"resourceType": "KeyframeStore<MessageEventKeyframe>",
			"resourceVersion": "1.0"
		},
		"length": 1,
		"lockOrigin": false,
		"moments": {
			"Keyframes": [],
			"resourceType": "KeyframeStore<MomentsEventKeyframe>",
			"resourceVersion": "1.0"
		},
		"name": "sampleSprite",
		"parent": {
			"name": "sampleSprite",
			"path": "sprites/sampleSprite/sampleSprite.yy"
		},
		"playback": 1,
		"playbackSpeed": 30,
		"playbackSpeedType": 0,
		"resourceType": "GMSequence",
		"resourceVersion": "1.3",
		"showBackdrop": true,
		"showBackdropImage": false,
		"spriteId": {
			"name": "sampleSprite",
			"path": "sprites/sampleSprite/sampleSprite.yy"
		},
		"tags": [],
		"timeUnits": 1,
		"tracks": [
			{
				"builtinName": 0,
				"events": [],
				"inheritsTrackColour": true,
				"interpolation": 1,
				"isCreationTrack": false,
				"keyframes": {
					"Keyframes": [
						{
							"Channels": {
								"0": {
									"Id": {
										"name": "{frameId1}",
										"path": "sprites/sampleSprite/sampleSprite.yy"
									},
									"resourceType": "SpriteFrameKeyframe",
									"resourceVersion": "1.0"
								}
							},
							"Disabled": false,
							"IsCreationKey": false,
							"Key": 0,
							"Length": 1,
							"Stretch": false,
							"id": "5fd00e24-be25-487f-9b9e-3edf9bede751",
							"resourceType": "Keyframe<SpriteFrameKeyframe>",
							"resourceVersion": "1.0"
						}
					],
					"resourceType": "KeyframeStore<SpriteFrameKeyframe>",
					"resourceVersion": "1.0"
				},
				"modifiers": [],
				"name": "frames",
				"resourceType": "GMSpriteFramesTrack",
				"resourceVersion": "1.0",
				"spriteId": null,
				"tags": [],
				"trackColour": 0,
				"tracks": [],
				"traits": 0
			}
		],
		"visibleRange": null,
		"volume": 1,
		"xorigin": 0,
		"yorigin": 0
	},
	"swatchColours": null,
	"swfPrecision": 2.525,
	"tags": [],
	"textureGroupId": {
		"name": "Default",
		"path": "texturegroups/Default"
	},
	"type": 0,
	"width": 64
}
```

</details>


### Modified (complex) sprites

Using the "Import" option in a sprite causes all image files
to be replaced and all GUIDs to be recomputed.

Adding a new subimage via the Editor leaves the original GUIDs
intact and simply adds the new one.

Sorting subimages via the Editor has no impact on the file
structure, but does change the `.yy` file: the objects in the
`frames` array are are sorted to reflect the order seen in
the editor, as are those in `sequence.tracks.keyframes.Keyframes`.

Adding a new layer creates a new GUID for that layer, with
correspondingly-named images in each `layers/{frameId}`
folder.

Creating a "Layer Group" only changes content in the `.yy`
file: the new group is added to the `layers` array basically
as another layer, but with the added "layers" field that
is another array containing the nested layers. The layer
group does have a GUID, but it does not appear to be used
anywhere else.


A complex sprite (`sampleSprite`) with multiple subimages,
multiple layers, and a layer group results in the following
file structure:

+ `sprites/sampleSprite/`
+ `sprites/sampleSprite/sampleSprite.yy`
+ `sprites/sampleSprite/{frameId1}.png`
+ `sprites/sampleSprite/{frameId2}.png`
+ `sprites/sampleSprite/{frameId3}.png`
+ `sprites/sampleSprite/layers/`
+ `sprites/sampleSprite/layers/{frameId1}/`
+ `sprites/sampleSprite/layers/{frameId1}/{layerId1}.png`
+ `sprites/sampleSprite/layers/{frameId1}/{layerId2}.png`
+ `sprites/sampleSprite/layers/{frameId2}/`
+ `sprites/sampleSprite/layers/{frameId2}/{layerId1}.png`
+ `sprites/sampleSprite/layers/{frameId2}/{layerId2}.png`
+ `sprites/sampleSprite/layers/{frameId3}/`
+ `sprites/sampleSprite/layers/{frameId3}/{layerId1}.png`
+ `sprites/sampleSprite/layers/{frameId3}/{layerId2}.png`

(`frameId1`, `layerId1`, <i>etc</i> are placeholders for random GMS2-generated GUIDs.)

<details>
  <summary><code>.yy</code> file content of a complex sprite</summary>

For details on what each of these fields mean and their allowed values, see
[the Typescript typings](../src/types/YySprite.ts).

```jsonc
{
	"For3D": false,
	"HTile": false,
	"VTile": false,
	"bboxMode": 0,
	"bbox_bottom": 181,
	"bbox_left": 0,
	"bbox_right": 181,
	"bbox_top": 0,
	"collisionKind": 1,
	"collisionTolerance": 0,
	"edgeFiltering": false,
	"frames": [
		{
			"compositeImage": {
				"FrameId": {
					"name": "{frameId1}",
					"path": "sprites/sampleSprite/sampleSprite.yy"
				},
				"LayerId": null,
				"name": "",
				"resourceType": "GMSpriteBitmap",
				"resourceVersion": "1.0",
				"tags": []
			},
			"images": [
				{
					"FrameId": {
						"name": "{frameId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				},
				{
					"FrameId": {
						"name": "{frameId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId2}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				}
			],
			"name": "{frameId1}",
			"parent": {
				"name": "sampleSprite",
				"path": "sprites/sampleSprite/sampleSprite.yy"
			},
			"resourceType": "GMSpriteFrame",
			"resourceVersion": "1.0",
			"tags": []
		},
		{
			"compositeImage": {
				"FrameId": {
					"name": "{frameId2}",
					"path": "sprites/sampleSprite/sampleSprite.yy"
				},
				"LayerId": null,
				"name": "",
				"resourceType": "GMSpriteBitmap",
				"resourceVersion": "1.0",
				"tags": []
			},
			"images": [
				{
					"FrameId": {
						"name": "{frameId2}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				},
				{
					"FrameId": {
						"name": "{frameId2}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId2}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				}
			],
			"name": "{frameId2}",
			"parent": {
				"name": "sampleSprite",
				"path": "sprites/sampleSprite/sampleSprite.yy"
			},
			"resourceType": "GMSpriteFrame",
			"resourceVersion": "1.0",
			"tags": []
		},
		{
			"compositeImage": {
				"FrameId": {
					"name": "{frameId3}",
					"path": "sprites/sampleSprite/sampleSprite.yy"
				},
				"LayerId": null,
				"name": "",
				"resourceType": "GMSpriteBitmap",
				"resourceVersion": "1.0",
				"tags": []
			},
			"images": [
				{
					"FrameId": {
						"name": "{frameId3}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId1}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				},
				{
					"FrameId": {
						"name": "{frameId3}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"LayerId": {
						"name": "{layerId2}",
						"path": "sprites/sampleSprite/sampleSprite.yy"
					},
					"name": "",
					"resourceType": "GMSpriteBitmap",
					"resourceVersion": "1.0",
					"tags": []
				}
			],
			"name": "{frameId3}",
			"parent": {
				"name": "sampleSprite",
				"path": "sprites/sampleSprite/sampleSprite.yy"
			},
			"resourceType": "GMSpriteFrame",
			"resourceVersion": "1.0",
			"tags": []
		}
	],
	"gridX": 0,
	"gridY": 0,
	"height": 182,
	"layers": [
		{
			"blendMode": 0,
			"displayName": "Layer Group 1",
			"isLocked": false,
			"layers": [
				{
					"blendMode": 0,
					"displayName": "newLayer",
					"isLocked": false,
					"name": "{layerId2}",
					"opacity": 100,
					"resourceType": "GMImageLayer",
					"resourceVersion": "1.0",
					"tags": [],
					"visible": true
				}
			],
			"name": "{layerGroupId1}",
			"opacity": 100,
			"resourceType": "GMImageFolderLayer",
			"resourceVersion": "1.0",
			"tags": [],
			"visible": true
		},
		{
			"blendMode": 0,
			"displayName": "renamedDefaultLayer",
			"isLocked": false,
			"name": "{layerId1}",
			"opacity": 100,
			"resourceType": "GMImageLayer",
			"resourceVersion": "1.0",
			"tags": [],
			"visible": true
		}
	],
	"name": "sampleSprite",
	"origin": 9,
	"parent": {
		"name": "Sprites",
		"path": "folders/Sprites.yy"
	},
	"preMultiplyAlpha": false,
	"resourceType": "GMSprite",
	"resourceVersion": "1.0",
	"sequence": {
		"autoRecord": true,
		"backdropHeight": 768,
		"backdropImageOpacity": 0.5,
		"backdropImagePath": "",
		"backdropWidth": 1366,
		"backdropXOffset": 0,
		"backdropYOffset": 0,
		"eventStubScript": null,
		"eventToFunction": {},
		"events": {
			"Keyframes": [],
			"resourceType": "KeyframeStore<MessageEventKeyframe>",
			"resourceVersion": "1.0"
		},
		"length": 3,
		"lockOrigin": false,
		"moments": {
			"Keyframes": [],
			"resourceType": "KeyframeStore<MomentsEventKeyframe>",
			"resourceVersion": "1.0"
		},
		"name": "sampleSprite",
		"parent": {
			"name": "sampleSprite",
			"path": "sprites/sampleSprite/sampleSprite.yy"
		},
		"playback": 1,
		"playbackSpeed": 30,
		"playbackSpeedType": 0,
		"resourceType": "GMSequence",
		"resourceVersion": "1.3",
		"showBackdrop": true,
		"showBackdropImage": false,
		"spriteId": {
			"name": "sampleSprite",
			"path": "sprites/sampleSprite/sampleSprite.yy"
		},
		"tags": [],
		"timeUnits": 1,
		"tracks": [
			{
				"builtinName": 0,
				"events": [],
				"inheritsTrackColour": true,
				"interpolation": 1,
				"isCreationTrack": false,
				"keyframes": {
					"Keyframes": [
						{
							"Channels": {
								"0": {
									"Id": {
										"name": "{frameId1}",
										"path": "sprites/sampleSprite/sampleSprite.yy"
									},
									"resourceType": "SpriteFrameKeyframe",
									"resourceVersion": "1.0"
								}
							},
							"Disabled": false,
							"IsCreationKey": false,
							"Key": 0,
							"Length": 1,
							"Stretch": false,
							"id": "1ff3bd6a-b2b6-4546-b9f2-e8859645706d",
							"resourceType": "Keyframe<SpriteFrameKeyframe>",
							"resourceVersion": "1.0"
						},
						{
							"Channels": {
								"0": {
									"Id": {
										"name": "{frameId2}",
										"path": "sprites/sampleSprite/sampleSprite.yy"
									},
									"resourceType": "SpriteFrameKeyframe",
									"resourceVersion": "1.0"
								}
							},
							"Disabled": false,
							"IsCreationKey": false,
							"Key": 1,
							"Length": 1,
							"Stretch": false,
							"id": "56c8a118-8f2b-4130-88b0-d1169244be18",
							"resourceType": "Keyframe<SpriteFrameKeyframe>",
							"resourceVersion": "1.0"
						},
						{
							"Channels": {
								"0": {
									"Id": {
										"name": "{frameId3}",
										"path": "sprites/sampleSprite/sampleSprite.yy"
									},
									"resourceType": "SpriteFrameKeyframe",
									"resourceVersion": "1.0"
								}
							},
							"Disabled": false,
							"IsCreationKey": false,
							"Key": 2,
							"Length": 1,
							"Stretch": false,
							"id": "9a7f14d8-bfa8-43dd-a563-f037f9579870",
							"resourceType": "Keyframe<SpriteFrameKeyframe>",
							"resourceVersion": "1.0"
						}
					],
					"resourceType": "KeyframeStore<SpriteFrameKeyframe>",
					"resourceVersion": "1.0"
				},
				"modifiers": [],
				"name": "frames",
				"resourceType": "GMSpriteFramesTrack",
				"resourceVersion": "1.0",
				"spriteId": null,
				"tags": [],
				"trackColour": 0,
				"tracks": [],
				"traits": 0
			}
		],
		"visibleRange": null,
		"volume": 1,
		"xorigin": 132,
		"yorigin": 93
	},
	"swatchColours": null,
	"swfPrecision": 2.525,
	"tags": [],
	"textureGroupId": {
		"name": "Default",
		"path": "texturegroups/Default"
	},
	"type": 0,
	"width": 182
}
```

</details>


### Sprite Sequence

Each sprite `.yy` file includes a `sequence` field, which has the exact
same structure as the `.yy` file of an independent Sequence resource.
This represents the default animation for a sprite, where the frames
are simply looped over.

In our experiments it does not seem that there is a case where these
sequences living inside a sprite resource are changed, with the
following exceptions:

+ `playbackSpeed` and `playbackType` are changed when the "FPS" field
  in the sprite editor is modified.
+ `length` reflects the current number of frames
+ `tracks.keyframes` reflects the current frames and their order (one
  keyframe object per frame).


### Sprites referenced by Sequence resources

Sprites can be used in Sequence Resources, and their frames can
be directly reference by those sequences. The references are by
index only, so the GUID of the linked frames is not used and any
changes to frames (re-ordering, deletion, or addition) are not
reflected by GameMaker in changes to the code/resources that
refer to them.

For example, if a sprite has two frames, a sequence refers
to frame1 of that sprite, and then we delete frame1 via the
GMS2 editor, the sequence still refers to the same index
position as before. GameMaker allows this, at least in the editor,
with out-of-bounds indexes falling back on the last existing
frame.

Collectively, this means that GameMaker does not dynamically
track references to sprite frames in any way, and any change
that causes a specific image to have a different index will
cause all references to that image to be referencing a different
image now.
