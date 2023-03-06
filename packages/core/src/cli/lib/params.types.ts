export interface StitchCliGlobalParams {
  help?: boolean;
  debug?: boolean;
}

export interface StitchCliTargetParams {
  targetProject?: string;
  force?: boolean;
  readOnly?: boolean;
}

export type StitchCliGlobalParamName = keyof StitchCliGlobalParams;

export type StitchCliParams<T extends Record<string, any>> = T &
  StitchCliGlobalParams;
