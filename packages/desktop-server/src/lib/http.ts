import { ok } from 'assert';
import type { Express, RequestHandler } from 'express';
import type { Server } from 'http';
import { config } from './config.js';

export function startServer(app: Express, port?: number): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`Stitch Desktop Server running listening on port ${port}`);
      resolve(server);
    });
  });
}

interface ProjectFileParams {
  projectId: string;
  path: string;
}

interface ProjectAssetSourceParams {
  projectId: string;
  type: 'audio';
  sourceId: string;
  fileId: string;
}

async function findProject(req: { params: { projectId: string } }) {
  const project = await config.findProjectById(req.params.projectId);
  ok(project, 'Project not found');
  return project;
}

export const serveProjectAssetSource: RequestHandler<ProjectAssetSourceParams> =
  async function (req, res) {
    const project = await findProject(req);
    const config = project.getAudioSourceConfig(req.params.sourceId);
    const files = (await config.findSource(req.params.sourceId))[0].files;
    const file = files.find((f) => f.id === req.params.fileId);
    ok(file, `File ${req.params.fileId} not found`);
    ok(!file.deleted, `File ${req.params.fileId} is deleted`);
    res.sendFile(file.path, { root: config.dir.absolute });
  };

export const serveProjectFile: RequestHandler<ProjectFileParams> =
  async function (req, res) {
    const project = await findProject(req);
    const filepath = project.dir.join(req.params.path);
    res.sendFile(filepath.absolute);
  };

export const corsMiddleware: RequestHandler = function (req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header(
    'Access-Control-Allow-Headers',
    req.get('Access-Control-Request-Headers'),
  );
  res.header(
    'Access-Control-Allow-Method',
    req.get('Access-Control-Request-Method'),
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  return next();
};
