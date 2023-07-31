import vscode from 'vscode';
import { swallowThrown } from './assert.mjs';
import type { StitchProvider } from './extension.provider.mjs';
import { locationOf } from './lib.mjs';

export class StitchDefinitionsProvider implements vscode.DefinitionProvider {
  constructor(readonly provider: StitchProvider) {}
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Location | undefined {
    return swallowThrown(() => {
      const ref = this.provider.getReference(document, position);
      const item = ref?.item;
      const assetName = item?.asset
        ? item.name
        : item?.getTypeByKind('Id.Instance')?.name ||
          item?.getTypeByKind('Asset.GMObject')?.name;

      if (item && !item.native && item.def?.file) {
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
          if (emergencyBreak > 10) {
            break;
          }
          parent = parent.parent;
        }
      } else if (ref && item && assetName) {
        // Then we can go to the asset's defining file.
        const asset = ref.file.project.getAssetByName(assetName);
        if (asset?.assetKind === 'objects') {
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
        }
      }
      return;
    });
  }

  register() {
    return vscode.languages.registerDefinitionProvider('gml', this);
  }
}
