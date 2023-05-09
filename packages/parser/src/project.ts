import { fetchReleasesSummaryWithNotes } from '@bscotch/gamemaker-releases';
import { pathy, Pathy } from '@bscotch/pathy';
import { GameMakerLauncher } from '@bscotch/stitch-launcher';
import { Yy, Yyp } from '@bscotch/yy';
import { ok } from 'assert';
import { Gml } from './spec.js';

export class GameMakerProjectParser {
  yyp!: Yyp;
  spec!: Gml;

  protected constructor(readonly yypPath: Pathy) {}

  get ideVersion() {
    return this.yyp.MetaData.IDEVersion;
  }

  protected async loadYyp() {
    this.yyp = await Yy.read(this.yypPath.absolute, 'project');
  }

  /**
   * Load the GML spec for the project's runtime version, falling
   * back on the included spec if necessary.
   */
  protected async loadGmlSpec() {
    // TODO: Look up the runtime version that matches the project's IDE version.
    const releases = await fetchReleasesSummaryWithNotes();
    const usingRelease = releases.find(
      (r) => r.ide.version === this.ideVersion,
    );
    // TODO: Look up the GML Spec file that matches the project's runtime version.
    const runtime = usingRelease?.runtime.version;
    if (runtime) {
      // TODO: Find the locally installed runtime folder
      const installedRuntime = await GameMakerLauncher.findInstalledRuntime({
        version: runtime,
      });
      if (installedRuntime) {
        const gmlSpecPath = pathy(installedRuntime.directory).join(
          'GmlSpec.xml',
        );
        await gmlSpecPath.exists({ assert: true });
        this.spec = await Gml.from(gmlSpecPath.absolute);
      }
    }
    ok(runtime, `No runtime found for IDE version ${this.ideVersion}`);
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
    await project.loadYyp();
    await project.loadGmlSpec();
    // TODO: Populate the global data based on the assets in the project.
    // TODO: Load all of the GML files and parse them, creating a symbol table.
    return project;
  }
}
