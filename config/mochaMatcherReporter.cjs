const { ok } = require('assert');
const Mocha = require('mocha');
const path = require('path');
const Base = Mocha.reporters.Base;
const { EVENT_TEST_FAIL } = Mocha.Runner.constants;

/**
 * @type {Mocha.ReporterConstructor}
 */
class MatcherReporter {
  /**
   * @param {Mocha.Runner} runner
   * @param {Mocha.MochaOptions} options
   */
  constructor(runner, options) {
    Base.call(this, runner, options);
    runner.on(EVENT_TEST_FAIL, function (test, err) {
      const match = err.stack.match(
        /\(file:\/\/\/(?<file>.+?):(?<line>\d+):(?<col>\d+)\)/,
      );
      ok(match, 'Could not parse stack trace');
      const [, absolutePath, line, col] = match;
      const filePath = path.relative(
        path.resolve(process.cwd(), '../..'),
        absolutePath,
      );
      // Location and message line
      console.error(`> ${[filePath, line, col, err.message].join('::')}`);
      // Add the title on the subsequent line, in case we want to pull that too
      console.error(`~ ${test.fullTitle()}`);
    });
  }
}

module.exports = MatcherReporter;
