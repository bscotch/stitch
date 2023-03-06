/**
 * @file Bridge to make it easy to import CJS
 * into .mjs files.
 */

export { BrowserWindow, dialog, ipcMain } from 'electron';
export * as constants from './constants.mjs';
