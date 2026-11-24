#!/usr/bin/env node
/**
 * Run the language server. Pass `--stdio`, `--node-ipc` or
 * `--socket=<port>` to choose how it talks to the client.
 */
import { runServer } from './index.ts';

runServer();
