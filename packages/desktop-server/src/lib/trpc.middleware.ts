import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';
import { trpcAssert } from './error.js';
import { StitchDesktopConfig } from './StitchDesktopConfig.js';

// created for each request
export type Context = {
  config: StitchDesktopConfig;
};

type TrpcContext = ReturnType<typeof initTRPC.context<Context>>;

const tContext: TrpcContext = initTRPC.context<Context>();

type Trpc = ReturnType<
  typeof tContext.create<{
    transformer: typeof superjson;
  }>
>;

export const t: Trpc = tContext.create({
  transformer: superjson,
});

function inputHasProjectId(input: unknown): input is { projectId: string } {
  return typeof input === 'object' && input !== null && 'projectId' in input;
}
const findProjectById = t.middleware(async (req) => {
  if (inputHasProjectId(req.rawInput)) {
    const project = await req.ctx.config.findProjectById(
      req.rawInput.projectId,
    );
    trpcAssert(project, 'Project not found', 'NOT_FOUND');
    return req.next({
      ctx: {
        ...req.ctx,
        project,
      },
    });
  }
  return req.next();
});
export const projectProcedure = t.procedure
  .use(findProjectById)
  .input(z.object({ projectId: z.string() }));
