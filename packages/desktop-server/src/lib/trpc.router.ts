import { pathy } from '@bscotch/pathy';
import { audioSourceConfigSchema } from '@bscotch/stitch/asset-sources/browser';
import { gameMakerKnownPathSchema } from '@bscotch/stitch-launcher';
import { toJson } from '@bscotch/utility/browser';
import { observable } from '@trpc/server/observable';
import open from 'open';
import { z } from 'zod';
import { pickFolder } from './dialogs.js';
import { trpcAssert } from './error.js';
import { GameMakerManager } from './GameMakerManager.js';
import {
  IdeInstallEventPayload,
  projectSummariesSchema,
  ProjectSummary,
  stateSchema,
} from './schemas.js';
import { projectProcedure, t } from './trpc.middleware.js';

const dirSchema = z.object({ directory: z.string() });
const idSchema = z.object({ id: z.string().uuid() });

export const router = t.router({
  onProjectsChanged: t.procedure.subscription((req) => {
    return observable<ProjectSummary[]>((emit) => {
      return req.ctx.config.onProjectsChanged((projects) => {
        emit.next(toJson(projects));
      });
    });
  }),
  onGameMakerStatusChanged: t.procedure.subscription(() => {
    return observable<IdeInstallEventPayload>((emit) => {
      return GameMakerManager.onOpenStepChanged((payload) => {
        emit.next(payload);
      });
    });
  }),
  onError: t.procedure.subscription(() => {
    return observable<{
      kind: 'error';
      message?: string;
      code?: number;
      raw: Error;
    }>((emit) => {
      const unsubs: (() => any)[] = [];
      const listener = (err: Error & { code?: number }) => {
        console.error(err);
        emit.next({
          kind: 'error',
          message: err.message,
          code: err.code,
          raw: err,
        });
      };
      for (const e of ['unhandledRejection', 'uncaughtException'] as const) {
        process.on(e, listener);
        unsubs.push(() => process.off(e, listener));
      }
      return () => {
        unsubs.forEach((fn) => fn());
      };
    });
  }),
  listGameMakerReleases: t.procedure.query(async () => {
    const releases = toJson(await GameMakerManager.versions());
    return releases;
  }),
  listGameMakerPaths: t.procedure
    .output(z.array(gameMakerKnownPathSchema))
    .query(async (req) => {
      const paths = await GameMakerManager.listWellKnownPaths({
        programFiles: await req.ctx.config.getSetting('ideInstallRoot'),
      });
      return paths;
    }),
  getState: t.procedure.output(stateSchema).query(async (req) => {
    const currentState = await req.ctx.config.getSetting('state');
    return currentState;
  }),
  patchState: t.procedure
    .input(stateSchema)
    .output(stateSchema)
    .mutation(async (req) => {
      const currentState = await req.ctx.config.getSetting('state');
      const newState = { ...currentState, ...req.input };
      await req.ctx.config.setSetting('state', newState);
      return newState;
    }),
  pickDirectory: t.procedure
    .input(
      z.object({
        title: z.string().optional(),
        buttonLabel: z.string().optional(),
        message: z.string().optional(),
      }),
    )
    .output(z.string().nullable())
    .query(async () => {
      const folder = await pickFolder();
      return folder || null;
    }),
  addProjectsFromDirectory: t.procedure
    .input(dirSchema)
    .output(z.object({ added: projectSummariesSchema }))
    .mutation(async (req) => {
      const projects = await req.ctx.config.addProjects(req.input.directory);
      return { added: toJson(projects) };
    }),
  openIssues: t.procedure
    .input(
      z.object({
        version: z.string()
      })
    )
    .query(async (req) => {
      open(`https://github.com/bscotch/stitch/issues/new?title=Desktop%20issue&labels=desktop&body=Version:%20${req.input.version}`)
    }),
  openPath: t.procedure
    .input(
      z.object({
        path: z.string().optional(),
        name: z.enum(['stitchDesktopConfig']).optional(),
      }),
    )
    .query(async (req) => {
      trpcAssert(
        req.input.path || req.input.name,
        'path or name is required',
        'BAD_REQUEST',
      );
      if (req.input.name === 'stitchDesktopConfig') {
        await open(req.ctx.config.path.absolute);
      } else {
        trpcAssert(
          await pathy(req.input.path).exists(),
          'Path does not exist',
          'NOT_FOUND',
        );
        await open(req.input.path!);
      }
    }),
  listProjects: t.procedure
    .output(projectSummariesSchema)
    .query(async (req) => {
      const projects = await req.ctx.config.listProjects();
      return toJson(projects);
    }),

  //#region project
  openProject: projectProcedure
    .input(z.object({ app: z.enum(['game-maker', 'code', 'explorer']) }))
    .query((req) => {
      // These promises can take a long time to resolve,
      // so we shouldn't just sit there waiting for them.
      void req.ctx.project.open(req.input.app, req.ctx.config);
    }),
  setProjectIdeVersion: projectProcedure
    .input(z.object({ version: z.string() }))
    .mutation(async (req) => {
      await req.ctx.project.setIdeVersion(req.input.version);
      req.ctx.config.emitProjectsChanged();
    }),
  removeProject: projectProcedure.mutation(async (req) => {
    return await req.ctx.config.removeProject(req.ctx.project.id);
  }),
  //#endregion

  //#region ASSET SOURCES
  addAudioSource: projectProcedure
    .input(dirSchema)
    .output(audioSourceConfigSchema)
    .mutation(async (req) => {
      const source = await req.ctx.config.addAudioSource(
        req.ctx.project.id,
        req.input.directory,
      );
      return source;
    }),
  setAudioSourceImportability: projectProcedure
    .input(
      idSchema.extend({
        fileIds: z.array(z.string()),
        importable: z.boolean(),
      }),
    )
    .mutation(async (req) => {
      await req.ctx.project.setAssetSourceImportability(
        req.input.id,
        req.input.fileIds,
        req.input.importable,
      );
    }),
  getAudioSource: projectProcedure.input(idSchema).query(async (req) => {
    const assets = await req.ctx.project.getAudioSourceAssets(req.input.id);
    return assets;
  }),
  importAudioFromSource: projectProcedure
    .input(idSchema)
    .mutation(async (req) => {
      await req.ctx.project.importSounds(req.input.id);
    }),
  removeAudioSource: projectProcedure.input(idSchema).mutation(async (req) => {
    await req.ctx.config.removeAudioSource(req.ctx.project.id, req.input.id);
  }),
  //#endregion
});

// only export *type signature* of router!
// to avoid accidentally importing your API
// into client-side code
export type Api = typeof router;
