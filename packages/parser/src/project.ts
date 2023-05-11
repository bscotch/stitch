import { fetchReleasesSummaryWithNotes } from '@bscotch/gamemaker-releases';
import { pathy, Pathy } from '@bscotch/pathy';
import { GameMakerLauncher } from '@bscotch/stitch-launcher';
import { Yy, Yyp } from '@bscotch/yy';
import { ok } from 'assert';
import { z } from 'zod';
import { GameMakerResource } from './project.resource.js';
import { Gml } from './spec.js';
import { GlobalSelf } from './symbols.self.js';

export class GameMakerProjectParser {
  yyp!: Yyp;
  spec!: Gml;
  resources = new Map<string, GameMakerResource>();
  self = new GlobalSelf(this);

  protected constructor(readonly yypPath: Pathy) {}

  get ideVersion() {
    return this.yyp.MetaData.IDEVersion;
  }

  get projectDir() {
    return pathy(this.yypPath).up();
  }

  emitWarning(message: string) {
    console.warn(`[WARNING] ${message}`);
  }

  /**
   * When first creating an instance, we need to get all project file
   * content into memory for fast access. In particular, we need all
   * yyp, yy, and gml files for scripts and objects. For other asset types
   * we just need their names and yyp filepaths.
   */
  protected async loadResources() {
    this.yyp = await Yy.read(this.yypPath.absolute, 'project');
    const resourceWaits: Promise<any>[] = [];
    for (const resourceInfo of this.yyp.resources) {
      resourceWaits.push(
        GameMakerResource.from(this, resourceInfo).then((r) =>
          this.resources.set(r.name, r),
        ),
      );
    }
    await Promise.all(resourceWaits);
  }

  /**
   * Load the GML spec for the project's runtime version, falling
   * back on the included spec if necessary.
   */
  protected async loadGmlSpec() {
    let runtimeVersion: string | undefined;
    // Check for a stitch config file that specifies the runtime version.
    // If it exists, use that version. It's likely that it is correct, and this
    // way we don't have to download the releases summary.
    const stitchConfig = this.projectDir
      .join('stitch.config.json')
      .withValidator(
        z.object({ runtimeVersion: z.string().optional() }).passthrough(),
      );
    if (await stitchConfig.exists()) {
      console.error('Found stitch config');
      const config = await stitchConfig.read();
      runtimeVersion = config.runtimeVersion;
    }
    if (!runtimeVersion) {
      console.error('No stitch config found, looking up runtime version');
      // Look up the runtime version that matches the project's IDE version.
      const releases = await fetchReleasesSummaryWithNotes();
      const usingRelease = releases.find(
        (r) => r.ide.version === this.ideVersion,
      );
      // Look up the GML Spec file that matches the project's runtime version.
      runtimeVersion = usingRelease?.runtime.version;
    }
    if (runtimeVersion) {
      // Find the locally installed runtime folder
      const installedRuntime = await GameMakerLauncher.findInstalledRuntime({
        version: runtimeVersion,
      });
      if (installedRuntime) {
        const gmlSpecPath = pathy(installedRuntime.directory).join(
          'GmlSpec.xml',
        );
        await gmlSpecPath.exists({ assert: true });
        this.spec = await Gml.from(gmlSpecPath.absolute);
      }
    }
    // If we don't have a spec yet, use the fallback
    if (!this.spec) {
      console.error('No spec found, using fallback');
      this.spec = await Gml.from(
        GameMakerProjectParser.fallbackGmlSpecPath.absolute,
      );
    }
  }

  static async from(yypPath: string) {
    let path = pathy(yypPath);
    if (await path.isDirectory()) {
      const children = await path.listChildren();
      path = children.find((p) => p.hasExtension('yyp'))!;
      ok(path, 'No yyp file found in project directory');
    }
    await path.exists({ assert: true });
    const project = new GameMakerProjectParser(path);
    const fileLoader = project.loadResources();
    const specLoaderWait = project.loadGmlSpec();

    await Promise.all([specLoaderWait, fileLoader]);
    console.log('Resources', project.resources.size);

    // Discover all globals
    for (const [name, resource] of project.resources) {
      resource.updateGlobals();
    }
    // Discover all symbols and their references
    for (const [name, resource] of project.resources) {
      resource.updateAllSymbols();
      // for (const file of resource.gmlFilesArray) {
      //   console.log(`  ${name}:`);
      //   for (const ref of file.refs) {
      //     console.log(`    ${ref.name} [${ref.kind}]`);
      //   }
      // }
    }
    // TODO: Resolve unresolved references

    return project;
  }

  static readonly fallbackGmlSpecPath = pathy(import.meta.url).resolveTo(
    '../../assets/GmlSpec.xml',
  );
}
