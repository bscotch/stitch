import { isAssetOfKind } from '@bscotch/gml-parser';
import { fileURLToPath } from 'node:url';
import vscode from 'vscode';
import { assertLoudly } from './assert.mjs';
import { pathyFromUri } from './lib.mjs';
import { showErrorMessage } from './log.mjs';
import { GameMakerFolder } from './tree.folder.mjs';
import { TreeAsset, TreeSpriteFrame, type Treeable } from './tree.items.mjs';
import type { GameMakerTreeProvider } from './tree.mjs';
import { ensureFolders } from './tree.utility.mjs';

async function handleDroppedFiles(
  tree: GameMakerTreeProvider,
  target: Treeable,
  uris: vscode.Uri[],
) {
  const project = 'project' in target ? target.project : undefined;
  assertLoudly(project, 'Drop target not supported.');
  const soundFiles = uris.filter((u) => u.fsPath.match(/\.(ogg|mp3|wav)$/i));
  if (soundFiles.length) {
    assertLoudly(target instanceof GameMakerFolder, 'Cannot drop sounds here.');
    await tree.upsertSounds(target, soundFiles);
  }
  const imageFiles = uris
    .filter((u) => u.fsPath.match(/\.png$/))
    .map((u) => pathyFromUri(u));
  if (imageFiles.length) {
    await project.reloadConfig();
    if (target instanceof GameMakerFolder) {
      // Then we're creating new sprites with these images
      for (const imageFile of imageFiles) {
        const spriteName = imageFile.name;
        const dest = target.path + '/' + spriteName;
        try {
          const newSprite = await project.createSprite(dest, imageFile);
          tree.afterNewAssetCreated(newSprite, target, target);
        } catch (err) {
          showErrorMessage(`Failed to create sprite ${spriteName}: ${err}`);
        }
      }
    } else if (
      target instanceof TreeAsset &&
      isAssetOfKind(target.asset, 'sprites')
    ) {
      await target.asset.addFrames(imageFiles);
      tree.changed(target);
    } else if (target instanceof TreeSpriteFrame) {
      // TODO: Then we're adding a frame after this one
    }
  }
}

export function handleDrop(
  tree: GameMakerTreeProvider,
  target: Treeable | undefined,
  dataTransfer: vscode.DataTransfer,
) {
  if (!target) return;

  const droppingFiles = dataTransfer
    .get('text/uri-list')
    ?.value?.split?.(/\r?\n/g);
  if (Array.isArray(droppingFiles) && droppingFiles.length) {
    handleDroppedFiles(
      tree,
      target,
      droppingFiles.map((p) => {
        const asPath = fileURLToPath(p);
        return vscode.Uri.file(asPath);
      }),
    );
  }

  if (!(target instanceof GameMakerFolder)) {
    // Then change the target to the parent folder
    target = target.parent;
  }
  if (
    !target ||
    !(target instanceof GameMakerFolder) ||
    target.isProjectFolder
  ) {
    return;
  }

  // Filter down the list to only root items.
  // Basically, we want root - most folders only,
  // and then any assets that are not in any of those folders.
  // We also need to make sure that we aren't moving a folder
  // into its own child!

  const dropping = dataTransfer.get(tree.treeMimeType)?.value as Treeable[];
  const folders = new Set<GameMakerFolder>();
  const assets = new Set<TreeAsset>();
  // First find the root-most folders
  outer: for (const item of dropping) {
    if (!(item instanceof GameMakerFolder)) {
      continue;
    }
    // Check for circularity
    if (target.isChildOf(item) || target === item) {
      continue;
    }

    // If this is the first/only item, just add it
    if (!folders.size) {
      folders.add(item);
      continue;
    }
    // If this folder is a parent of any of the others, remove those others
    for (const folder of folders) {
      if (item.isChildOf(folder)) {
        // Then we can skip this one!
        continue outer;
      }
      if (item.isParentOf(folder)) {
        // Then we need to remove that folder, since the current item
        // is further rootward
        folders.delete(folder);
      }
    }
    folders.add(item);
  }
  // Then add any assets that aren't in any of these folders
  outer: for (const item of dropping) {
    if (item instanceof TreeAsset) {
      for (const folder of folders) {
        if (item.parent.isChildOf(folder)) {
          continue outer;
        }
      }
      assets.add(item);
    }
  }

  // Now we have a NON-OVERLAPPING set of folders and assets to move!

  // "Move" folders by renaming them. Basically just need to change their
  // parent path to the target folder's path.
  const totalRenames = folders.size + assets.size;
  let renameCount = 0;
  if (!totalRenames) return;

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Moving stuff.`,
      cancellable: false,
    },
    async (progress) => {
      if (!(target instanceof GameMakerFolder)) {
        return;
      }
      for (const folder of folders) {
        const newPath = `${target.path}/${folder.name}`;
        ensureFolders(newPath, target.heirarchy[0]);
        await target.project!.renameFolder(folder.path, newPath);
        renameCount++;
        progress.report({
          increment: (renameCount / totalRenames) * 100,
          message: `Moving root-most folders...`,
        });
      }
      // Assets can be moved in parallel since they store their
      // folder in their own file.
      const waits: Promise<any>[] = [];
      for (const asset of assets) {
        waits.push(
          asset.asset.moveToFolder(target.path).then(() => {
            renameCount++;
            progress.report({
              increment: (renameCount / totalRenames) * 100,
              message: `Moving assets...`,
            });
          }),
        );
      }
      await Promise.all(waits);
      // Move all of the assets!
      tree.rebuild();
    },
  );
}

export async function handleDrag(
  tree: GameMakerTreeProvider,
  source: readonly Treeable[],
  dataTransfer: vscode.DataTransfer,
): Promise<void> {
  const item = new vscode.DataTransferItem(source);
  dataTransfer.set(tree.treeMimeType, item);
}
