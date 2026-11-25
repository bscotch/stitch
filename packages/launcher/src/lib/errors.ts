/**
 * About the external tool some OSes need to unpack GameMaker installers
 * (7-Zip, on Windows and macOS), when it's missing or unsuitable.
 */
export interface UnpackerErrorData {
  /** The tool's name, e.g. "7-Zip" */
  tool: string;
  /** Copies of the tool that were found but lack the required support */
  found: { path: string; version?: string }[];
  /** The archive format this OS needs (e.g. "Nsis" on Windows) */
  requiredFormat: string;
  downloadUrl: string;
  /** OS-specific command that installs a suitable copy of the tool */
  installCommand: string;
}

/** Extra information attached to errors, per error code */
export interface LauncherErrorData {
  UNPACKER_MISSING: UnpackerErrorData;
  UNPACKER_INCAPABLE: UnpackerErrorData;
  VC_RUNTIME_MISSING: {
    /** The downloaded official installer, which installs the VC++ runtime when run normally */
    installerPath?: string;
  };
  IDE_NOT_INSTALLABLE: {
    ideVersion: string;
    channel?: string;
    /** Cached IDE versions of the same channel */
    cached: string[];
    /** Installable IDE versions of the same channel, newest first */
    installable: string[];
  };
  IDE_NOT_FOUND: { ideVersion: string };
  RUNTIME_NOT_FOUND: { runtimeVersion: string; runtimesDir?: string };
  DOWNLOAD_FAILED: { url: string };
  INSTALLER_INVALID: { installerPath: string };
  EXTRACT_FAILED: { installerPath: string };
  NOT_SUPPORTED: { os: string };
  FEED_UNAVAILABLE: { url: string };
  PRUNE_REQUIRES_CONFIRMATION: {
    /** Selected versions that can no longer be downloaded */
    notInstallable: string[];
  };
}

export type LauncherErrorCode = keyof LauncherErrorData;

export class LauncherError<
  C extends LauncherErrorCode = LauncherErrorCode,
> extends Error {
  readonly code: C;
  readonly data: LauncherErrorData[C];
  /** A human-readable suggestion for how to fix the problem */
  readonly fix?: string;

  constructor(
    code: C,
    message: string,
    data: LauncherErrorData[C],
    options?: { fix?: string; cause?: unknown },
  ) {
    super(options?.fix ? `${message}\n${options.fix}` : message, {
      cause: options?.cause,
    });
    this.name = 'LauncherError';
    this.code = code;
    this.data = data;
    this.fix = options?.fix;
  }
}

export function isLauncherError<C extends LauncherErrorCode>(
  err: unknown,
  code?: C,
): err is LauncherError<C> {
  return (
    err instanceof LauncherError && (code === undefined || err.code === code)
  );
}

export function notSupported(os: string, what: string): never {
  throw new LauncherError(
    'NOT_SUPPORTED',
    `${what} is not yet supported on ${os}.`,
    { os },
  );
}
