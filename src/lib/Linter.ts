import chalk from 'chalk';
import { LinterReport } from 'types/Linter';
import type { Gms2Project } from './Gms2Project';
import { GmlToken } from './parser/GmlToken';
import paths from './paths';

export type LinterReportFormat = 'object' | 'console';

/** @note Could compute type off of a *default* options object. */
export interface LinterOptions {
  /**
   * If provided, will find fuzzy-matching function references that
   * match because they *both* match this suffix pattern. Any mismatch
   * will be reported as an "outdated function referenced".
   */
  versionSuffix?: string;
}

export class Linter {
  private _report: LinterReport;

  constructor(private project: Gms2Project, options?: LinterOptions) {
    this._report = this.lint(options);
  }

  /** Shallow clone of the raw report. */
  getReport() {
    return { ...this._report };
  }

  /** Console-friendly report */
  getReportString() {
    const _clickablePath = (token: GmlToken) => {
      return paths.relative(process.cwd(), token.location.filepathAbsolute);
    };

    const report = [];
    if (this._report.nonreferencedFunctions) {
      report.push('', chalk.yellow('Nonreferenced Functions'));
      for (const func of this._report.nonreferencedFunctions) {
        report.push(_clickablePath(func));
      }
    }
    if (this._report.outdatedFunctionReferences) {
      report.push('', chalk.red('Outdated Function Version References'));
      for (const func of this._report.outdatedFunctionReferences) {
        report.push(_clickablePath(func));
      }
    }
    return report.join('\n');
  }

  /** Lint this project, resulting in a report of potential issues. */
  private lint(options?: LinterOptions) {
    const funcs = this.project.findGlobalFunctionReferences({
      versionSuffix: options?.versionSuffix,
    });
    const report: LinterReport = {
      nonreferencedFunctions: funcs
        .filter((f) => f.references.length == 0)
        .map((f) => f.token),
    };
    if (options?.versionSuffix) {
      report.outdatedFunctionReferences = funcs
        .map((f) => f.references.filter((r) => !r.isCorrectVersion))
        .flat(1);
    }
    this._report = report;
    return report;
  }
}
