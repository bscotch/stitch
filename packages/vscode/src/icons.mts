import type { Asset } from '@bscotch/gml-parser';
import type { YyResourceType } from '@bscotch/yy';
import path from 'path';
import vscode from 'vscode';
import type { FileIcon, GameMakerIcon } from './icons.types.mjs';

export function getAssetIcon(assetKind: YyResourceType, asset?: Asset) {
  let icon: vscode.ThemeIcon | vscode.Uri = getBaseIcon('question');

  switch (assetKind) {
    case 'objects':
      icon = getBaseIcon('symbol-misc');
      break;
    case 'rooms':
      icon = getGameMakerIcon('rooms');
      break;
    case 'scripts':
      icon = getGameMakerIcon('scripts');
      break;
    case 'sprites':
      // icon = getGameMakerIcon('sprite');
      const frame = asset?.framePaths?.[0];
      if (frame) {
        icon = vscode.Uri.file(frame.absolute);
      } else {
        icon = getGameMakerIcon('sprites');
      }
      break;
    case 'sounds':
      icon = getGameMakerIcon('sounds');
      break;
    case 'paths':
      icon = getBaseIcon('debug-disconnect');
      break;
    case 'shaders':
      icon = getGameMakerIcon('shaders');
      break;
    case 'timelines':
      icon = getBaseIcon('clock');
      break;
    case 'fonts':
      icon = getGameMakerIcon('fonts');
      break;
    case 'tilesets':
      icon = getBaseIcon('layers');
      break;
    case 'particles':
      icon = getBaseIcon('flame');
      break;
    case 'animcurves':
      icon = getBaseIcon('graph-line');
      break;
    case 'extensions':
      icon = getBaseIcon('plug');
      break;
  }
  return icon;
}

/** Get a built-in VSCode icon */
export function getBaseIcon(icon: string) {
  return new vscode.ThemeIcon(icon);
}

/** Get a custom Stitch icon from disk (via `images/files/`) */
export function getFileIcon(icon: FileIcon) {
  return vscode.Uri.file(
    path.join(__dirname, '..', 'images', 'files', icon + '.svg'),
  );
}

/** Get a custom Stitch GameMaker icon (via `images/gm/`) */
export function getGameMakerIcon(icon: GameMakerIcon | (string & {})) {
  return vscode.Uri.file(
    path.join(__dirname, '..', 'images', 'gm', icon + '.svg'),
  );
}

export function getObjectEventIcon(eventName: string) {
  let icon: string | undefined;

  // Set the default for 'other'
  if (eventName.startsWith('Other_')) {
    icon = 'other';
  }

  // Override for object events
  if (eventName.match(/^Draw_\d+$/i)) {
    icon = 'draw';
  } else if (eventName.match(/^Alarm_\d+$/i)) {
    icon = 'alarm';
  } else if (eventName.match(/^Step_\d+$/i)) {
    icon = 'step';
  } else if (eventName === 'Create_0') {
    icon = 'create';
  } else if (eventName === 'Destroy_0') {
    icon = 'destroy';
  } else if (eventName === 'CleanUp_0') {
    icon = 'cleanup';
  } else if (eventName.match(/^Other_(7[250]|6[239])$/i)) {
    icon = 'asynchronous';
  }
  if (icon) {
    return vscode.Uri.file(
      path.join(__dirname, '..', 'images', 'gm', 'obj', icon + '.svg'),
    );
  }
  return getGameMakerIcon('scripts');
}
