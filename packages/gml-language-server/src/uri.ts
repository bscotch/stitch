import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * A `file:` URI for a path, in the form VS Code uses (a lower-case drive
 * letter with an encoded colon on Windows), so that URIs sent to the client
 * match the ones it sends.
 */
export function pathToUri(file: string): string {
  const href = pathToFileURL(file).href;
  return href.replace(
    /^file:\/\/\/([A-Za-z]):/,
    (_, drive: string) => `file:///${drive.toLowerCase()}%3A`,
  );
}

/** The path for a `file:` URI, or undefined for other schemes */
export function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith('file:')) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}
