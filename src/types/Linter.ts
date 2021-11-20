import type { GmlToken } from '../lib/parser/GmlToken';

/**
 * Report from the linter functionality. If a field is **missing**
 * then its underlying functionality **was not checked**.
 * (Checked functionality that yieled no errors will return empty arrays.)
 */
export interface LinterReport {
  /** Only set if `options.versionSuffix` was provided */
  outdatedFunctionReferences?: GmlToken[];
  /** Global functions whose references do not appear elsewhere in the project */
  nonreferencedFunctions?: GmlToken[];
}
