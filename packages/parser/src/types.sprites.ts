import { Signifier } from './signifiers.js';
import { typeFromFeatherString } from './types.feather.js';
import { StructType, Type } from './types.js';
import { assert } from './util.js';

interface VariableInfo {
  variable: string;
  type: string;
  description: string;
}

/** See {@link https://manual.yoyogames.com/GameMaker_Language/GML_Reference/Asset_Management/Sprites/Sprite_Information/sprite_get_info.htm# the Docs} */
const spriteInfoVariables = [
  //#region COMMON VARIABLES
  {
    variable: 'width',
    type: 'Real',
    description: "The sprite's width (in pixels)",
  },
  {
    variable: 'height',
    type: 'Real',
    description: "The sprite's height (in pixels)",
  },
  {
    variable: 'xoffset',
    type: 'Real',
    description: "The sprite's X offset/origin (in pixels)",
  },
  {
    variable: 'yoffset',
    type: 'Real',
    description: "The sprite's Y offset/origin (in pixels)",
  },
  {
    variable: 'transparent',
    type: 'Bool',
    description:
      'true if the sprite is marked as transparent, otherwise false\r\n\r\n (This can only be specified through sprite_add()\xa0or similar functions, and will be false for sprites created in the IDE)',
  },
  {
    variable: 'smooth',
    type: 'Bool',
    description:
      'true if the sprite is marked as smooth, otherwise false\r\n\r\n (This can only be specified through sprite_add()\xa0or similar functions, and will be false for sprites created in the IDE)',
  },
  {
    variable: 'type',
    type: 'Real',
    description:
      'The type of the sprite:\r\n\r\n 0 - Bitmap (Regular sprites)\r\n\r\n 1 - SWF\r\n\r\n 2 - Spine',
  },
  {
    variable: 'bbox_left',
    type: 'Real',
    description: 'Position of the left edge of the bounding box (in pixels)',
  },
  {
    variable: 'bbox_top',
    type: 'Real',
    description: 'Position of the top edge of the bounding box (in pixels)',
  },
  {
    variable: 'bbox_right',
    type: 'Real',
    description: 'Position of the right edge of the bounding box (in pixels)',
  },
  {
    variable: 'bbox_bottom',
    type: 'Real',
    description: 'Position of the bottom edge of the bounding box (in pixels)',
  },
  {
    variable: 'name',
    type: 'String',
    description: 'The name of the sprite',
  },
  {
    variable: 'num_subimages',
    type: 'Real',
    description: 'The number of sub-images (or frames) in the sprite',
  },
  {
    variable: 'use_mask',
    type: 'Bool',
    description:
      'true if this sprite uses a collision mask (either generated from a shape or the image itself), otherwise false (meaning it uses a bounding box)',
  },
  {
    variable: 'num_masks',
    type: 'Real',
    description:
      'The number of masks in this sprite (will be greater than 1 if the sprite uses per-frame masks)',
  },
  {
    variable: 'nineslice',
    type: 'Struct',
    description:
      'The Nine Slice struct for this sprite, or undefined if it has no nine slice data',
  },
  {
    variable: 'messages',
    type: 'Array',
    description:
      'Array of broadcast messages for this sprite, where each broadcast message is a struct containing information on the message (more information under "General Sprite Data")',
  },
  {
    variable: 'frame_info',
    type: 'Array',
    description:
      'Array of frames for this sprite, where each frame is a struct containing information on its timing\xa0(more information under "General Sprite Data")',
  },
  {
    variable: 'frame_speed',
    type: 'Real',
    description:
      'The frame speed set for the sprite (see:\xa0The Sprite Editor)',
  },
  {
    variable: 'frame_type',
    type: 'Real',
    description:
      'The type of speed set for the sprite, either spritespeed_framespersecond or spritespeed_framespergameframe',
  },
  //#endregion COMMON VARIABLES

  //#region SPINE VARIABLES
  {
    variable: 'num_atlas',
    type: 'Real',
    description: 'The number of atlas textures used',
  },
  {
    variable: 'atlas_texture',
    type: 'Array<Id.Texture>',
    description: 'Array of texture IDs used for the atlas',
  },
  {
    variable: 'premultiplied',
    type: 'Bool',
    description:
      'true if this sprite is marked as premultiplied, otherwise false',
  },
  {
    variable: 'animation_names',
    type: 'Array<String>',
    description: 'Array containing the names of each animation in this sprite',
  },
  {
    variable: 'skin_names',
    type: 'Array<String>',
    description: 'Array containing the names of each skin in this sprite',
  },
  {
    variable: 'bones',
    type: 'Array',
    description: 'Array containing structs for each bone in this sprite',
  },
  {
    variable: 'slots',
    type: 'Array',
    description:
      'Array containing structs for each slot in this sprite\xa0(more information under "Spine Sprite Data")',
  },
  //#endregion SPINE VARIABLES

  //#region MANUALLY ADDED
  {
    variable: 'frames',
    type: 'Array',
    description:
      'Array of frames for this sprite, where each frame is a struct containing information on its texture',
  },
  //#endregion MANUALLY ADDED
] satisfies VariableInfo[];

const frameVariables = [
  {
    variable: 'x',
    type: 'Real',
    description: 'The X position of this frame on its texture page (in pixels)',
  },
  {
    variable: 'y',
    type: 'Real',
    description: 'The Y position of this frame on its texture page (in pixels)',
  },
  {
    variable: 'w',
    type: 'Real',
    description: 'The logical width of the frame (in pixels) used internally',
  },
  {
    variable: 'h',
    type: 'Real',
    description: 'The logical height of the frame (in pixels) used internally',
  },
  {
    variable: 'texture',
    type: 'Real',
    description: 'The texture page ID for this frame',
  },
  {
    variable: 'original_width',
    type: 'Real',
    description: 'The original width of the frame (in pixels)',
  },
  {
    variable: 'original_height',
    type: 'Real',
    description: 'The original height of the frame (in pixels)',
  },
  {
    variable: 'crop_width',
    type: 'Real',
    description:
      "The actual width of the frame on the texture page after cropping and scaling (since GameMaker automatically trims the empty space around an image, and also scales it down if it doesn't fit)",
  },
  {
    variable: 'crop_height',
    type: 'Real',
    description:
      'The actual height of the frame on the texture page after cropping and scaling',
  },
  {
    variable: 'x_offset',
    type: 'Real',
    description:
      'The X offset from the left edge of the original image to the left edge of the cropped section',
  },
  {
    variable: 'y_offset',
    type: 'Real',
    description:
      'The Y offset from the top edge of the original image to the top edge of the cropped section',
  },
] satisfies VariableInfo[];

const boneVariables = [
  {
    variable: 'parent',
    type: 'String',
    description:
      "The name of the parent bone, or\xa0undefined if this bone doesn't have a parent",
  },
  {
    variable: 'name',
    type: 'String',
    description: 'The name of this bone',
  },
  {
    variable: 'index',
    type: 'Real',
    description: 'The index of this bone',
  },
  {
    variable: 'length',
    type: 'Real',
    description: 'The length of this bone',
  },
  {
    variable: 'x',
    type: 'Real',
    description: 'The X position of this bone',
  },
  {
    variable: 'y',
    type: 'Real',
    description: 'The Y position of this bone',
  },
  {
    variable: 'rotation',
    type: 'Real',
    description: 'The rotation of this bone',
  },
  {
    variable: 'scale_x',
    type: 'Real',
    description: '(Internal to Spine) Scale value on X',
  },
  {
    variable: 'scale_y',
    type: 'Real',
    description: '(Internal to Spine) Scale value on Y',
  },
  {
    variable: 'shear_x',
    type: 'Real',
    description: '(Internal to Spine) Shear value on X',
  },
  {
    variable: 'shear_y',
    type: 'Real',
    description: '(Internal to Spine) Shear value on Y',
  },
  {
    variable: 'transform_mode',
    type: 'Real',
    description: '(Internal to Spine) The transform mode',
  },
] satisfies VariableInfo[];

const slotVariables = [
  {
    variable: 'name',
    type: 'String',
    description: 'The name of the slot',
  },
  {
    variable: 'index',
    type: 'Real',
    description: 'The index of the slot',
  },
  {
    variable: 'bone',
    type: 'String',
    description:
      'The name of the slot\'s bone, or "(none)" if there is no bone for this slot',
  },
  {
    variable: 'attachment',
    type: 'String',
    description: 'Attachment name',
  },
  {
    variable: 'red',
    type: 'Real',
    description: "Red component of the slot's colour (0-1)",
  },
  {
    variable: 'green',
    type: 'Real',
    description: "Green component of the slot's colour (0-1)",
  },
  {
    variable: 'blue',
    type: 'Real',
    description: "Blue component of the slot's colour (0-1)",
  },
  {
    variable: 'alpha',
    type: 'Real',
    description: "Alpha component of the slot's colour (0-1)",
  },
  {
    variable: 'blend_mode',
    type: 'Real',
    description: '(Internal to Spine) Blend mode for the slot',
  },
  {
    variable: 'dark_red',
    type: 'Real',
    description: "Red component of the slot's dark colour (0-1)",
  },
  {
    variable: 'dark_green',
    type: 'Real',
    description: "Green component of the slot's dark colour (0-1)",
  },
  {
    variable: 'dark_blue',
    type: 'Real',
    description: "Blue component of the slot's dark colour (0-1)",
  },
  {
    variable: 'dark_alpha',
    type: 'String',
    description: "Alpha component of the slot's dark colour (0-1)",
  },
  {
    variable: 'attachments',
    type: 'Array\xa0of\xa0String',
    description:
      'An array containing the names\xa0of all available attachments for this slot.',
  },
] satisfies VariableInfo[];

const messagesVariables = [
  {
    variable: 'frame',
    type: 'Real',
    description:
      'The timing of this broadcast message from the start of the animation (in frames)',
  },
  {
    variable: 'message',
    type: 'String',
    description: 'The broadcast message string',
  },
] satisfies VariableInfo[];

const frameInfoVariables = [
  {
    variable: 'frame',
    type: 'Real',
    description: 'The timing for the start of this frame (in frames)',
  },
  {
    variable: 'duration',
    type: 'Real',
    description: 'The duration of this frame (in frames)',
  },
  {
    variable: 'image_index',
    type: 'Real',
    description: 'The image index of this frame',
  },
] satisfies VariableInfo[];

function variablesToStruct(
  variables: VariableInfo[],
  globalTypes: Map<string, Type>,
): StructType {
  const struct = new Type('Struct');
  for (const v of variables) {
    const type = typeFromFeatherString(v.type, globalTypes);
    const newVar = new Signifier(struct, v.variable, type);
    newVar.native = true;
    newVar.def = {};
    newVar.describe(v.description);
    struct.addMember(newVar);
  }
  return struct;
}

function addArrayItemTypeToField(
  struct: StructType,
  fieldName: string,
  itemType: Type,
) {
  const field = struct.getMember(fieldName);
  assert(field, `Field ${fieldName} not found in struct ${struct.name}`);
  const arrayType = field.getTypeByKind('Array');
  assert(
    arrayType,
    `Field ${fieldName} in struct ${struct.name} is not an array`,
  );
  arrayType.addItemType(itemType);
}

/**
 * The `sprite_get_info()` native function returns a struct that is
 * not defined in the spec but has documentation. This function creates
 * that struct.
 */
export function addSpriteInfoStruct(globalTypes: Map<string, Type>) {
  const spriteInfo = variablesToStruct(spriteInfoVariables, globalTypes);
  spriteInfo.named('SpriteInfo');

  // Populate the frame struct
  const frameStruct = variablesToStruct(frameVariables, globalTypes);
  addArrayItemTypeToField(spriteInfo, 'frames', frameStruct);

  // Populate the bones struct
  const boneStruct = variablesToStruct(boneVariables, globalTypes);
  addArrayItemTypeToField(spriteInfo, 'bones', boneStruct);

  // Populate the slots struct
  const slotStruct = variablesToStruct(slotVariables, globalTypes);
  addArrayItemTypeToField(spriteInfo, 'slots', slotStruct);

  // Populate the messages struct
  const messageStruct = variablesToStruct(messagesVariables, globalTypes);
  addArrayItemTypeToField(spriteInfo, 'messages', messageStruct);

  // Populate the frame_info struct
  const frameInfoStruct = variablesToStruct(frameInfoVariables, globalTypes);
  addArrayItemTypeToField(spriteInfo, 'frame_info', frameInfoStruct);

  globalTypes.set('Struct.SpriteInfo', spriteInfo);
}
