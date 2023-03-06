/**
 * @file Diff identical projects that have been opened and re-saved with different GameMaker IDE versions. The diff can be used to determine what changes need to be made to Stitch.
 */

import { Pathy } from '@bscotch/pathy';
import { Yy } from '@bscotch/yy';
import { diff, jsonPatchPathConverter } from 'just-diff';
import { projectFolders, projectVersions, samplePath } from './sampleInfo.mjs';

/**
 * @typedef {ReturnType<typeof diff>} Diff
 */

/**
 * @return {Diff}
 */
function createDiff(obj1, obj2) {
  return diff(obj1, obj2, jsonPatchPathConverter);
}

/**
 * Return any changes to the overall file
 * structure (loss or gain of files).
 *
 * @param {Pathy} firstProject
 * @param {Pathy} secondProject
 */
async function fileExistenceDiff(firstProject, secondProject) {
  const firstFiles = await firstProject.listChildrenRecursively({
    transform: (p) => p.relativeFrom(firstProject),
  });
  const secondFiles = await secondProject.listChildrenRecursively({
    transform: (p) => p.relativeFrom(secondProject),
  });
  const added = secondFiles.filter((f) => !firstFiles.includes(f));
  const removed = firstFiles.filter((f) => !secondFiles.includes(f));
  return { added, removed };
}

/**
 *
 * @param {Pathy<any>} firstYyFile
 * @param {Pathy<any>} secondYyFile
 */
async function yyDiff(firstYyFile, secondYyFile) {
  /** @type {any} */
  const firstContent = await Yy.read(firstYyFile.absolute);
  /** @type {any} */
  const secondContent = await Yy.read(secondYyFile.absolute);
  return createDiff(firstContent, secondContent);
}

/**
 *
 * @param {Pathy} firstProject
 * @param {Pathy} secondProject
 * @returns
 */
async function projectDiff(firstProject, secondProject) {
  const fileDiff = await fileExistenceDiff(firstProject, secondProject);
  /**
   * @type {Record<string, {lhs: Pathy|null, rhs: Pathy|null}>}
   */
  const files = {};
  await Promise.all(
    [firstProject, secondProject].map((p, i) =>
      p.listChildrenRecursively({
        includeExtension: ['yy', 'yyp'],
        onInclude(child) {
          files[child.relativeFrom(p)] ||= { lhs: null, rhs: null };
          files[child.relativeFrom(p)][i === 0 ? 'lhs' : 'rhs'] = child;
        },
      }),
    ),
  );
  const yyFiles = Object.keys(files);
  /** @type {{files:[lhs:string,rhs:string], diff: Diff}[]} */
  const contentDiffs = [];
  await Promise.all(
    yyFiles.map(async (yyFile) => {
      const { lhs, rhs } = files[yyFile];
      if (lhs && rhs) {
        const contentDiff = await yyDiff(lhs, rhs);
        if (contentDiff.length) {
          contentDiffs.push({
            files: [lhs.relative, rhs.relative],
            diff: await yyDiff(lhs, rhs),
          });
        }
      }
    }),
  );
  return {
    files: fileDiff,
    content: contentDiffs,
  };
}

async function projectsDiff() {
  for (let i = 0; i < projectFolders.length - 1; i++) {
    for (let j = i + 1; j < projectFolders.length; j++) {
      const left = projectFolders[i];
      const right = projectFolders[j];
      const changes = await projectDiff(left, right);
      const changesFile = samplePath.join(
        `${projectVersions[i]}-${projectVersions[j]}.diff.json`,
      );
      await changesFile.write(changes);
    }
  }
}

await projectsDiff();
