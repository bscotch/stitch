import { ok } from 'assert';
import { createApiServer } from './dist/server.js';

const port = +(process.env.API_PORT || process.argv[2]);

ok(
  port,
  'The Stitch API port must be specified via the API_PORT environment variable or the first command line argument.',
);

createApiServer({ port });
