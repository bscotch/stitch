import { StitchError } from '../utility/errors.js';
import { gms2Platforms } from './StitchProject.constants.js';
import type { Gms2Platform, StitchProject } from './StitchProject.js';

import paths from '../utility/paths.js';

type Gms2PlatformVersionKey =
  | `option_${Gms2Platform}_version`
  | 'option_xbone_version';

const switchSearchRegex = new RegExp(
  `(?<pre><DisplayVersion>)(?<versionString>.*)(?<post></DisplayVersion>)`,
);

function versionKeyForPlatform(platform: Gms2Platform): Gms2PlatformVersionKey {
  let versionKey: Gms2PlatformVersionKey = `option_${platform}_version`;
  if (platform == 'xboxone') {
    versionKey = 'option_xbone_version';
  }
  return versionKey;
}

function setSwitchVersion(
  project: StitchProject,
  normalizedVersionString: string,
  fileName: string,
) {
  const oldContent = project.storage.readBlobSync(fileName).toString();
  const newContent = oldContent.replace(
    switchSearchRegex,
    `$1${normalizedVersionString}$3`,
  );
  project.storage.writeBlobSync(fileName, newContent);
}

function getSwitchVersion(project: StitchProject, fileName: string) {
  const content = project.storage.readBlobSync(fileName).toString();
  const newContent = content.match(switchSearchRegex)?.groups;
  if (newContent) {
    return newContent['versionString'];
  } else {
    throw new StitchError(
      `Cannot parse the Switch *.nmeta file to obtain the version`,
    );
  }
}

/**
 * Set the project version in all options files.
 * (Note that the Switch options files do not include the version
 *  -- that must be set outside of GameMaker in the *.nmeta file).
 * Can use one of:
 *    + "0.0.0.0" syntax (exactly as GameMaker stores versions)
 *    + "0.0.0" syntax (semver without prereleases -- the 4th value will always be 0)
 *    + "0.0.0-rc.0" syntax (the 4th number will be the RC number)
 * The four numbers will appear in all cases as the string "major.minor.patch.candidate"
 */
export function setProjectVersion(
  project: StitchProject,
  versionString: string,
) {
  const parts = versionString.match(
    /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)((\.(?<revision>\d+))|(-rc.(?<candidate>\d+)))?$/,
  );
  if (!parts) {
    throw new StitchError(
      `Version string ${versionString} is not a valid format.`,
    );
  }
  const { major, minor, patch, revision, candidate } = parts.groups as {
    [part: string]: string;
  };
  const normalizedVersionString = [
    major,
    minor,
    patch,
    candidate || revision || '0',
  ].join('.');
  const optionsDir = paths.join(project.storage.yypDirAbsolute, 'options');
  const optionsFiles = project.storage.listFilesSync(optionsDir, true, [
    'yy',
    'nmeta',
  ]);
  for (const file of optionsFiles) {
    // Load it, change the version, and save
    if (paths.extname(file) == '.yy') {
      const content = project.storage.readJsonSync(file) as Record<
        Gms2PlatformVersionKey,
        string
      >;
      const platform = paths.basename(paths.dirname(file)) as Gms2Platform;
      if (gms2Platforms.includes(platform)) {
        const versionKey = versionKeyForPlatform(platform);
        content[versionKey] = normalizedVersionString;
        project.storage.writeYySync(file, content);
      }
    }
    // Switch *.nmeta file needs special treatment
    else if (paths.extname(file) == '.nmeta') {
      setSwitchVersion(project, normalizedVersionString, file);
    } else {
      throw new StitchError(
        `Found unsupported file format in the options dir: ${file}`,
      );
    }
  }
}

export function versionOnPlatform(
  project: StitchProject,
  platform: Gms2Platform,
) {
  const optionsDir = paths.join(project.storage.yypDirAbsolute, 'options');
  if (platform != 'switch') {
    const optionsFile = paths.join(
      optionsDir,
      platform,
      `options_${platform}.yy`,
    );
    const versionKey = versionKeyForPlatform(platform);
    return (
      project.storage.readJsonSync(optionsFile) as Record<
        Gms2PlatformVersionKey,
        string
      >
    )[versionKey] as string;
  } else {
    const optionsFile = project.storage.listFilesSync(optionsDir, true, [
      'nmeta',
    ])?.[0];
    if (optionsFile) {
      return getSwitchVersion(project, optionsFile);
    } else {
      throw new StitchError(
        `The project does not contain a valid *.nmeta file with version info.`,
      );
    }
  }
}
