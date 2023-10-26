const reporter =
  process.env.MOCHA_REPORTER === 'vscode-problem-matcher'
    ? __dirname + '/mochaMatcherReporter.cjs'
    : process.env.MOCHA_REPORTER === 'detailed'
    ? __dirname + '/detailedReporter.cjs'
    : 'spec';

/** @type {import('mocha').MochaOptions} */
module.exports = {
  spec: [
    'dist/**/*.test.js',
    'app/**/*.test.js',
    'build/**/*.test.js',
    'tests/**/*.js',
    'test/**/*.js',
    'dist/tests/**/*.js',
    'dist/test/**/*.js',
  ],
  forbidOnly: true,
  bail: true,
  timeout: 10000,
  slow: 250,
  color: true,
  diff: true,
  inlineDiffs: true,
  parallel: true,
  reporter,
  require: 'source-map-support/register',
};
