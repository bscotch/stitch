import { isAssetOfKind } from '@bscotch/gml-parser';
import vscode from 'vscode';
import { stitchEvents } from './events.mjs';
import type { StitchWorkspace } from './extension.workspace.mjs';
import { locationOf } from './lib.mjs';

export class StitchDefinitionsProvider implements vscode.DefinitionProvider {
  constructor(readonly workspace: StitchWorkspace) {}
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    const offset = document.offsetAt(position);
    const file = this.workspace.getGmlFile(document);
    const ref = file?.getReferenceAt(offset);
    const item = ref?.item;

    if (!item) return;

    // // If we don't have a reference, see if we're on a typename in
    // // a JSDoc comment.
    // if (!ref) {
    //   // Make sure we're in a JSDoc comment.
    //   if (!file.getJsdocAt(offset)) return;

    //   const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
    //   if (!wordRange) return;
    //   const typeName = document.getText(wordRange);
    //   console.log('WORD RANGE', typeName);
    //   item = file.project.types.get(typeName)?.signifier;
    //   if (!item) return;
    // }

    const assetName = item?.asset
      ? item.name
      : item?.getTypeByKind('Id.Instance')?.name ||
        item?.getTypeByKind('Asset.GMObject')?.name;

    if (item && item.native) {
      const helpLink = file?.project.helpLinks[item.name];
      helpLink && vscode.env.openExternal(vscode.Uri.parse(helpLink));
    } else if (item && !item.native && item.def?.file) {
      return locationOf(item.def);
    } else if (ref && item?.name === 'event_inherited') {
      // Then this should take us to the parent event.
      let parent = ref.file.asset.parent;
      const eventName = ref.file.name;
      let emergencyBreak = 0;
      while (parent) {
        // Get the file for the same event.
        for (const file of parent.gmlFilesArray) {
          if (file.name === eventName) {
            return locationOf(file.startRange);
          }
        }
        emergencyBreak++;
        if (emergencyBreak > 20) {
          break;
        }
        parent = parent.parent;
      }
    } else if (ref && item && assetName) {
      // Then we can go to the asset's defining file.
      const asset = ref.file.project.getAssetByName(assetName);
      if (isAssetOfKind(asset, 'objects')) {
        const files = asset.gmlFilesArray;
        for (const file of files) {
          if (file.isCreateEvent) {
            return locationOf(file.startRange);
          } else if (file.isStepEvent) {
            return locationOf(file.startRange);
          }
        }
        // Otherwise just whatever step we have,
        // if any.
        if (files.length > 0) {
          return locationOf(files[0].startRange);
        }
      } else if (isAssetOfKind(asset, 'sprites')) {
        // Then open the sprite viewer
        stitchEvents.emit('sprite-editor-open', asset);
      } else if (isAssetOfKind(asset, 'sounds')) {
        // Then just open the sound file
        vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.file(asset.dir.join(asset.yy.soundFile).absolute),
        );
      }
    }
    return;
  }

  register() {
    return vscode.languages.registerDefinitionProvider('gml', this);
  }
}
