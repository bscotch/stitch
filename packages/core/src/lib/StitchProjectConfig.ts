import { assert } from '../utility/errors.js';
import paths from '../utility/paths.js';
import { StitchStorage } from './StitchStorage.js';
import { z } from 'zod';
import { Pathy, pathy } from '@bscotch/pathy';
import { ok } from 'assert';

export type StitchProjectConfigFile = z.infer<
  typeof StitchProjectConfig['fileSchema']
>;

export const STITCH_PROJECT_CONFIG_BASENAME = 'stitch.config.json';

type StitchProjectConfigAssignmentField =
  | 'textureGroupAssignments'
  | 'audioGroupAssignments';

/** The Project Config lives alongside the .yyp file */
export class StitchProjectConfig {
  static readonly fileSchema = z
    .object({
      textureGroupAssignments: z.record(z.string()).default({}),
      audioGroupAssignments: z.record(z.string()).default({}),
      runtimeVersion: z.string().optional(),
    })
    .passthrough();

  // TODO: Make all of this ASYNNCCCC!!!!

  protected constructor(readonly storage: StitchStorage) {}

  get filePathAbsolute() {
    return this.storage.toAbsolutePath(STITCH_PROJECT_CONFIG_BASENAME);
  }

  async getRuntimeVersion() {
    return await this.loadField('runtimeVersion');
  }

  async setRuntimeVersion(version: string | undefined) {
    return await this.saveField('runtimeVersion', version);
  }

  async getTextureGroupAssignments() {
    return await this.loadField('textureGroupAssignments');
  }

  async getTextureGroupsWithAssignedFolders() {
    const assignments = await this.getTextureGroupAssignments();
    return Object.values(assignments);
  }

  /**
   * The folders that have an assigned texture group,
   * sorted from *least* to *most* specific (allowing
   * texture groups of contained sprites to be assigned
   * in order).
   */
  async getFoldersWithAssignedTextureGroups() {
    return sortedKeys(await this.getTextureGroupAssignments());
  }

  async getAudioGroupAssignments() {
    return await this.loadField('audioGroupAssignments');
  }

  async getAudioGroupsWithAssignedFolders() {
    const assignments = await this.getAudioGroupAssignments();
    return Object.values(assignments);
  }

  /**
   * The folders that have an assigned texture group,
   * sorted from *least* to *most* specific (allowing
   * texture groups of contained sprites to be assigned
   * in order).
   */
  async getFoldersWithAssignedAudioGroups() {
    return sortedKeys(await this.getAudioGroupAssignments());
  }

  private async addGroupAssignment(
    type: StitchProjectConfigAssignmentField,
    folder: string,
    group: string,
  ) {
    assert(
      !['', '/', '\\'].includes(folder),
      `Cannot assign groups to the root level. Use default groups for that.`,
    );
    const data = await this.load();
    data[type][folder] = group;
    return await this.save(data);
  }

  private async deleteGroupAssignment(
    type: StitchProjectConfigAssignmentField,
    folder: string,
  ) {
    const data = await this.load();
    Reflect.deleteProperty(data[type], folder);
    return this.save(data);
  }

  private async getGroupAssignmentForPath(
    type: StitchProjectConfigAssignmentField,
    path: string,
  ) {
    const data = await this.load();
    const assignments = data[type];
    const assignmentPaths = Object.keys(assignments);
    // Find the closest path
    const closestAssignmentPath = paths.findClosestParent(
      assignmentPaths,
      path,
    );
    if (closestAssignmentPath) {
      return assignments[closestAssignmentPath];
    }
    return;
  }

  async findTextureGroupForPath(path: string) {
    return await this.getGroupAssignmentForPath(
      'textureGroupAssignments',
      path,
    );
  }

  async addTextureGroupAssignment(folder: string, textureGroup: string) {
    return await this.addGroupAssignment(
      'textureGroupAssignments',
      folder,
      textureGroup,
    );
  }

  async deleteTextureGroupAssignment(folder: string) {
    return await this.deleteGroupAssignment('textureGroupAssignments', folder);
  }

  async addAudioGroupAssignment(folder: string, textureGroup: string) {
    return await this.addGroupAssignment(
      'audioGroupAssignments',
      folder,
      textureGroup,
    );
  }

  async findAudioGroupForPath(path: string) {
    return await this.getGroupAssignmentForPath('audioGroupAssignments', path);
  }

  async deleteAudioGroupAssignment(folder: string) {
    return await this.deleteGroupAssignment('audioGroupAssignments', folder);
  }

  async load() {
    return await pathy<StitchProjectConfigFile>(this.filePathAbsolute).read({
      fallback: {},
      schema: StitchProjectConfig.fileSchema,
    });
  }

  private async loadField<T extends keyof StitchProjectConfigFile>(
    field: T,
  ): Promise<StitchProjectConfigFile[T]> {
    const data = await this.load();
    return data[field];
  }

  private async saveField<T extends keyof StitchProjectConfigFile>(
    field: T,
    value: StitchProjectConfigFile[T],
  ) {
    const data = await this.load();
    data[field] = value;
    return await this.save(data);
  }

  private async save(data: StitchProjectConfigFile) {
    return await pathy<StitchProjectConfigFile>(this.filePathAbsolute).write(
      data,
      {
        schema: StitchProjectConfig.fileSchema,
      },
    );
  }

  /**
   * Given a path to a `.yyp` file, stitch config file, or folder containing a yyp file,
   * get a StitchProjectConfig instance.
   */
  static from(path: string | Pathy): StitchProjectConfig;
  static from(storage: StitchStorage): StitchProjectConfig;
  static from(
    pathOrStorage: string | StitchStorage | Pathy,
  ): StitchProjectConfig {
    if (pathOrStorage instanceof StitchStorage) {
      return new StitchProjectConfig(pathOrStorage);
    }
    ok(
      pathOrStorage instanceof Pathy || typeof pathOrStorage === 'string',
      'Arguument must be a path string or a StitchStorage instance',
    );
    let yypPath: Pathy | undefined = new Pathy(pathOrStorage);
    if (!yypPath.hasExtension('.yyp')) {
      const folder = yypPath.isDirectorySync() ? yypPath : yypPath.up();
      yypPath = folder
        .listChildrenSync()
        .find((child) => child.hasExtension('yyp'));
      ok(yypPath, `No .yyp file found in ${folder}`);
    }
    return new StitchProjectConfig(
      new StitchStorage(yypPath.absolute, false, true),
    );
  }
}

function sortedKeys(object: { [key: string]: any }) {
  const keys = Object.keys(object);
  keys.sort(paths.pathSpecificitySort);
  return keys;
}
