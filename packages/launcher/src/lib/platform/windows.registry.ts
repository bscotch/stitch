import { execFile } from '../exec.ts';

export interface RegistryValue {
  name: string;
  type: string;
  value: string;
}

/** Parse the output of `reg query <key> [/v <name>]` */
export function parseRegQuery(output: string): RegistryValue[] {
  const values: RegistryValue[] = [];
  for (const line of output.replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^ {4}(.*?) {4}(REG_[A-Z_]+) {4}(.*)$/);
    if (match) {
      values.push({ name: match[1], type: match[2], value: match[3] });
    } else {
      // Empty values have no value column
      const empty = line.match(/^ {4}(.*?) {4}(REG_[A-Z_]+)\s*$/);
      if (empty) values.push({ name: empty[1], type: empty[2], value: '' });
    }
  }
  return values;
}

/**
 * Read a single registry value, or `undefined` if the key or value
 * doesn't exist. DWORDs are returned as their `0x…` string.
 */
export async function readRegistryValue(
  key: string,
  name: string,
): Promise<RegistryValue | undefined> {
  try {
    const result = await execFile('reg.exe', ['query', key, '/v', name], {
      timeoutMs: 10_000,
    });
    if (result.code !== 0) return;
    return parseRegQuery(result.stdout).find(
      (v) => v.name.toLowerCase() === name.toLowerCase(),
    );
  } catch {
    return;
  }
}

/** Expand `%VAR%` references, as Windows does for REG_EXPAND_SZ values */
export function expandWindowsEnvVars(
  value: string,
  env: Record<string, string | undefined>,
): string {
  const lowerEnv = new Map(
    Object.entries(env).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return value.replace(
    /%([^%]+)%/g,
    (whole, name: string) => lowerEnv.get(name.toLowerCase()) ?? whole,
  );
}
